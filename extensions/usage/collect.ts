import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { usageRecord, type RecordedUsage } from "./records.ts";
import { TOKEN_COMPONENTS, type CategoryRates, type UsageSummary, type UsageTotals } from "./types.ts";

/** Model-breakdown label for tool and summary usage that has no provider/model identity. */
export const UNATTRIBUTED_LABEL = "Unattributed tools / summaries";

/** Component costs may differ from the recorded total by this much before the record is flagged. */
const MISMATCH_ABSOLUTE = 1e-9;
const MISMATCH_RELATIVE = 1e-6;

function emptyRates(): CategoryRates {
  return { known: new Map(), unknown: { tokens: 0, recordedCost: 0 } };
}

function emptyTotals(): UsageTotals {
  return {
    recordCount: 0,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    recordedCosts: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    rateGroups: { input: emptyRates(), output: emptyRates(), cacheRead: emptyRates(), cacheWrite: emptyRates() },
    diagnostics: { missingCostRecords: 0, zeroCostRecords: 0, incompleteBreakdownRecords: 0 },
  };
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** True if the record reports any tokens, by component or in its own total. */
function usedTokens(usage: RecordedUsage | undefined): boolean {
  const positive = (value: unknown) => isAmount(value) && value > 0;
  return TOKEN_COMPONENTS.some((component) => positive(usage?.[component])) || positive(usage?.totalTokens);
}

/**
 * Rate = cost / (tokens / 1e6), rounded to 12 significant digits so floating-point noise does not
 * split equal rates. Distinct historical/tier rates are not blended.
 */
function addRateGroup(
  rates: CategoryRates,
  tokens: number | undefined,
  cost: number | undefined,
  rateKnown: boolean,
): void {
  const count = isAmount(tokens) ? tokens : 0;
  const amount = isAmount(cost) ? cost : 0;
  if (count === 0 && amount === 0) return;

  let group = rates.unknown;
  if (rateKnown && count > 0 && isAmount(cost)) {
    const rate = Number((amount / (count / 1_000_000)).toPrecision(12));
    group = rates.known.get(rate) ?? { tokens: 0, recordedCost: 0 };
    rates.known.set(rate, group);
  }
  group.tokens += count;
  group.recordedCost += amount;
}

function addTokens(totals: UsageTotals, usage: RecordedUsage | undefined): void {
  for (const component of TOKEN_COMPONENTS) {
    const amount = usage?.[component];
    if (isAmount(amount)) totals.tokens[component] += amount;
  }
}

function addCost(totals: UsageTotals, usage: RecordedUsage | undefined): void {
  const cost = usage?.cost;
  if (!cost || !isAmount(cost.total)) {
    totals.diagnostics.missingCostRecords++;
    totals.diagnostics.incompleteBreakdownRecords++;
    for (const component of TOKEN_COMPONENTS) {
      addRateGroup(totals.rateGroups[component], usage?.[component], undefined, false);
    }
    return;
  }

  // Preserve Pi's recorded estimate, including any cache/tier adjustments.
  // Today's catalog may differ and must not reprice historical records.
  totals.recordedCosts.total += cost.total;
  // Zero may mean missing pricing, a free model, or subscription coverage.
  if (cost.total === 0 && usedTokens(usage)) totals.diagnostics.zeroCostRecords++;

  let componentTotal = 0;
  let complete = true;
  for (const component of TOKEN_COMPONENTS) {
    const amount = cost[component];
    if (isAmount(amount)) {
      totals.recordedCosts[component] += amount;
      componentTotal += amount;
    } else {
      complete = false;
    }
    addRateGroup(totals.rateGroups[component], usage?.[component], amount, cost.total > 0);
  }
  const tolerance = Math.max(MISMATCH_ABSOLUTE, cost.total * MISMATCH_RELATIVE);
  if (!complete || Math.abs(componentTotal - cost.total) > tolerance) {
    totals.diagnostics.incompleteBreakdownRecords++;
  }
}

function addUsage(totals: UsageTotals, usage: RecordedUsage | undefined): void {
  totals.recordCount++;
  addTokens(totals, usage);
  addCost(totals, usage);
}

function addToGroup<Key>(groups: Map<Key, UsageTotals>, key: Key, usage: RecordedUsage | undefined): void {
  let totals = groups.get(key);
  if (!totals) {
    totals = emptyTotals();
    groups.set(key, totals);
  }
  addUsage(totals, usage);
}

/** Aggregate finalized raw entries, not the active branch or compacted context. */
export function collectUsage(entries: readonly SessionEntry[]): UsageSummary {
  const summary: UsageSummary = {
    sessionTotals: emptyTotals(),
    modelBreakdowns: new Map(),
    sourceBreakdowns: new Map(),
  };
  for (const entry of entries) {
    const record = usageRecord(entry);
    if (!record) continue;
    addUsage(summary.sessionTotals, record.usage);
    addToGroup(summary.sourceBreakdowns, record.source, record.usage);
    addToGroup(summary.modelBreakdowns, record.providerModel ?? UNATTRIBUTED_LABEL, record.usage);
  }
  return summary;
}
