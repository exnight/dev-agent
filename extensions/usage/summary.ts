import { COMPONENT_LABELS, NO_USAGE, formatCost, formatTokens, mismatchWarning, safeLabel, sortedGroups } from "./text.ts";
import { TOKEN_COMPONENTS, type UsageSource, type UsageSummary, type UsageTotals } from "./types.ts";

const HEADER = "Session usage (estimated USD)";
const NOTE = "Recorded estimates, not an invoice.";
const HINT = "Use /usage details for sources and token counts, /usage rates for per-token rates.";

const SOURCE_LABELS: Record<UsageSource, string> = {
  main: "Main model calls",
  tool: "Tool model calls",
  summary: "Compaction / branch summaries",
  other: "Other model usage",
};

function totalTokens(totals: UsageTotals): number {
  return TOKEN_COMPONENTS.reduce((sum, component) => sum + totals.tokens[component], 0);
}

/** A usable positive estimate is not proof of correct pricing or an actual charge. */
export function needsSubtotalLabel({ diagnostics }: UsageTotals): boolean {
  return diagnostics.missingCostRecords > 0 || diagnostics.zeroCostRecords > 0;
}

/** Any diagnostic raises the notification level to a warning. */
export function hasUsageWarnings(totals: UsageTotals): boolean {
  return needsSubtotalLabel(totals) || totals.diagnostics.incompleteBreakdownRecords > 0;
}

function modelLines(summary: UsageSummary): string[] {
  const lines = ["", "By provider/model"];
  for (const [name, totals] of sortedGroups(summary.modelBreakdowns)) {
    lines.push("", safeLabel(name));
    for (const [label, component] of COMPONENT_LABELS) {
      const cost = totals.recordedCosts[component];
      if (cost > 0) lines.push(`  ${label}: ${formatCost(cost)}`);
    }
    lines.push(`  ${needsSubtotalLabel(totals) ? "Recorded subtotal" : "Subtotal"}: ${formatCost(totals.recordedCosts.total)}`);
  }
  return lines;
}

function detailLines(summary: UsageSummary): string[] {
  const lines = ["", "By source"];
  const sources = [...summary.sourceBreakdowns].map(([source, totals]): [string, UsageTotals] =>
    [SOURCE_LABELS[source], totals]);
  for (const [label, totals] of sortedGroups(sources)) {
    const note = needsSubtotalLabel(totals) ? " (subtotal; pricing unverified)" : "";
    lines.push(`  ${label}: ${formatCost(totals.recordedCosts.total)}${note}`);
  }
  const total = summary.sessionTotals;
  lines.push("", "Recorded tokens (cumulative across requests)");
  for (const [label, component] of COMPONENT_LABELS) {
    const tokenLabel = component === "output" ? "Output (includes reasoning)" : label;
    lines.push(`  ${tokenLabel}: ${formatTokens(total.tokens[component])}`);
  }
  lines.push(`  Total: ${formatTokens(totalTokens(total))}`);
  return lines;
}

function totalLines(total: UsageTotals): string[] {
  const { diagnostics } = total;
  const lines = ["", `${needsSubtotalLabel(total) ? "Recorded subtotal" : "Total"}: ${formatCost(total.recordedCosts.total)}`];
  if (diagnostics.missingCostRecords > 0) {
    lines.push(`Warning: ${diagnostics.missingCostRecords} usage record(s) lack a usable cost; the subtotal excludes them.`);
  }
  if (diagnostics.zeroCostRecords > 0) {
    lines.push(
      `Warning: ${diagnostics.zeroCostRecords} token-using record(s) have zero cost. Pricing may be missing, free, or subscription-covered; verify pricing.`,
    );
  }
  lines.push(...mismatchWarning(diagnostics), "", NOTE);
  return lines;
}

/** Header, model sections, optional extra sections, then totals. */
function reportLines(summary: UsageSummary, extra: string[]): string[] {
  const total = summary.sessionTotals;
  const body = total.recordCount === 0 ? ["", NO_USAGE] : [...modelLines(summary), ...extra];
  return [HEADER, ...body, ...totalLines(total)];
}

/** /usage: recorded cost by provider/model. */
export function formatSummary(summary: UsageSummary): string {
  return [...reportLines(summary, []), HINT].join("\n");
}

/** /usage details: the summary plus cost by source and token counts. */
export function formatDetails(summary: UsageSummary): string {
  const extra = summary.sessionTotals.recordCount === 0 ? [] : detailLines(summary);
  return reportLines(summary, extra).join("\n");
}
