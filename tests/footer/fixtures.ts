import assert from "node:assert/strict";
import type { Component } from "@earendil-works/pi-tui";
import type {
  ContextUsage,
  ExtensionAPI,
  ExtensionContext,
  ExtensionUIContext,
  ReadonlyFooterDataProvider,
  SessionEntry,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { installFooter } from "../../extensions/footer/index.ts";
import { assistant, compaction, usage } from "../usage/fixtures.ts";

type Model = NonNullable<ExtensionContext["model"]>;
type Footer = Component & { dispose?(): void };
export const plain: Pick<Theme, "fg"> = { fg: (_color, text) => text };

export function setup(install = true) {
  let footer: Footer | undefined;
  let branchChanged: (() => void) | undefined;
  let renders = 0;
  let disposed = 0;
  let contextReads = 0;
  let thinkingReads = 0;
  let entries = [
    assistant(usage({ total: 0.123 }, { input: 100, cacheRead: 900 })),
  ];
  let branchEntries = entries;
  let leafId = "leaf1";
  let sessionId = "session1";
  let model = {
    id: "model",
    provider: "test",
    api: "test",
    reasoning: true,
    contextWindow: 200_000,
  } as Model;
  let context: ContextUsage = {
    tokens: 60_000,
    contextWindow: 200_000,
    percent: 30,
  };
  let thinking: ReturnType<ExtensionAPI["getThinkingLevel"]> = "high";
  let autoCompact = true;
  let oauth = false;
  let subscription = false;
  let theme = plain;
  const statuses = new Map<string, string>();
  const data: ReadonlyFooterDataProvider = {
    getGitBranch: () => "main",
    getExtensionStatuses: () => statuses,
    getAvailableProviderCount: () => 2,
    onBranchChange(callback) {
      branchChanged = callback;
      return () => {
        disposed++;
        branchChanged = undefined;
      };
    },
  };
  const setFooter: ExtensionUIContext["setFooter"] = (factory) => {
    footer?.dispose?.();
    // Fixture implements only requestRender, which is the only TUI method used here.
    const tui = {
      requestRender: () => {
        renders++;
      },
    } as Parameters<NonNullable<typeof factory>>[0];
    footer = factory?.(tui, theme as Theme, data);
  };
  const ctx = {
    mode: "tui",
    ui: {
      setFooter,
      get theme() {
        return theme;
      },
    },
    get model() {
      return model;
    },
    sessionManager: {
      getSessionId: () => sessionId,
      getLeafId: () => leafId,
      getCwd: () => "/tmp/project",
      getSessionName: () => "Session",
      getEntries: () => entries,
      buildSessionProjection: () => ({
        messages: branchEntries
          .filter((e) => e.type === "message")
          .map((e) => e.message),
      }),
    },
    modelRegistry: {
      isUsingOAuth: () => oauth,
      getProvider: () => ({
        auth: { oauth: { isSubscription: subscription } },
      }),
      find: () => model,
    },
    getContextUsage() {
      contextReads++;
      return context;
    },
  } as unknown as ExtensionContext;
  const pi = {
    getSettings: () => ({ compaction: { enabled: autoCompact } }),
    getThinkingLevel() {
      thinkingReads++;
      return thinking;
    },
  } as Pick<ExtensionAPI, "getSettings" | "getThinkingLevel">;
  if (install) installFooter(ctx, pi);
  function render(width = 140) {
    assert.ok(footer);
    return footer.render(width).join("\n");
  }
  function appendEntry(entry: SessionEntry, keepLeaf = false) {
    entries = [...entries, entry];
    if (!keepLeaf) {
      branchEntries = [...branchEntries, entry];
      leafId = entry.id;
    }
  }
  return {
    ctx,
    pi,
    render,
    statuses,
    appendEntry,
    get footer() {
      assert.ok(footer);
      return footer;
    },
    get contextReads() {
      return contextReads;
    },
    get thinkingReads() {
      return thinkingReads;
    },
    get renders() {
      return renders;
    },
    get disposed() {
      return disposed;
    },
    branchChange() {
      assert.ok(branchChanged);
      branchChanged();
    },
    append(keepLeaf = false) {
      appendEntry(assistant(usage({ total: 0.2 }, { input: 100 })), keepLeaf);
    },
    navigate(id: string, activeEntries: SessionEntry[] = []) {
      leafId = id;
      branchEntries = activeEntries;
    },
    compact() {
      appendEntry(compaction());
      context = { tokens: null, percent: null, contextWindow: 200_000 };
    },
    switchSession() {
      sessionId = "session2";
      entries = [];
      branchEntries = [];
      context = { tokens: 0, percent: 0, contextWindow: 200_000 };
    },
    switchModel(overrides: Partial<Model>) {
      model = { ...model, ...overrides };
      context = { ...context, contextWindow: model.contextWindow };
    },
    setThinking(level: typeof thinking) {
      thinking = level;
    },
    setAuto(value: boolean) {
      autoCompact = value;
    },
    setAuth(usingOAuth: boolean, isSubscription: boolean) {
      oauth = usingOAuth;
      subscription = isSubscription;
    },
    setTheme(value: typeof plain) {
      theme = value;
    },
  };
}
