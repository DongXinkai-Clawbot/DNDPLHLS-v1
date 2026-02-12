import { RoughnessConstants } from './types';

/**
 * For exp() clamp: Math.log(Number.MIN_VALUE) is the largest negative exponent that still
 * produces a non-zero float64 on all compliant JS engines.
 */
export const DEFAULT_EXP_CLAMP_MIN = Math.log(Number.MIN_VALUE);

export const STANDARD_CONSTANTS: RoughnessConstants = {
  a: 3.5,
  b: 5.75,
  dStar: 0.24,
  s1: 0.021,
  s2: 19,
  expClampMin: DEFAULT_EXP_CLAMP_MIN
};

export const validateConstants = (c: RoughnessConstants) => {
  const checkPos = (name: keyof RoughnessConstants, v: number) => {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(`Invalid roughness constant: ${name} must be positive`);
    }
  };
  checkPos('a', c.a);
  checkPos('b', c.b);
  checkPos('dStar', c.dStar);
  checkPos('s1', c.s1);
  checkPos('s2', c.s2);

  if (!(c.b > c.a)) {
    throw new Error('Invalid roughness constants: b must be greater than a (otherwise the kernel flips sign)');
  }

  if (c.expClampMin !== undefined) {
    if (!Number.isFinite(c.expClampMin) || c.expClampMin >= 0) {
      throw new Error('Invalid roughness constant: expClampMin must be negative');
    }
  }
};

export const isStandardConstants = (c: RoughnessConstants) => {
  const tol = 1e-12;
  return (
    Math.abs(c.a - STANDARD_CONSTANTS.a) <= tol &&
    Math.abs(c.b - STANDARD_CONSTANTS.b) <= tol &&
    Math.abs(c.dStar - STANDARD_CONSTANTS.dStar) <= tol &&
    Math.abs(c.s1 - STANDARD_CONSTANTS.s1) <= tol &&
    Math.abs(c.s2 - STANDARD_CONSTANTS.s2) <= tol
  );
};
