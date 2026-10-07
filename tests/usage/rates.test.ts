import assert from "node:assert/strict";
import { test } from "node:test";
import { collectUsage } from "../../extensions/usage/collect.ts";
import { formatRates } from "../../extensions/usage/rates.ts";
import { assistant, usage, withoutCost, withoutCostComponent } from "./fixtures.ts";

test("rates show each model's per-category rate with the tokens it covers", () => {
  const summary = collectUsage([assistant(usage({ input: 0.75, output: 1.5, cacheRead: 0.15, cacheWrite: 0.75 }, {
    input: 250_000, output: 100_000, cacheRead: 500_000, cacheWrite: 200_000,
  }))]);
  const report = formatRates(summary);
  assert.match(report, /^Rates \(USD per million tokens, derived from recorded costs\)/);
  assert.match(report, /test\/model\n  Uncached input: \$3\.00 \(250\.00 K tokens\)\n  Output: \$15\.00 \(100\.00 K tokens\)\n  Cache read: \$0\.30 \(500\.00 K tokens\)\n  Cache write: \$3\.75 \(200\.00 K tokens\)/);
  assert.match(report, /Rates come from recorded costs, not current price lists/);
  assert.doesNotMatch(report, /Subtotal|^Total:/m);
});

test("small cache rates keep their decimals", () => {
  const summary = collectUsage([assistant(usage({ cacheRead: 0.075, cacheWrite: 0.3125 }, {
    cacheRead: 1_000_000, cacheWrite: 1_000_000,
  }))]);
  const report = formatRates(summary);
  assert.match(report, /Cache read: \$0\.075 \(1\.00 M tokens\)/);
  assert.match(report, /Cache write: \$0\.3125 \(1\.00 M tokens\)/);
});

test("different historical or tier rates in one category are listed separately, highest first", () => {
  const summary = collectUsage([
    assistant(usage({ input: 3 }, { input: 3_000_000 })),
    assistant(usage({ input: 4 }, { input: 1_000_000 })),
  ]);
  const report = formatRates(summary);
  assert.match(report, /Uncached input: \$4\.00 \(1\.00 M tokens\), \$1\.00 \(3\.00 M tokens\)/);
  assert.doesNotMatch(report, /\$1\.75/);
});

test("same-rate requests show as one rate despite floating-point noise", () => {
  const summary = collectUsage([
    assistant(usage({ input: 0.003 }, { input: 1_000 })),
    assistant(usage({ input: 0.006000000000000001 }, { input: 2_000 })),
  ]);
  assert.match(formatRates(summary), /Uncached input: \$3\.00 \(3\.00 K tokens\)\n/);
});

test("models are listed separately, and an unpriced model does not hide a priced one", () => {
  const summary = collectUsage([
    assistant(usage({}, { input: 1_000_000 }), "test", "unpriced"),
    assistant(usage({ input: 3 }, { input: 1_000_000 }), "test", "priced"),
  ]);
  const report = formatRates(summary);
  assert.match(report, /test\/priced\n  Uncached input: \$3\.00 \(1\.00 M tokens\)/);
  assert.match(report, /test\/unpriced\n  Uncached input: unknown \(1\.00 M tokens\)/);
});

test("the same model ID on different providers has separate rates", () => {
  const summary = collectUsage([
    assistant(usage({ input: 3 }, { input: 1_000_000 }), "provider-a", "same-model"),
    assistant(usage({ input: 8 }, { input: 2_000_000 }), "provider-b", "same-model"),
  ]);
  const report = formatRates(summary);
  assert.match(report, /provider-a\/same-model\n  Uncached input: \$3\.00 \(1\.00 M tokens\)/);
  assert.match(report, /provider-b\/same-model\n  Uncached input: \$4\.00 \(2\.00 M tokens\)/);
});

test("a record without a usable cost adds an unknown rate next to the known one", () => {
  const priced = usage({ input: 1 }, { input: 1_000_000 });
  const report = formatRates(collectUsage([assistant(priced), assistant(withoutCost(priced))]));
  assert.match(report, /Uncached input: \$1\.00 \(1\.00 M tokens\), unknown \(1\.00 M tokens\)/);
});

test("a missing component cost shows an unknown rate for that category only", () => {
  const valid = usage({ input: 1, output: 2 }, { input: 1_000_000, output: 500_000 });
  const report = formatRates(collectUsage([assistant(withoutCostComponent(valid, "output"))]));
  assert.match(report, /Uncached input: \$1\.00 \(1\.00 M tokens\)/);
  assert.match(report, /Output: unknown \(500\.00 K tokens\)/);
});

test("a cost without tokens avoids division by zero and shows an unknown rate", () => {
  const report = formatRates(collectUsage([assistant(usage({ input: 1 }))]));
  assert.match(report, /Uncached input: unknown \(cost without tokens\)/);
  assert.doesNotMatch(report, /NaN|Infinity/);
});

test("a model with no tokens and no costs shows that no rates are available", () => {
  assert.match(formatRates(collectUsage([assistant(usage())])), /test\/model\n  No rates available\./);
});

test("tiny rates never display as free", () => {
  const report = formatRates(collectUsage([assistant(usage({ input: 0.00000003 }, { input: 1_000_000 }))]));
  assert.match(report, /Uncached input: <\$0\.0001 \(1\.00 M tokens\)/);
});

test("a component mismatch warns", () => {
  const report = formatRates(collectUsage([assistant(usage({ input: 1, output: 2, total: 10 }, { input: 1_000_000 }))]));
  assert.match(report, /Warning: some cost components are missing or do not reconcile/);
  assert.doesNotMatch(formatRates(collectUsage([assistant(usage({ input: 1 }))])), /do not reconcile/);
});

test("an empty session says so", () => {
  assert.match(formatRates(collectUsage([])), /No model usage recorded yet/);
});

test("control characters from provider/model names are removed", () => {
  const report = formatRates(collectUsage([assistant(usage({ input: 1 }), "evil\x1b[2J", "model\nInjected line")]));
  assert.doesNotMatch(report, /[\x00-\x09\x0b-\x1f\x7f-\x9f]/);
  assert.match(report, /^evil\[2J\/modelInjected line$/m);
});
