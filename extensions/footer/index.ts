import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { renderFooter } from "./render.ts";
import { createFooterSnapshot } from "./snapshot.ts";

type FooterAPI = Pick<ExtensionAPI, "on" | "getSettings" | "getThinkingLevel">;

function isSubscription(ctx: ExtensionContext): boolean {
  const model = ctx.model;
  if (!model) return false;
  // Kimi Coding uses API keys but is still subscription-backed, matching Pi.
  return (
    model.provider === "kimi-coding" ||
    (ctx.modelRegistry.isUsingOAuth(model) &&
      ctx.modelRegistry.getProvider(model.provider)?.auth.oauth
        ?.isSubscription === true)
  );
}

/** Install through the supported footer API; never modify Pi's installed files. */
export function installFooter(
  ctx: ExtensionContext,
  pi: Pick<FooterAPI, "getSettings" | "getThinkingLevel">,
): void {
  if (ctx.mode !== "tui") return;
  ctx.ui.setFooter((tui, _theme, footerData) => {
    const unsubscribe = footerData.onBranchChange(() => tui.requestRender());
    const snapshot = createFooterSnapshot(ctx);

    return {
      dispose: unsubscribe,
      invalidate: snapshot.invalidate,
      render(width: number): string[] {
        const manager = ctx.sessionManager;
        const model = ctx.model;
        const cached = snapshot.read();
        const thinkingLevel = pi.getThinkingLevel();
        return renderFooter(
          {
            cwd: manager.getCwd(),
            home: process.env.HOME || process.env.USERPROFILE,
            branch: footerData.getGitBranch(),
            sessionName: manager.getSessionName(),
            stats: cached.stats,
            subscription: isSubscription(ctx),
            context: cached.context,
            contextWindow: model?.contextWindow ?? 0,
            autoCompact: pi.getSettings().compaction?.enabled ?? true,
            model: model
              ? {
                  id: model.id,
                  provider:
                    footerData.getAvailableProviderCount() > 1
                      ? model.provider
                      : undefined,
                  thinkingLevel: model.reasoning ? thinkingLevel : undefined,
                  route: cached.route,
                }
              : undefined,
            statuses: footerData.getExtensionStatuses(),
          },
          width,
          ctx.ui.theme,
        );
      },
    };
  });
}

export default function footerExtension(pi: FooterAPI): void {
  pi.on("session_start", (_event, ctx) => installFooter(ctx, pi));
}
