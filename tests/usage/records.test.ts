import assert from "node:assert/strict";
import { test } from "node:test";
import { usageRecord } from "../../extensions/usage/records.ts";
import { assistant, branchSummary, compaction, entry, tool, usage } from "./fixtures.ts";

test("assistant messages are main usage, keyed by provider and the concrete responseModel", () => {
  const plain = usageRecord(assistant(usage({ input: 1 }), "provider-a", "old-model"));
  assert.equal(plain?.source, "main");
  assert.equal(plain?.providerModel, "provider-a/old-model");
  const routed = usageRecord(assistant(usage({ input: 2 }), "provider-b", "auto", { responseModel: "actual-model" }));
  assert.equal(routed?.providerModel, "provider-b/actual-model");
});

test("model changes carry no usage, so the selected model never affects attribution", () => {
  assert.equal(usageRecord(entry({ type: "model_change", provider: "provider-b", modelId: "new-model" })), undefined);
});

test("failed and aborted calls still produce a record", () => {
  for (const stopReason of ["error", "aborted"] as const) {
    assert.ok(usageRecord(assistant(usage({ output: 0.3 }), "test", "model", { stopReason })));
  }
});

test("tool results with usage are tool usage without a model; without usage they are ignored", () => {
  const record = usageRecord(tool(usage({ output: 2 })));
  assert.equal(record?.source, "tool");
  assert.equal(record?.providerModel, undefined);
  const plain = entry({
    type: "message",
    message: { role: "toolResult", toolCallId: "call", toolName: "test", content: [], isError: false, timestamp: 0 },
  });
  assert.equal(usageRecord(plain), undefined);
});

test("compaction and branch summaries with usage are summary usage without a model", () => {
  for (const summary of [compaction(usage({ output: 3 })), branchSummary(usage({ output: 4 }))]) {
    const record = usageRecord(summary);
    assert.equal(record?.source, "summary");
    assert.equal(record?.providerModel, undefined);
  }
  assert.equal(usageRecord(compaction()), undefined);
  assert.equal(usageRecord(branchSummary()), undefined);
});

test("usage entries of any kind, including future ones, are other usage with their model", () => {
  for (const kind of ["cache_warm", "future_operation"]) {
    const record = usageRecord(entry({ type: "usage", kind, provider: "test", model: "model", usage: usage({ input: 5 }) }));
    assert.equal(record?.source, "other");
    assert.equal(record?.providerModel, "test/model");
  }
});

test("entries without independent usage are ignored; usage is never mined from details or custom data", () => {
  const detailed = entry({
    type: "message",
    message: {
      role: "toolResult", toolCallId: "call", toolName: "test", content: [], isError: false, timestamp: 0,
      details: { usage: { ...usage({ output: 100 }) } },
    },
  });
  for (const ignored of [
    entry({ type: "message", message: { role: "user", content: "hello", timestamp: 0 } }),
    entry({ type: "message", message: { role: "system", content: "prompt", timestamp: 0 } }),
    detailed,
    entry({ type: "custom", customType: "test", data: { usage: usage({ output: 100 }) } }),
    entry({ type: "context_edit", targetId: "old", replacement: null }),
  ]) {
    assert.equal(usageRecord(ignored), undefined);
  }
});

test("missing or empty provider/model names fall back to unknown", () => {
  assert.equal(usageRecord(assistant(usage(), "", "model"))?.providerModel, "unknown/model");
  assert.equal(usageRecord(assistant(usage(), "provider", ""))?.providerModel, "provider/unknown");
  const bare = entry({ type: "usage", kind: "cache_warm", provider: undefined as unknown as string, model: "m", usage: usage() });
  assert.equal(usageRecord(bare)?.providerModel, "unknown/m");
});

test("a slash inside a provider name is kept", () => {
  assert.equal(usageRecord(assistant(usage(), "gateway/team", "model"))?.providerModel, "gateway/team/model");
});
