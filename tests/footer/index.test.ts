import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import footerExtension, {
  installFooter,
} from "../../extensions/footer/index.ts";
import { setup } from "./fixtures.ts";

test("session_start installs a functioning footer", async () => {
  const state = setup(false);
  type StartHandler = (
    event: { type: "session_start" },
    ctx: ExtensionContext,
  ) => unknown;
  let start: StartHandler | undefined;
  footerExtension({
    ...state.pi,
    on: ((event: string, handler: StartHandler) => {
      if (event === "session_start") start = handler;
      return () => {};
    }) as ExtensionAPI["on"],
  });
  assert.ok(start);
  await start({ type: "session_start" }, state.ctx);
  assert.match(state.render(), /Cache 90\.0% \$0\.123/);
});

test("RPC, print and JSON never install terminal UI or read session data", () => {
  for (const mode of ["rpc", "print", "json"] as const) {
    const ctx = {
      mode,
      get ui() {
        throw new Error("Terminal UI unavailable");
      },
    } as unknown as ExtensionContext;
    installFooter(ctx, {
      getSettings: () => {
        throw new Error("Unused");
      },
      getThinkingLevel: () => "off",
    });
  }
});

test("history and occupancy update after appends, model changes, and session changes", () => {
  const state = setup();
  assert.match(state.render(), /Cache 90\.0% \$0\.123/);
  state.append();
  assert.match(state.render(), /Cache 0\.0% \$0\.323/);
  state.switchModel({ contextWindow: 1_000_000 });
  assert.match(state.render(), /6\.0%\/1\.0M/);
  state.switchSession();
  assert.match(state.render(), /Cache \u2014/);
  assert.doesNotMatch(state.render(), /\$/);
});

test("compaction shows unknown occupancy while preserving historical cost", () => {
  const state = setup();
  state.render();
  state.compact();
  assert.match(state.render(), /\?\/200k/);
  assert.match(state.render(), /\$0\.123/);
});

test("thinking and auto compaction settings remain live even without new entries", () => {
  const state = setup();
  state.render();
  state.setThinking("low");
  state.setAuto(false);
  assert.match(state.render(), /model \u2022 low/);
  assert.doesNotMatch(state.render(), /\(auto\)/);
  state.setThinking("off");
  assert.match(state.render(), /thinking off/);
});

test("subscription marker matches provider metadata, not OAuth alone", () => {
  const state = setup();
  state.setAuth(true, false);
  assert.doesNotMatch(state.render(), /\(sub\)/);
  state.setAuth(true, true);
  assert.match(state.render(), /\$0\.123 \(sub\)/);
  state.setAuth(false, true);
  assert.doesNotMatch(state.render(), /\(sub\)/);
  state.switchModel({ provider: "kimi-coding" });
  assert.match(state.render(), /\(sub\)/);
});

test("live theme and extension statuses are not frozen in the cached stats", () => {
  const state = setup();
  state.render();
  state.statuses.set("mode", "custom-status");
  state.setTheme({ fg: (_color, text) => `\x1b[32m${text}\x1b[0m` });
  const output = state.render();
  assert.match(output, /\x1b\[32m/);
  assert.match(output, /custom-status/);
  assert.equal(state.contextReads, 1);
});

test("branch subscription requests rendering and is released on replacement/disposal", () => {
  const state = setup();
  state.branchChange();
  assert.equal(state.renders, 1);
  installFooter(state.ctx, state.pi);
  assert.equal(state.disposed, 1);
  state.footer.dispose?.();
  assert.equal(state.disposed, 2);
});

test("thinking level is read once per frame and omitted for non-reasoning models", () => {
  const state = setup();
  state.render();
  assert.equal(state.thinkingReads, 1);
  state.switchModel({ reasoning: false });
  assert.doesNotMatch(state.render(), /high|thinking off/);
  assert.equal(state.thinkingReads, 2);
});

test("missing model renders a fallback without subscription notation", () => {
  const state = setup(false);
  installFooter({ ...state.ctx, model: undefined }, state.pi);
  assert.match(state.render(), /no-model/);
  assert.doesNotMatch(state.render(), /\(sub\)/);
});

test("virtual model selection preserves the routed model on the active context", () => {
  const state = setup();
  state.switchModel({ id: "router", api: "pi-virtual" });
  assert.match(state.render(), /router \u2022 high \u2192 model/);
});
