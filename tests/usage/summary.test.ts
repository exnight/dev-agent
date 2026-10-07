import assert from "node:assert/strict";
import { test } from "node:test";
import { collectUsage } from "../../extensions/usage/collect.ts";
import { formatDetails, formatSummary, hasUsageWarnings, needsSubtotalLabel } from "../../extensions/usage/summary.ts";
import { assistant, compaction, missingUsage, tool, usage, withTotalCost, withoutCost, type Usage } from "./fixtures.ts";

test("summary shows each model's category costs and subtotal, with the session total below", () => {
  const summary = collectUsage([assistant(usage({ input: 0.75, output: 1.5, cacheRead: 0.15, cacheWrite: 0.75 }, {
    input: 250_000, output: 100_000, cacheRead: 500_000, cacheWrite: 200_000,
  }))]);
  const report = formatSummary(summary);
  assert.match(report, /By provider\/model\n\ntest\/model\n  Uncached input: \$0\.75\n  Output: \$1\.50\n  Cache read: \$0\.15\n  Cache write: \$0\.75\n  Subtotal: \$3\.15\n/);
  assert.match(report, /^Total: \$3\.15$/m);
  assert.ok(report.indexOf("\nTotal: $3.15") > report.indexOf("Cache write:"));
  assert.match(report, /\/usage details/);
  assert.match(report, /\/usage rates/);
});

test("summary leaves out rates, token counts and source totals", () => {
  const summary = collectUsage([assistant(usage({ input: 3 }, { input: 1_000_000 }))]);
  assert.doesNotMatch(formatSummary(summary), /\/M\b|tokens\)|By source|Recorded tokens/);
});

test("categories without a recorded cost are omitted", () => {
  const summary = collectUsage([assistant(usage({ output: 2 }, { output: 1_000 }))]);
  const report = formatSummary(summary);
  assert.match(report, /test\/model\n  Output: \$2\.00\n  Subtotal: \$2\.00/);
  assert.doesNotMatch(report, /Uncached input:|Cache read:|Cache write:/);
});

test("multiple models are listed separately, most expensive first, never blended", () => {
  const summary = collectUsage([
    assistant(usage({ input: 3 }), "test", "cheap"),
    assistant(usage({ input: 4 }), "test", "expensive"),
  ]);
  const report = formatSummary(summary);
  assert.match(report, /test\/expensive\n  Uncached input: \$4\.00\n  Subtotal: \$4\.00/);
  assert.match(report, /test\/cheap\n  Uncached input: \$3\.00\n  Subtotal: \$3\.00/);
  assert.ok(report.indexOf("test/expensive") < report.indexOf("test/cheap"));
  assert.match(report, /^Total: \$7\.00$/m);
});

test("the same model ID on different providers is listed separately", () => {
  const summary = collectUsage([
    assistant(usage({ input: 3 }, { input: 1_000_000 }), "provider-a", "same-model"),
    assistant(usage({ input: 8 }, { input: 2_000_000 }), "provider-b", "same-model"),
  ]);
  const report = formatSummary(summary);
  assert.match(report, /provider-a\/same-model\n  Uncached input: \$3\.00/);
  assert.match(report, /provider-b\/same-model\n  Uncached input: \$8\.00/);
});

test("unattributed tool and summary estimates are their own group, not assigned to a model", () => {
  const summary = collectUsage([
    assistant(usage({ input: 1 }, { input: 1_000_000 })),
    tool(usage({ output: 2 }, { output: 500_000 })),
    compaction(usage({ output: 3 }, { output: 500_000 })),
  ]);
  const report = formatSummary(summary);
  assert.match(report, /Unattributed tools \/ summaries\n  Output: \$5\.00\n  Subtotal: \$5\.00/);
  assert.match(report, /test\/model\n  Uncached input: \$1\.00\n  Subtotal: \$1\.00/);
  assert.match(report, /^Total: \$6\.00$/m);
});

test("details add cost by source and cumulative tokens, without double-counting reasoning or 1h cache writes", () => {
  const summary = collectUsage([assistant(usage({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4 }, {
    input: 100, output: 200, cacheRead: 300, cacheWrite: 400, cacheWrite1h: 150, reasoning: 50,
  }))]);
  const report = formatDetails(summary);
  assert.match(report, /By provider\/model/);
  assert.match(report, /By source\n  Main model calls: \$10\.00\n/);
  assert.match(report, /^  Uncached input: 100 tokens$/m);
  assert.match(report, /^  Output \(includes reasoning\): 200 tokens$/m);
  assert.match(report, /^  Cache write: 400 tokens$/m);
  assert.match(report, /^  Total: 1\.00 K tokens$/m);
  assert.match(report, /^Total: \$10\.00$/m);
  assert.doesNotMatch(formatSummary(summary), /By source|Recorded tokens/);
});

test("an empty session shows a zero total, not a warning", () => {
  for (const report of [formatSummary(collectUsage([])), formatDetails(collectUsage([]))]) {
    assert.match(report, /No model usage recorded yet/);
    assert.match(report, /^Total: \$0\.00$/m);
    assert.doesNotMatch(report, /Warning:|By provider\/model|By source/);
  }
});

test("missing and zero costs relabel the total and warn", () => {
  const report = formatSummary(collectUsage([
    assistant(usage({ input: 2 }, { input: 1_000 })),
    assistant(withoutCost(usage({ input: 1 }, { input: 1_000 }))),
    assistant(usage({}, { input: 1_000 }), "test", "free"),
  ]));
  assert.match(report, /^Recorded subtotal: \$2\.00$/m);
  assert.match(report, /Warning: 1 usage record\(s\) lack a usable cost; the subtotal excludes them/);
  assert.match(report, /Warning: 1 token-using record\(s\) have zero cost/);
  assert.doesNotMatch(report, /^Total:/m);
});

test("invalid costs never produce NaN or Infinity", () => {
  const broken = usage({ input: 0.5 }, { input: 200 });
  const bad = [withoutCost(broken), withTotalCost(broken, NaN), withTotalCost(broken, -1), missingUsage()];
  const summary = collectUsage([...bad.map((record) => assistant(record)), assistant(usage({ input: 0.25 }))]);
  for (const report of [formatSummary(summary), formatDetails(summary)]) assert.doesNotMatch(report, /NaN|Infinity/);
  assert.match(formatSummary(summary), /4 usage record\(s\) lack a usable cost/);
  assert.match(formatSummary(summary), /^Recorded subtotal: \$0\.25$/m);
});

test("a component mismatch warns without relabeling the recorded total", () => {
  const report = formatSummary(collectUsage([assistant(usage({ input: 1, output: 2, total: 10 }))]));
  assert.match(report, /Warning: some cost components are missing or do not reconcile/);
  assert.match(report, /^Total: \$10\.00$/m);
  assert.doesNotMatch(formatSummary(collectUsage([assistant(usage({ input: 1 }))])), /do not reconcile/);
});

test("subtotal label applies to missing and zero costs only", () => {
  const totals = (record: Usage) => collectUsage([assistant(record)]).sessionTotals;
  assert.equal(needsSubtotalLabel(totals(usage({ input: 1 }))), false);
  assert.equal(needsSubtotalLabel(totals(withoutCost(usage({ input: 1 })))), true);
  assert.equal(needsSubtotalLabel(totals(usage({}, { input: 100 }))), true);
  assert.equal(needsSubtotalLabel(totals(usage({ input: 1, total: 10 }))), false);
});

test("any diagnostic raises the notification level", () => {
  const totals = (record: Usage) => collectUsage([assistant(record)]).sessionTotals;
  assert.equal(hasUsageWarnings(totals(usage({ input: 1 }))), false);
  assert.equal(hasUsageWarnings(totals(usage({}, { input: 100 }))), true);
  assert.equal(hasUsageWarnings(totals(usage({ input: 1, total: 10 }))), true);
});

test("reports state that amounts are recorded estimates, and do not change the summary data", () => {
  const summary = collectUsage([
    assistant(usage({ input: 3 }, { input: 1_000_000 }), "github-copilot", "same-model"),
    assistant(usage({ input: 3 }, { input: 1_000_000 }), "openai-codex", "same-model"),
  ]);
  const before = structuredClone(summary);
  for (const format of [formatSummary, formatDetails]) {
    const report = format(summary);
    assert.match(report, /Session usage \(estimated USD\)/);
    assert.match(report, /Recorded estimates, not an invoice/);
    assert.match(report, /^Total: \$6\.00$/m);
  }
  assert.deepEqual(summary, before);
});

test("reports never print control characters from provider/model names", () => {
  const summary = collectUsage([assistant(usage({ input: 1 }), "evil\x1b[2J", "model\nInjected line")]);
  for (const format of [formatSummary, formatDetails]) {
    const report = format(summary);
    assert.doesNotMatch(report, /[\x00-\x09\x0b-\x1f\x7f-\x9f]/);
    assert.match(report, /^evil\[2J\/modelInjected line$/m);
    assert.doesNotMatch(report, /^Injected line/m);
  }
});
