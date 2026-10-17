import assert from "node:assert/strict";
import { test } from "node:test";
import { collectFooterStats } from "../../extensions/footer/stats.ts";
import {
  assistant,
  branchSummary,
  compaction,
  entry,
  missingUsage,
  tool,
  usage,
  withoutCost,
} from "../usage/fixtures.ts";

test("empty session has no cache measurement and zero cost", () => {
  assert.deepEqual(collectFooterStats([]), {
    cost: 0,
    cacheHitRate: undefined,
  });
});

test("cost includes all independent records, all branches, and pre-compaction history", () => {
  const entries = [
    assistant(usage({ total: 1 })),
    assistant(usage({ total: 2 })),
    tool(usage({ total: 3 })),
    compaction(usage({ total: 4 })),
    branchSummary(usage({ total: 5 })),
    entry({
      type: "usage",
      kind: "cache_warming",
      provider: "test",
      model: "model",
      usage: usage({ total: 6 }),
    }),
    entry({
      type: "custom",
      customType: "not-usage",
      data: { usage: usage({ total: 100 }) },
    }),
  ];
  const before = structuredClone(entries);
  assert.equal(collectFooterStats(entries).cost, 21);
  assert.deepEqual(entries, before);
});

test("cache hit rate is from the latest assistant prompt, includes cache writes, excludes output", () => {
  const stats = collectFooterStats([
    assistant(usage({}, { input: 100, cacheRead: 900 })),
    assistant(
      usage(
        {},
        { input: 200, cacheRead: 600, cacheWrite: 200, output: 10_000 },
      ),
    ),
    tool(usage({}, { cacheRead: 999 })),
    compaction(usage({}, { cacheRead: 999 })),
  ]);
  assert.equal(stats.cacheHitRate, 60);
});

test("measured zero cache hits is distinct from unknown", () => {
  assert.equal(
    collectFooterStats([assistant(usage({}, { input: 100 }))]).cacheHitRate,
    0,
  );
  assert.equal(
    collectFooterStats([assistant(usage())]).cacheHitRate,
    undefined,
  );
});

test("missing or invalid latest usage clears the previous cache measurement", () => {
  for (const recorded of [
    missingUsage(),
    usage({}, { input: NaN }),
    usage({}, { cacheRead: -1 }),
  ]) {
    const stats = collectFooterStats([
      assistant(usage({}, { cacheRead: 100 })),
      assistant(recorded),
    ]);
    assert.equal(stats.cacheHitRate, undefined);
  }
});

test("bad costs do not poison a usable recorded total or cache measurement", () => {
  const stats = collectFooterStats([
    assistant(withoutCost(usage({}, { input: 100 }))),
    assistant(usage({ total: NaN })),
    assistant(usage({ total: Infinity })),
    assistant(usage({ total: -1 })),
    assistant(usage({ total: 0.123 }, { input: 25, cacheRead: 75 })),
  ]);
  assert.deepEqual(stats, { cost: 0.123, cacheHitRate: 75 });
});

test("failed and aborted responses retain the same recorded-cost scope as Pi", () => {
  assert.equal(
    collectFooterStats([
      assistant(usage({ total: 1 }), "test", "model", { stopReason: "error" }),
      assistant(usage({ total: 2 }), "test", "model", {
        stopReason: "aborted",
      }),
    ]).cost,
    3,
  );
});
