export const SMART_ZONE_TOKENS = 128_000;

export interface ContextState {
  tokens: number | null;
  maximum: number;
  percent: number | null;
}

/** Normalize once so the numeric label and bar agree about unknown occupancy. */
export function contextState(
  tokens: number | null,
  maximum: number,
): ContextState {
  const validMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 0;
  const known =
    tokens !== null &&
    Number.isFinite(tokens) &&
    tokens >= 0 &&
    validMaximum > 0;
  return {
    tokens: known ? tokens : null,
    maximum: validMaximum,
    percent: known ? (tokens / validMaximum) * 100 : null,
  };
}

/** Cell counts are independent of terminal styling and always sum to the requested size. */
export function contextCells(context: ContextState, size: number) {
  const cells = Number.isFinite(size) ? Math.max(0, Math.floor(size)) : 0;
  const { tokens, maximum } = context;
  if (cells === 0 || tokens === null || tokens === 0)
    return { success: 0, warning: 0, empty: cells };
  const overflow = maximum > SMART_ZONE_TOKENS && tokens > SMART_ZONE_TOKENS;
  if (cells === 1)
    return { success: overflow ? 0 : 1, warning: overflow ? 1 : 0, empty: 0 };

  const smartCells =
    maximum > SMART_ZONE_TOKENS
      ? Math.max(
          1,
          Math.min(
            cells - 1,
            Math.round((SMART_ZONE_TOKENS / maximum) * cells),
          ),
        )
      : cells;
  let filled = Math.max(1, Math.round(Math.min(tokens / maximum, 1) * cells));
  if (maximum > SMART_ZONE_TOKENS) {
    // Quantization must not imply a threshold crossing on the wrong side.
    filled = overflow
      ? Math.max(smartCells + 1, filled)
      : Math.min(smartCells, filled);
  }
  const success = Math.min(smartCells, filled);
  return { success, warning: filled - success, empty: cells - filled };
}

/** Match Pi's existing compact context-capacity format. */
export function formatCapacity(count: number): string {
  if (count < 1000) return String(count);
  if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000_000)}M`;
}
