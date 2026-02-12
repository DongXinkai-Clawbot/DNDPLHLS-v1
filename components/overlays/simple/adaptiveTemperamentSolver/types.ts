export type UiRatioSpec = {
  n: number;
  d: number;
  label: string;
  defaultOn?: boolean;
  tolerance?: number;  // Individual tolerance in cents (optional)
};

export type AdvancedIntervalItem = {
  id: string;
  degree: number;
  n: number;
  d: number;
  toleranceCents: number;
  priority: number;
  maxErrorCents?: number;
};

export type OctaPadProps = {
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
};

export type TargetItem = {
  id: string;
  n: number;
  d: number;
  centsIdeal: number;
  step: number;
  enabled: boolean;
  label: string;
};
