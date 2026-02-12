export const SAFE_MIN_GAIN = 0.0001;
export const HARD_MAX_POLY = 32;
export const HARD_MAX_PARTIALS = 64;
export const PARTIAL_BUDGET = 192;
export const PARTIAL_BUDGET_QUALITY: Record<'high' | 'balanced' | 'performance', number> = {
  high: 1.0,
  balanced: 0.8,
  performance: 0.6
};
