import { isAbsolute, relative, resolve, sep } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import {
  contextCells,
  contextState,
  formatCapacity,
  type ContextState,
} from "./context.ts";
import type { FooterTheme, FooterView, ModelIdentity } from "./view.ts";

const FULL_BAR = 16;
const SHORT_BAR = 8;
const MINIMUM_BAR = 4;

/** Plain labels must not retain escape-sequence payloads or terminal controls. */
function label(text: string): string {
  return stripVTControlCharacters(text)
    .replace(/[\r\n\t]/g, " ")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, "")
    .replace(/ +/g, " ")
    .trim();
}

function locationText(view: FooterView): string {
  let cwd = view.cwd;
  if (view.home) {
    const path = relative(resolve(view.home), resolve(cwd));
    if (
      path === "" ||
      (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
    ) {
      cwd = path === "" ? "~" : `~${sep}${path}`;
    }
  }
  if (view.branch) cwd += ` (${view.branch})`;
  if (view.sessionName) cwd += ` \u2022 ${view.sessionName}`;
  return label(cwd);
}

function modelIdentity(model: ModelIdentity, selected: boolean): string {
  const thinking =
    selected && model.thinkingLevel === "off"
      ? "thinking off"
      : model.thinkingLevel;
  return label(model.id) + (thinking ? ` \u2022 ${label(thinking)}` : "");
}

function modelText(view: FooterView, showProvider: boolean): string {
  const model = view.model;
  if (!model) return "no-model";
  const provider =
    showProvider && model.provider ? `(${label(model.provider)}) ` : "";
  const route = model.route
    ? ` \u2192 ${modelIdentity(model.route, false)}`
    : "";
  return `${provider}${modelIdentity(model, true)}${route}`;
}

function renderContextBar(
  context: ContextState,
  cells: number,
  theme: FooterTheme,
): string {
  const counts = contextCells(context, cells);
  const part = (color: "success" | "warning" | "dim", count: number) =>
    count > 0 ? theme.fg(color, "\u2588".repeat(count)) : "";
  return (
    part("success", counts.success) +
    part("warning", counts.warning) +
    part("dim", counts.empty)
  );
}

function contextText(
  context: ContextState,
  cells: number,
  auto: boolean,
  theme: FooterTheme,
): string {
  const percent =
    context.percent === null ? "?" : `${context.percent.toFixed(1)}%`;
  const maximum = context.maximum > 0 ? formatCapacity(context.maximum) : "?";
  const number = theme.fg(
    "text",
    `${percent}/${maximum}${auto ? " (auto)" : ""}`,
  );
  return cells > 0
    ? `${renderContextBar(context, cells, theme)} ${number}`
    : number;
}

function metricsText(view: FooterView, theme: FooterTheme): string {
  const cache =
    view.stats.cacheHitRate === undefined
      ? "\u2014"
      : `${view.stats.cacheHitRate.toFixed(1)}%`;
  const cost =
    view.stats.cost || view.subscription
      ? ` $${view.stats.cost.toFixed(3)}${view.subscription ? " (sub)" : ""}`
      : "";
  return theme.fg("muted", `Cache ${cache}${cost}`);
}

function joinSides(
  left: string,
  right: string,
  width: number,
): string | undefined {
  const padding = width - visibleWidth(left) - visibleWidth(right);
  return padding >= 2 ? left + " ".repeat(padding) + right : undefined;
}

function firstFit(
  candidates: readonly string[],
  width: number,
): string | undefined {
  return candidates.find((text) => visibleWidth(text) <= width);
}

/** Stateless rendering: theme colors and responsive layout are rebuilt on every frame. */
export function renderFooter(
  view: FooterView,
  width: number,
  theme: FooterTheme,
): string[] {
  if (width <= 0) return [];
  const clip = (text: string) =>
    truncateToWidth(text, width, theme.fg("dim", "\u2026"));
  const lines = [clip(theme.fg("muted", locationText(view)))];
  const usage = metricsText(view, theme);
  const model = theme.fg("muted", modelText(view, false));
  const providerModel = theme.fg("muted", modelText(view, true));
  const normalized = contextState(
    view.context?.tokens ?? null,
    view.context?.contextWindow ?? view.contextWindow,
  );
  const context = (cells: number, showAuto = true) =>
    contextText(normalized, cells, view.autoCompact && showAuto, theme);
  const fullContext = context(FULL_BAR);
  const shortContext = context(SHORT_BAR);
  const fullMetrics = `${usage}  ${fullContext}`;
  const shortMetrics = `${usage}  ${shortContext}`;

  // Preserve provider identity by shortening the bar before omitting the provider.
  const inline = [
    [fullMetrics, providerModel],
    [shortMetrics, providerModel],
    [shortMetrics, model],
  ] as const;
  for (const [left, right] of inline) {
    const joined = joinSides(left, right, width);
    if (joined !== undefined) {
      lines.push(joined);
      return withStatuses(lines, view, clip);
    }
  }

  // Add a model row before splitting metrics; restore full identity on that row.
  const combined = firstFit([fullMetrics, shortMetrics], width);
  if (combined !== undefined) {
    lines.push(combined);
  } else {
    lines.push(clip(usage));
    // Numeric capacity wins over the bar and (auto) when space is very limited.
    const numeric = context(0, false);
    const candidates = [
      fullContext,
      shortContext,
      context(MINIMUM_BAR),
      numeric,
    ];
    lines.push(clip(firstFit(candidates, width) ?? numeric));
  }
  lines.push(clip(providerModel));
  return withStatuses(lines, view, clip);
}

function withStatuses(
  lines: string[],
  view: FooterView,
  clip: (text: string) => string,
): string[] {
  if (view.statuses.size > 0) {
    // Status texts can contain intentional ANSI colors supplied by other extensions.
    const statuses = [...view.statuses]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, text]) =>
        text
          .replace(/[\r\n\t]/g, " ")
          .replace(/ +/g, " ")
          .trim(),
      )
      .join(" ");
    lines.push(clip(statuses));
  }
  return lines;
}
