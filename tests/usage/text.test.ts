import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCost, formatRate, formatTokens, mismatchWarning, safeLabel, sortedGroups } from "../../extensions/usage/text.ts";
import { collectUsage } from "../../extensions/usage/collect.ts";
import { assistant, usage } from "./fixtures.ts";

test("costs show 2 d.p. and nonzero costs never display as free", () => {
  assert.equal(formatCost(0), "$0.00");
  assert.equal(formatCost(0.000001), "<$0.01");
  assert.equal(formatCost(0.004), "<$0.01");
  assert.equal(formatCost(0.0123), "$0.01");
  assert.equal(formatCost(12.5), "$12.50");
  assert.equal(formatCost(1234.5), "$1,234.50");
});

test("rates show 2-4 d.p., so small rates are not rounded away or shown as free", () => {
  assert.equal(formatRate(3), "$3.00");
  assert.equal(formatRate(0.075), "$0.075");
  assert.equal(formatRate(0.3125), "$0.3125");
  assert.equal(formatRate(0.00000003), "<$0.0001");
  assert.equal(formatRate(0), "$0.00");
});

test("token counts use 2 d.p., with K from 1,000 and M from 1,000,000", () => {
  for (const [tokens, text] of [
    [0, "0 tokens"],
    [1, "1 token"],
    [999, "999 tokens"],
    [1_000, "1.00 K tokens"],
    [1_234, "1.23 K tokens"],
    [999_994, "999.99 K tokens"],
    [999_999, "1.00 M tokens"],
    [1_000_000, "1.00 M tokens"],
    [1_234_567, "1.23 M tokens"],
  ] as const) {
    assert.equal(formatTokens(tokens), text);
  }
});

test("safeLabel strips control characters and caps the length", () => {
  assert.equal(safeLabel("plain/model"), "plain/model");
  assert.equal(safeLabel("a\nb\x1b[31mc\x07\x9bd"), "ab[31mcd");
  assert.equal(safeLabel("x".repeat(100)), "x".repeat(100));
  assert.equal(safeLabel("x".repeat(101)), `${"x".repeat(100)}...`);
});

test("groups sort by recorded cost, highest first, then by name", () => {
  const { modelBreakdowns } = collectUsage([
    assistant(usage({ input: 1 }), "test", "b"),
    assistant(usage({ input: 1 }), "test", "a"),
    assistant(usage({ input: 5 }), "test", "c"),
  ]);
  assert.deepEqual(sortedGroups(modelBreakdowns).map(([name]) => name), ["test/c", "test/a", "test/b"]);
});

test("a mismatch warning appears only when a record's components do not reconcile", () => {
  const clean = collectUsage([assistant(usage({ input: 1 }))]).sessionTotals.diagnostics;
  const mismatched = collectUsage([assistant(usage({ input: 1, total: 10 }))]).sessionTotals.diagnostics;
  assert.deepEqual(mismatchWarning(clean), []);
  assert.equal(mismatchWarning(mismatched).length, 1);
});

test("very large token counts and costs keep thousands separators", () => {
  assert.equal(formatTokens(5_000_000_000_000), "5,000,000.00 M tokens");
  assert.equal(formatCost(1_234_567.891), "$1,234,567.89");
});
