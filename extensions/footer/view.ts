import type { ContextUsage, Theme } from "@earendil-works/pi-coding-agent";
import type { FooterStats } from "./stats.ts";

export type FooterTheme = Pick<Theme, "fg">;

export interface ModelIdentity {
  id: string;
  thinkingLevel: string | undefined;
}

export interface FooterModel extends ModelIdentity {
  provider: string | undefined;
  route: ModelIdentity | undefined;
}

/** Plain data only; labels, separators, colors, and layout belong to rendering. */
export interface FooterView {
  cwd: string;
  home: string | undefined;
  branch: string | null;
  sessionName: string | undefined;
  stats: FooterStats;
  subscription: boolean;
  context: ContextUsage | undefined;
  contextWindow: number;
  autoCompact: boolean;
  model: FooterModel | undefined;
  statuses: ReadonlyMap<string, string>;
}
