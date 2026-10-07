import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { UsageSource } from "./types.ts";

export type RecordedUsage = Extract<SessionEntry, { type: "usage" }>["usage"];

/** One usage-bearing session entry, reduced to what the totals need. */
export interface UsageRecord {
  source: UsageSource;
  /** "provider/model", or undefined when the entry has no model identity. */
  providerModel: string | undefined;
  usage: RecordedUsage | undefined;
}

/** Session data may be edited or corrupt, so fall back to "unknown" for a missing name. */
function modelKey(provider: unknown, model: unknown): string {
  const name = (value: unknown) => (typeof value === "string" && value !== "" ? value : "unknown");
  return `${name(provider)}/${name(model)}`;
}

/**
 * Read usage from a raw session entry. Entry types that carry usage must be listed here;
 * all other entries are ignored. Usage is never mined from tool details or custom data.
 */
export function usageRecord(entry: SessionEntry): UsageRecord | undefined {
  switch (entry.type) {
    case "message": {
      const message = entry.message;
      if (message.role === "assistant") {
        return {
          source: "main",
          providerModel: modelKey(message.provider, message.responseModel ?? message.model),
          usage: message.usage,
        };
      }
      if (message.role === "toolResult" && message.usage) {
        return { source: "tool", providerModel: undefined, usage: message.usage };
      }
      return undefined;
    }
    case "usage":
      return { source: "other", providerModel: modelKey(entry.provider, entry.model), usage: entry.usage };
    case "compaction":
    case "branch_summary":
      return entry.usage ? { source: "summary", providerModel: undefined, usage: entry.usage } : undefined;
    default:
      return undefined;
  }
}
