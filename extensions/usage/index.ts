import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { collectUsage } from "./collect.ts";
import { formatRates } from "./rates.ts";
import { formatDetails, formatSummary, hasUsageWarnings } from "./summary.ts";
import { safeLabel } from "./text.ts";
import type { UsageSummary } from "./types.ts";

/** Report formatter per argument. No argument shows the summary. */
const FORMATTERS: Record<string, (summary: UsageSummary) => string> = {
  details: formatDetails,
  rates: formatRates,
};
const ARGS = Object.keys(FORMATTERS);

/** The only parts of Pi's command context that /usage uses. */
export interface UsageContext {
  hasUI: boolean;
  ui: Pick<ExtensionCommandContext["ui"], "notify">;
  sessionManager: Pick<ExtensionCommandContext["sessionManager"], "getEntries">;
}

function showReport(ctx: UsageContext, report: string, level: "info" | "warning" = "info"): void {
  if (ctx.hasUI) {
    // Display-only in the TUI and supported RPC clients.
    ctx.ui.notify(report, level);
  } else {
    // Preserve stdout for print output and JSONL protocol records.
    process.stderr.write(`${report}\n`);
  }
}

export function runUsage(args: string, ctx: UsageContext): void {
  const option = args.trim().toLowerCase();
  if (option !== "" && !ARGS.includes(option)) {
    showReport(ctx, `Unknown /usage argument: ${safeLabel(args.trim())}\nUsage: /usage [${ARGS.join("|")}]`, "warning");
    return;
  }
  const summary = collectUsage(ctx.sessionManager.getEntries());
  const format = FORMATTERS[option] ?? formatSummary;
  showReport(ctx, format(summary), hasUsageWarnings(summary.sessionTotals) ? "warning" : "info");
}

export default function usageExtension(pi: Pick<ExtensionAPI, "registerCommand">): void {
  pi.registerCommand("usage", {
    description: "Show recorded cost estimates by provider/model (/usage details, /usage rates)",
    getArgumentCompletions: (prefix) => {
      const matches = ARGS.filter((option) => option.startsWith(prefix));
      return matches.length > 0 ? matches.map((option) => ({ value: option, label: option })) : null;
    },
    handler: async (args, ctx) => runUsage(args, ctx),
  });
}
