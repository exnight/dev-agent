import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export interface FooterStats {
  cost: number;
  cacheHitRate: number | undefined;
}

/** Keep entry classification local so this extension can be copied independently. */
function recordedUsage(entry: SessionEntry) {
  switch (entry.type) {
    case "message":
      return entry.message.role === "assistant" ||
        entry.message.role === "toolResult"
        ? entry.message.usage
        : undefined;
    case "usage":
    case "compaction":
    case "branch_summary":
      return entry.usage;
    default:
      return undefined;
  }
}

function validCount(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Same whole-session cost scope as Pi's built-in footer, including all branches. */
export function collectFooterStats(
  entries: readonly SessionEntry[],
): FooterStats {
  let cost = 0;
  let cacheHitRate: number | undefined;
  for (const entry of entries) {
    const usage = recordedUsage(entry);
    if (usage) {
      const total = usage.cost?.total;
      if (typeof total === "number" && Number.isFinite(total) && total >= 0)
        cost += total;
    }
    if (entry.type === "message" && entry.message.role === "assistant") {
      const input = usage?.input;
      const read = usage?.cacheRead;
      const write = usage?.cacheWrite;
      if (validCount(input) && validCount(read) && validCount(write)) {
        const prompt = input + read + write;
        cacheHitRate = prompt > 0 ? (read / prompt) * 100 : undefined;
      } else {
        cacheHitRate = undefined;
      }
    }
  }
  return { cost, cacheHitRate };
}
