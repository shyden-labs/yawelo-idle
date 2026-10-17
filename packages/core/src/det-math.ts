import stdlibExp from '@stdlib/math-base-special-exp';
import stdlibExpm1 from '@stdlib/math-base-special-expm1';
import stdlibLn from '@stdlib/math-base-special-ln';
import stdlibLog10 from '@stdlib/math-base-special-log10';
import stdlibLog1p from '@stdlib/math-base-special-log1p';
import stdlibPow from '@stdlib/math-base-special-pow';

/**
 * Deterministic transcendental functions (M1 design §2.1, D-M1-1).
 *
 * ECMAScript leaves Math.pow, exp and log implementation-approximated, and
 * the engines disagree: Math.pow(1.15, n) differed in 49,204 of 100,000
 * results between V8 and JavaScriptCore. Ranked replay runs an iPhone's events
 * on Cloudflare's V8, so one differing bit can flip a purchase. The @stdlib
 * ports are plain JavaScript built on + - * / and bit operations, which every
 * engine rounds identically (0 differences in 2,000,000 per function).
 *
 * Nothing else in packages/core/src may call a transcendental: an ESLint rule
 * bans the Math forms and the `**` operator there.
 */

/**
 * base raised to exponent, with the special values of ECMAScript's `**`.
 *
 * @stdlib follows C99 where the two differ: it returns 1 for pow(1, ±Infinity)
 * and NaN for pow(NaN, ±0), where ECMAScript says NaN and 1. Core keeps the
 * language's rule, so replacing `x ** y` with `pow(x, y)` never changes a
 * value.
 */
export function pow(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  if ((base === 1 || base === -1) && !Number.isFinite(exponent)) return NaN;
  return stdlibPow(base, exponent);
}

/** e raised to x. */
export function exp(x: number): number {
  return stdlibExp(x);
}

/** Natural logarithm. */
export function ln(x: number): number {
  return stdlibLn(x);
}

/** Base-10 logarithm. */
export function log10(x: number): number {
  return stdlibLog10(x);
}

/** e^x - 1, accurate where x is near 0. */
export function expm1(x: number): number {
  return stdlibExpm1(x);
}

/** ln(1 + x), accurate where x is near 0. */
export function log1p(x: number): number {
  return stdlibLog1p(x);
}
