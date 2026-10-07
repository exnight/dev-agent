import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export type Usage = Extract<SessionEntry, { type: "usage" }>["usage"];
type AssistantMessage = Extract<Extract<SessionEntry, { type: "message" }>["message"], { role: "assistant" }>;
type EntryData = {
  [Type in SessionEntry["type"]]: Omit<Extract<SessionEntry, { type: Type }>, "id" | "parentId" | "timestamp">;
}[SessionEntry["type"]];

export function usage(cost: Partial<Usage["cost"]> = {}, tokens: Partial<Usage> = {}): Usage {
  const components = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, ...cost };
  const result = {
    input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
    ...tokens,
    cost: {
      ...components,
      total: cost.total ?? components.input + components.output + components.cacheRead + components.cacheWrite,
    },
  };
  return { ...result, totalTokens: result.input + result.output + result.cacheRead + result.cacheWrite };
}

/** Records that violate the schema, to exercise legacy or corrupt session data. */
export function missingUsage(): Usage {
  return undefined as unknown as Usage;
}

export function withoutCost(recorded: Usage): Usage {
  return { ...recorded, cost: undefined } as unknown as Usage;
}

export function withoutCostComponent(recorded: Usage, component: "input" | "output" | "cacheRead" | "cacheWrite"): Usage {
  return { ...recorded, cost: { ...recorded.cost, [component]: undefined } } as unknown as Usage;
}

export function withTotalCost(recorded: Usage, total: number): Usage {
  return { ...recorded, cost: { ...recorded.cost, total } };
}

export function entry(data: EntryData): SessionEntry {
  return { id: randomUUID(), parentId: null, timestamp: "2026-01-01T00:00:00.000Z", ...data };
}

export function assistant(
  recordedUsage: Usage,
  provider = "test",
  model = "model",
  extra: Partial<Pick<AssistantMessage, "responseModel" | "stopReason">> = {},
): SessionEntry {
  return entry({
    type: "message",
    message: {
      role: "assistant", provider, model, api: "test", content: [],
      usage: recordedUsage, stopReason: "stop", timestamp: 0, ...extra,
    },
  });
}

export function tool(recordedUsage: Usage): SessionEntry {
  return entry({
    type: "message",
    message: {
      role: "toolResult", toolCallId: "call", toolName: "test", content: [],
      isError: false, timestamp: 0, usage: recordedUsage,
    },
  });
}

export function compaction(recordedUsage?: Usage, firstKeptEntryId = "kept"): SessionEntry {
  return entry({
    type: "compaction", summary: "summary", firstKeptEntryId, tokensBefore: 50_000,
    ...(recordedUsage === undefined ? {} : { usage: recordedUsage }),
  });
}

export function branchSummary(recordedUsage?: Usage): SessionEntry {
  return entry({
    type: "branch_summary", summary: "summary", fromId: "branch",
    ...(recordedUsage === undefined ? {} : { usage: recordedUsage }),
  });
}

export function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}
