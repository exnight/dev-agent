export const TOKEN_COMPONENTS = ["input", "output", "cacheRead", "cacheWrite"] as const;
export type TokenComponent = (typeof TOKEN_COMPONENTS)[number];

export type UsageSource = "main" | "tool" | "summary" | "other";

/** Tokens and recorded estimated USD (not an invoiced charge) that share one derived rate. */
export interface RateGroup {
  tokens: number;
  recordedCost: number;
}

/** Derived rates for one token category. */
export interface CategoryRates {
  /** Key: derived USD per million tokens. Distinct historical/tier rates stay separate. */
  known: Map<number, RateGroup>;
  /** Records whose rate cannot be derived: no usable cost, a zero recorded total, or no tokens. */
  unknown: RateGroup;
}

export interface UsageDiagnostics {
  missingCostRecords: number;
  zeroCostRecords: number;
  incompleteBreakdownRecords: number;
}

export interface UsageTotals {
  /** Usage records, not necessarily individual API calls. */
  recordCount: number;
  tokens: Record<TokenComponent, number>;
  /** Pi's recorded USD estimates. Catalog prices used for them can be outdated. */
  recordedCosts: Record<TokenComponent | "total", number>;
  rateGroups: Record<TokenComponent, CategoryRates>;
  diagnostics: UsageDiagnostics;
}

export interface UsageSummary {
  sessionTotals: UsageTotals;
  /** Key: "provider/model", or UNATTRIBUTED_LABEL for tool/summary usage without a model. */
  modelBreakdowns: Map<string, UsageTotals>;
  sourceBreakdowns: Map<UsageSource, UsageTotals>;
}
