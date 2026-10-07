import {
  COMPONENT_LABELS, NO_USAGE, formatRate, formatTokens, mismatchWarning, safeLabel, sortedGroups,
} from "./text.ts";
import type { CategoryRates, UsageSummary } from "./types.ts";

function rateText({ known, unknown }: CategoryRates): string | undefined {
  const parts = [...known]
    .sort(([a], [b]) => b - a)
    .map(([rate, group]) => `${formatRate(rate)} (${formatTokens(group.tokens)})`);
  if (unknown.tokens > 0) parts.push(`unknown (${formatTokens(unknown.tokens)})`);
  else if (unknown.recordedCost > 0) parts.push("unknown (cost without tokens)");
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** /usage rates: derived USD per million tokens, by provider/model and token category. */
export function formatRates(summary: UsageSummary): string {
  const lines = ["Rates (USD per million tokens, derived from recorded costs)"];
  if (summary.sessionTotals.recordCount === 0) lines.push("", NO_USAGE);
  for (const [name, totals] of sortedGroups(summary.modelBreakdowns)) {
    lines.push("", safeLabel(name));
    let found = false;
    for (const [label, component] of COMPONENT_LABELS) {
      const text = rateText(totals.rateGroups[component]);
      if (text === undefined) continue;
      lines.push(`  ${label}: ${text}`);
      found = true;
    }
    if (!found) lines.push("  No rates available.");
  }
  const warnings = mismatchWarning(summary.sessionTotals.diagnostics);
  if (warnings.length > 0) lines.push("", ...warnings);
  lines.push("", "Rates come from recorded costs, not current price lists.");
  return lines.join("\n");
}
