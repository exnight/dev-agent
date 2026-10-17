# Context footer

Replaces Pi's footer in interactive terminal mode. It loads automatically with this Pi package. Run `/reload` in an existing session to activate it.

## Display

```text
~/project (main) • Session name
Cache 92.0% $0.123  ████████████████ 30.0%/200k (auto)     (provider) model • high
```

- No cumulative input, output, cache-read, or cache-write token counters.
- `Cache` is the latest assistant response's cache hit rate: cache-read / (input + cache-read + cache-write). Output tokens are excluded. No measurement shows a dash; a measured miss shows `0.0%`.
- Cost keeps Pi's existing display: three decimal places, `(sub)` for subscription-backed access, and omitted when zero unless using a subscription. It sums recorded estimates across the whole session, including all branches, compaction, summary, tool, and cache-warming usage. It is not an invoice.
- The bar is a continuous strip of solid color cells, without brackets, line glyphs, a separator, or a `Context` label. Unfilled cells use the theme's grey `dim` color. It represents current context occupancy, not cumulative token use. The number after `/` is still the model's maximum context capacity.
- The smart-zone ceiling is **128,000 tokens**. Filled cells within it use the theme's `success` color; filled cells beyond it use `warning`. There is no red state. Custom themes determine the actual hues.
- Fill is approximate at cell resolution. Crossing the threshold always shows at least one warning cell; the green-to-amber transition indicates overflow without a separate marker.
- Models with context windows of 128k or smaller have no warning section.
- Unknown context usage, such as just after compaction, uses a neutral grey bar and `?/maximum`, rather than implying a measured `0%`.
- `(auto)` continues to reflect Pi's automatic compaction setting. The smart zone is display-only: it never triggers compaction or changes model behavior.

The directory, Git branch, session name, model, thinking level, virtual model route, and other extensions' statuses are retained. Context numbers use the theme's `text` color; other footer labels use `muted`. Only unfilled cells and truncation markers use `dim`.

Narrow layouts shorten the bar from 16 to 8 cells before omitting the provider. If the row still does not fit, the model moves to its own row and the provider is restored. Metrics can then split across rows, with 16-, 8-, or 4-cell bars. At very narrow widths the bar and `(auto)` are omitted before clipping the numeric context capacity.

Plain labels strip ANSI sequences and flatten whitespace. Extension statuses preserve their supplied ANSI styling. The solid-cell bar communicates fill and threshold crossing through color; numeric occupancy remains available, but the threshold has no separate non-color indicator.

The bar style is an initial implementation; its final visual design is not settled.

## Implementation

- `index.ts`: installs through `ctx.ui.setFooter()`, owns branch subscription disposal, and assembles structured view data from live settings, model/authentication metadata, theme, and extension statuses.
- `snapshot.ts`: caches whole-session statistics by session-manager identity, session ID, and entry count. Active context and route lookup additionally depend on the leaf and selected model. Routes come only from successful responses in the active projection. UI invalidation refreshes that projection without discarding historical statistics.
- `stats.ts`: whole-session recorded costs and latest-response cache hit rate. Keeps its small usage-entry classification local, so the footer has no dependency on `/usage` or shared extension files.
- `view.ts`: the plain-data rendering contract.
- `context.ts`: context normalization, bar-cell calculations, and `SMART_ZONE_TOKENS`. Change this constant to adjust the threshold for now.
- `render.ts`: private label/formatting helpers, sanitization, semantic styling, and ordered layout choices. Normalizes context once per render and reuses the full and short context segments across layout candidates.

Pi 1.1's public readonly session API does not expose an entry count. Each render therefore reads `getEntries()` to detect changes, including appends followed by navigation back to the same leaf. This copies the entries array, but the usage aggregation is reused until the history changes. The cache assumes Pi's append-only session entries.

RPC, print, and JSON modes are unchanged. No Pi installation files or personal settings need modification.

The extension is self-contained: you can copy the entire `footer/` directory into another Pi extensions directory without copying `/usage` or other project files.

To try only this extension:

```sh
pi --no-extensions -e ./extensions/footer
```

To disable it for the installed package, use `pi config` and disable its footer resource. Pi will use its built-in footer after reload.

## Checks

```sh
npm run typecheck
npm test
```

Footer tests are grouped by behavior: statistics, context calculations, rendering/layout, labels/styling, Pi integration, and snapshots/routing. They cover threshold boundaries, same-leaf history changes, abandoned-branch costs versus active-branch routing, compaction, model and session changes, subscription notation, live settings and themes, branch subscription disposal, sanitization, fixed layout boundaries, and width limits. Separate theme and discovery tests verify text contrast and standalone extension loading.
