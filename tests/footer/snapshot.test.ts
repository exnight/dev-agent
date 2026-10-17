import assert from "node:assert/strict";
import { test } from "node:test";
import { createFooterSnapshot } from "../../extensions/footer/snapshot.ts";
import { setup } from "./fixtures.ts";
import { assistant, usage } from "../usage/fixtures.ts";

test("whole-session statistics remain cached across navigation, model, and UI invalidation", () => {
  const state = setup(false);
  const snapshot = createFooterSnapshot(state.ctx);
  const initial = snapshot.read();
  assert.equal(snapshot.read().stats, initial.stats);
  assert.equal(state.contextReads, 1);

  state.navigate("other-leaf");
  assert.equal(snapshot.read().stats, initial.stats);
  assert.equal(state.contextReads, 2);
  state.switchModel({ contextWindow: 1_000_000 });
  assert.equal(snapshot.read().stats, initial.stats);
  assert.equal(snapshot.read().context?.contextWindow, 1_000_000);
  assert.equal(state.contextReads, 3);

  snapshot.invalidate();
  assert.equal(snapshot.read().stats, initial.stats);
  assert.equal(state.contextReads, 4);
});

test("new records refresh totals even when the final leaf is unchanged", () => {
  const state = setup(false);
  const snapshot = createFooterSnapshot(state.ctx);
  const initial = snapshot.read();
  state.append(true);
  const updated = snapshot.read();
  assert.notEqual(updated.stats, initial.stats);
  assert.deepEqual(updated.stats, { cost: 0.323, cacheHitRate: 0 });
  assert.equal(state.contextReads, 2);
});

test("session replacement refreshes history even with the same entry count and leaf", () => {
  const state = setup(false);
  const snapshot = createFooterSnapshot(state.ctx);
  const initial = snapshot.read();
  state.switchSession();
  state.append(true);
  const updated = snapshot.read();
  assert.notEqual(updated.stats, initial.stats);
  assert.equal(updated.stats.cost, 0.2);
});

test("cost includes abandoned branches while routing follows only the active projection", () => {
  const state = setup(false);
  state.switchModel({ api: "pi-virtual" });
  const base = state.ctx.sessionManager.getEntries();
  const active = assistant(usage({ total: 1 }), "test", "active-model", {
    thinkingLevel: "low",
  });
  const abandoned = assistant(usage({ total: 2 }), "test", "other-model", {
    thinkingLevel: "high",
  });
  state.appendEntry(active);
  const snapshot = createFooterSnapshot(state.ctx);
  assert.deepEqual(snapshot.read().route, {
    id: "active-model",
    thinkingLevel: "low",
  });

  state.appendEntry(abandoned, true);
  const updated = snapshot.read();
  assert.equal(updated.stats.cost, 3.123);
  assert.deepEqual(updated.route, { id: "active-model", thinkingLevel: "low" });

  state.navigate("other-branch", [...base, abandoned]);
  assert.equal(snapshot.read().stats, updated.stats);
  assert.deepEqual(snapshot.read().route, {
    id: "other-model",
    thinkingLevel: "high",
  });
  state.navigate("empty-branch");
  assert.equal(snapshot.read().route, undefined);
});

test("routing skips failed responses, unknown models, and non-virtual selections", () => {
  const state = setup(false);
  state.appendEntry(
    assistant(usage(), "test", "physical", { thinkingLevel: "low" }),
  );
  state.appendEntry(
    assistant(usage(), "test", "failed", { stopReason: "error" }),
  );
  state.appendEntry(
    assistant(usage(), "test", "aborted", { stopReason: "aborted" }),
  );
  const snapshot = createFooterSnapshot(state.ctx);
  assert.equal(snapshot.read().route, undefined);
  state.switchModel({ api: "pi-virtual" });
  assert.deepEqual(snapshot.read().route, {
    id: "physical",
    thinkingLevel: "low",
  });
  state.ctx.modelRegistry.find = () => undefined;
  snapshot.invalidate();
  assert.equal(snapshot.read().route, undefined);
});
