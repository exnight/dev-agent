import type { UsageDiagnostics, UsageTotals } from "./types.ts";

/** Shared text helpers for the /usage reports. */

export const NO_USAGE = "No model usage recorded yet.";
const MISMATCH_WARNING =
  "Warning: some cost components are missing or do not reconcile; the recorded total is authoritative for this report.";

export const COMPONENT_LABELS = [
  ["Uncached input", "input"],
  ["Output", "output"],
  ["Cache read", "cacheRead"],
  ["Cache write", "cacheWrite"],
] as const;

const MAX_LABEL_LENGTH = 100;

/** Strip control characters and cap the length of strings that come from session data or user input. */
export function safeLabel(text: string): string {
  const clean = text.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  return clean.length > MAX_LABEL_LENGTH ? `${clean.slice(0, MAX_LABEL_LENGTH)}...` : clean;
}

// Costs and token counts use 2 d.p. Rates use 2-4 d.p. so values like $0.075 are not rounded away.
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const rateDollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const decimals = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCost(amount: number): string {
  return amount > 0 && amount < 0.005 ? "<$0.01" : dollars.format(amount);
}

export function formatRate(rate: number): string {
  return rate > 0 && rate < 0.0001 ? "<$0.0001" : rateDollars.format(rate);
}

export function formatTokens(tokens: number): string {
  if (tokens < 1_000) return `${tokens} ${tokens === 1 ? "token" : "tokens"}`;
  // Values just under 1M would round to "1,000.00 K", so show them in M.
  if (Number((tokens / 1_000).toFixed(2)) < 1_000) return `${decimals.format(tokens / 1_000)} K tokens`;
  return `${decimals.format(tokens / 1_000_000)} M tokens`;
}

export function sortedGroups(groups: Iterable<[string, UsageTotals]>): [string, UsageTotals][] {
  return [...groups].sort(([a, first], [b, second]) =>
    second.recordedCosts.total - first.recordedCosts.total || a.localeCompare(b));
}

export function mismatchWarning({ incompleteBreakdownRecords }: UsageDiagnostics): string[] {
  return incompleteBreakdownRecords > 0 ? [MISMATCH_WARNING] : [];
}
