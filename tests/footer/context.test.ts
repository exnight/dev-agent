import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contextCells,
  contextState,
  formatCapacity,
  SMART_ZONE_TOKENS,
} from "../../extensions/footer/context.ts";

test("within and exactly at the threshold uses success; only overflow is warning", () => {
  assert.equal(SMART_ZONE_TOKENS, 128_000);
  for (const tokens of [1, 60_000, 127_999, 128_000]) {
    const cells = contextCells(contextState(tokens, 200_000), 16);
    assert.ok(cells.success > 0);
    assert.equal(cells.warning, 0);
  }
  for (const tokens of [128_001, 190_000, 200_000, 250_000]) {
    const cells = contextCells(contextState(tokens, 200_000), 16);
    assert.ok(cells.success > 0);
    assert.ok(cells.warning > 0);
  }
});

test("small windows have no warning state", () => {
  for (const maximum of [32_000, 128_000]) {
    assert.deepEqual(contextCells(contextState(maximum, maximum), 16), {
      success: 16,
      warning: 0,
      empty: 0,
    });
  }
});

test("invalid or unknown occupancy is normalized consistently for bar and number", () => {
  for (const tokens of [null, NaN, Infinity, -1]) {
    const context = contextState(tokens, 200_000);
    assert.equal(context.percent, null);
    assert.deepEqual(contextCells(context, 8), {
      success: 0,
      warning: 0,
      empty: 8,
    });
  }
  for (const maximum of [0, -1, NaN, Infinity]) {
    assert.deepEqual(contextState(100, maximum), {
      tokens: null,
      percent: null,
      maximum: 0,
    });
  }
  assert.equal(contextState(0, 200_000).percent, 0);
});

test("cell counts are bounded and sum to the requested size", () => {
  for (const size of [0, 1, 4, 8, 16]) {
    for (const maximum of [32_000, 128_001, 200_000, 1_000_000]) {
      for (const tokens of [null, 0, 1, 128_000, 128_001, 2_000_000]) {
        const cells = contextCells(contextState(tokens, maximum), size);
        assert.equal(cells.success + cells.warning + cells.empty, size);
        assert.ok(
          Object.values(cells).every(
            (count) => Number.isInteger(count) && count >= 0,
          ),
        );
      }
    }
  }
  assert.deepEqual(contextCells(contextState(128_001, 200_000), 1), {
    success: 0,
    warning: 1,
    empty: 0,
  });
});

test("context capacities keep Pi's original numeric formatting", () => {
  assert.equal(formatCapacity(200_000), "200k");
  assert.equal(formatCapacity(1_000_000), "1.0M");
  assert.equal(formatCapacity(8192), "8.2k");
});
