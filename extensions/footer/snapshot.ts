import type {
  ContextUsage,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { collectFooterStats, type FooterStats } from "./stats.ts";
import type { ModelIdentity } from "./view.ts";

type Model = ExtensionContext["model"];

/** Resolve the latest successful physical response from the active projection. */
function latestRoute(ctx: ExtensionContext): ModelIdentity | undefined {
  if (ctx.model?.api !== "pi-virtual") return undefined;
  const messages = ctx.sessionManager.buildSessionProjection().messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (
      message?.role !== "assistant" ||
      message.stopReason === "error" ||
      message.stopReason === "aborted"
    )
      continue;
    if (!ctx.modelRegistry.find(message.provider, message.model))
      return undefined;
    return { id: message.model, thinkingLevel: message.thinkingLevel };
  }
  return undefined;
}

/** Historical cost is independent of branch selection, model selection, and theme. */
export function createFooterSnapshot(ctx: ExtensionContext) {
  let history:
    | {
        manager: ExtensionContext["sessionManager"];
        sessionId: string;
        entryCount: number;
        stats: FooterStats;
      }
    | undefined;
  let active:
    | {
        history: typeof history;
        leafId: string | null;
        model: Model;
        context: ContextUsage | undefined;
        route: ModelIdentity | undefined;
      }
    | undefined;

  return {
    // UI invalidation can refresh the active projection without rescanning recorded usage.
    invalidate() {
      active = undefined;
    },
    read() {
      const manager = ctx.sessionManager;
      const sessionId = manager.getSessionId();
      const leafId = manager.getLeafId();
      const model = ctx.model;
      // Pi 1.1's readonly extension API has no getEntryCount(). Read the public snapshot
      // to detect appends even when navigation returns to the previously rendered leaf.
      const entries = manager.getEntries();
      if (
        !history ||
        history.manager !== manager ||
        history.sessionId !== sessionId ||
        history.entryCount !== entries.length
      ) {
        history = {
          manager,
          sessionId,
          entryCount: entries.length,
          stats: collectFooterStats(entries),
        };
      }
      if (
        !active ||
        active.history !== history ||
        active.leafId !== leafId ||
        active.model !== model
      ) {
        active = {
          history,
          leafId,
          model,
          context: ctx.getContextUsage(),
          route: latestRoute(ctx),
        };
      }
      return {
        stats: history.stats,
        context: active.context,
        route: active.route,
      };
    },
  };
}
