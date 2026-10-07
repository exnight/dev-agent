import assert from "node:assert/strict";
import { test } from "node:test";
import { collectUsage, UNATTRIBUTED_LABEL } from "../../extensions/usage/collect.ts";
import {
  assistant, branchSummary, close, compaction, entry, missingUsage, tool, usage, withTotalCost, withoutCost, withoutCostComponent,
} from "./fixtures.ts";

test("empty session has no records and a zero recorded total", () => {
  const summary = collectUsage([]);
  assert.equal(summary.sessionTotals.recordCount, 0);
  assert.equal(summary.sessionTotals.recordedCosts.total, 0);
  assert.equal(summary.sourceBreakdowns.size, 0);
  assert.equal(summary.modelBreakdowns.size, 0);
});

test("sums recorded estimates without repricing or subtracting cache discounts twice", () => {
  const summary = collectUsage([
    assistant(usage({ input: 0.003, output: 0.03, cacheRead: 0.0015, cacheWrite: 0.00375 }, {
      input: 1_000, output: 2_000, cacheRead: 5_000, cacheWrite: 1_000,
    })),
    assistant(usage({ input: 0.006, output: 0.015, cacheRead: 0.0006 }, {
      input: 2_000, output: 1_000, cacheRead: 2_000,
    })),
  ]);
  close(summary.sessionTotals.recordedCosts.total, 0.05985);
  close(summary.sessionTotals.recordedCosts.cacheRead, 0.0021);
  close(summary.sessionTotals.recordedCosts.cacheWrite, 0.00375);
  assert.equal(summary.sessionTotals.tokens.cacheRead, 7_000);
  assert.equal(summary.sessionTotals.diagnostics.incompleteBreakdownRecords, 0);
});

test("every usage record is counted once in the session, source and model breakdowns", () => {
  const summary = collectUsage([
    assistant(usage({ input: 1 })),
    tool(usage({ output: 2 })),
    compaction(usage({ output: 3 })),
    branchSummary(usage({ output: 4 })),
    entry({ type: "usage", kind: "cache_warm", provider: "test", model: "model", usage: usage({ cacheRead: 5 }) }),
    entry({ type: "usage", kind: "future_operation", provider: "test", model: "model", usage: usage({ input: 6 }) }),
  ]);
  assert.equal(summary.sessionTotals.recordedCosts.total, 21);
  assert.equal(summary.sessionTotals.recordCount, 6);
  assert.equal(summary.sourceBreakdowns.get("main")?.recordedCosts.total, 1);
  assert.equal(summary.sourceBreakdowns.get("tool")?.recordedCosts.total, 2);
  assert.equal(summary.sourceBreakdowns.get("summary")?.recordedCosts.total, 7);
  assert.equal(summary.sourceBreakdowns.get("other")?.recordedCosts.total, 11);
  assert.equal([...summary.sourceBreakdowns.values()].reduce((sum, group) => sum + group.recordedCosts.total, 0), 21);
  assert.equal([...summary.modelBreakdowns.values()].reduce((sum, group) => sum + group.recordedCosts.total, 0), 21);
  assert.equal(summary.modelBreakdowns.size, 2);
  assert.equal(summary.modelBreakdowns.get(UNATTRIBUTED_LABEL)?.recordCount, 3);
  assert.equal(summary.modelBreakdowns.get(UNATTRIBUTED_LABEL)?.recordedCosts.total, 9);
});

test("counts abandoned branches and history before compaction from raw entries", () => {
  const first = assistant(usage({ input: 1 }));
  const abandoned = assistant(usage({ input: 2 }));
  abandoned.parentId = first.id;
  const alternative = assistant(usage({ input: 4 }));
  alternative.parentId = first.id;
  const summary = collectUsage([first, abandoned, alternative, compaction(usage({ output: 8 }), alternative.id)]);
  assert.equal(summary.sessionTotals.recordedCosts.total, 15);
});

test("reconstructs the same totals after resume without mutating entries or persisting counters", () => {
  const entries = [assistant(usage({ cacheRead: 0.1, output: 0.2 }, { cacheRead: 2_000, output: 100 }))];
  const before = JSON.stringify(entries);
  const first = collectUsage(entries);
  const resumed = collectUsage(JSON.parse(before));
  assert.deepEqual(resumed, first);
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(collectUsage(entries), first);
});

test("the same model ID on different providers has separate tokens, estimates and rates", () => {
  const summary = collectUsage([
    assistant(usage({ input: 3 }, { input: 1_000_000 }), "provider-a", "same-model"),
    assistant(usage({ input: 8 }, { input: 2_000_000 }), "provider-b", "same-model"),
  ]);
  assert.equal(summary.modelBreakdowns.size, 2);
  const first = summary.modelBreakdowns.get("provider-a/same-model");
  const second = summary.modelBreakdowns.get("provider-b/same-model");
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.tokens.input, 1_000_000);
  assert.equal(second.tokens.input, 2_000_000);
  assert.deepEqual(first.rateGroups.input.known.get(3), { tokens: 1_000_000, recordedCost: 3 });
  assert.deepEqual(second.rateGroups.input.known.get(4), { tokens: 2_000_000, recordedCost: 8 });
});

test("token-using zero costs are counted, and a positive record is not", () => {
  const summary = collectUsage([
    assistant(usage({}, { input: 1_000, output: 100 })),
    assistant(usage({ input: 0.1 }, { input: 100 })),
    assistant(usage()),
  ]);
  assert.equal(summary.sessionTotals.diagnostics.zeroCostRecords, 1);
  assert.equal(summary.sessionTotals.recordedCosts.total, 0.1);
});

test("missing or invalid cost is excluded rather than producing NaN or a guessed total", () => {
  const broken = usage({ input: 0.5 }, { input: 200 });
  const summary = collectUsage([
    assistant(withoutCost(broken)), assistant(withTotalCost(broken, NaN)), assistant(withTotalCost(broken, -1)),
    assistant(missingUsage()),
    assistant(usage({ input: 0.25 })),
  ]);
  assert.equal(summary.sessionTotals.recordedCosts.total, 0.25);
  assert.equal(summary.sessionTotals.diagnostics.missingCostRecords, 4);
  assert.equal(summary.sessionTotals.tokens.input, 600);
});

test("recorded total stays authoritative if component costs disagree", () => {
  const summary = collectUsage([assistant(usage({ input: 1, output: 2, total: 10 }))]);
  assert.equal(summary.sessionTotals.recordedCosts.total, 10);
  assert.equal(summary.sessionTotals.diagnostics.incompleteBreakdownRecords, 1);
});

test("a missing component cost keeps the recorded total and puts its tokens in the unknown rate", () => {
  const valid = usage({ input: 1, output: 2 }, { input: 1_000_000, output: 500_000 });
  const summary = collectUsage([assistant(withoutCostComponent(valid, "output"))]);
  const { rateGroups, diagnostics, recordedCosts } = summary.sessionTotals;
  assert.equal(recordedCosts.total, 3);
  assert.equal(diagnostics.incompleteBreakdownRecords, 1);
  assert.equal(diagnostics.missingCostRecords, 0);
  assert.deepEqual(rateGroups.output.unknown, { tokens: 500_000, recordedCost: 0 });
  assert.equal(rateGroups.input.known.get(1)?.tokens, 1_000_000);
});

test("same-rate requests combine despite floating-point noise", () => {
  const summary = collectUsage([
    assistant(usage({ input: 0.003 }, { input: 1_000 })),
    assistant(usage({ input: 0.006000000000000001 }, { input: 2_000 })),
  ]);
  const { input } = summary.sessionTotals.rateGroups;
  assert.equal(input.known.size, 1);
  assert.equal(input.known.get(3)?.tokens, 3_000);
});

test("very large token counts and costs keep exact sums and rates", () => {
  const summary = collectUsage([
    assistant(usage({ input: 7_500_000 }, { input: 2_500_000_000_000 })),
    assistant(usage({ input: 7_500_000 }, { input: 2_500_000_000_000 })),
  ]);
  const { input } = summary.sessionTotals.rateGroups;
  assert.equal(summary.sessionTotals.tokens.input, 5_000_000_000_000);
  assert.deepEqual(input.known.get(3), { tokens: 5_000_000_000_000, recordedCost: 15_000_000 });
});
