import { expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { exp, expm1, ln, log10, log1p, pow } from '../src/det-math';

/**
 * What det-math must satisfy at one input (M1 design §2.1, #26 AC2): its
 * result lies within 2 ulp of the true value rounded to a double. The unit
 * suite checks chosen inputs (det-math.test.ts) and the properties suite
 * random ones (properties/det-math.test.ts, #543), through the same checks.
 *
 * The reference is decimal.js at 60+ significant digits, fed the input's
 * EXACT value: `new Decimal(1.15)` would read the shortest string "1.15",
 * which is 7.7e-17 away from the double, and pow(1.15, 5000) multiplies that
 * gap into thousands of ulp. `toPrecision(40)` is correctly rounded by
 * ECMAScript, so 40 digits carry the double exactly enough.
 */

export type Unary = 'exp' | 'ln' | 'log10' | 'expm1' | 'log1p';

const bits = new Float64Array(1);
const words = new BigInt64Array(bits.buffer);

/** Maps a double to an integer whose order matches the doubles' order. */
function ordered(x: number): bigint {
  bits[0] = x;
  const raw = words[0] ?? 0n;
  return raw < 0n ? -(raw & 0x7fffffffffffffffn) : raw;
}

export function ulps(a: number, b: number): bigint {
  const d = ordered(a) - ordered(b);
  return d < 0n ? -d : d;
}

/**
 * Significant digits for the reference. 1 + x and e^x - 1 near x = 0 need
 * one more digit per decade of smallness, or they cancel to nothing; the
 * other functions need no more than 60, and asking for 383 digits makes
 * decimal.js's ln take 27 ms a call (measured).
 */
function digitsFor(fn: Unary, x: number): number {
  if ((fn !== 'expm1' && fn !== 'log1p') || x === 0) return 60;
  return 60 + Math.max(0, Math.floor(-Math.log10(Math.abs(x))));
}

export function exact(D: typeof Decimal, x: number): Decimal {
  return new D(x.toPrecision(40));
}

function reference(fn: Unary, x: number): number {
  const D = Decimal.clone({
    precision: digitsFor(fn, x),
    rounding: Decimal.ROUND_HALF_EVEN,
  });
  const v = exact(D, x);
  const r = {
    exp: () => D.exp(v),
    ln: () => D.ln(v),
    log10: () => D.log10(v),
    expm1: () => D.exp(v).minus(1),
    log1p: () => D.ln(new D(1).plus(v)),
  }[fn]();
  return Number(r.toString());
}

function referencePow(base: number, exponent: number): number {
  const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN });
  return Number(D.pow(exact(D, base), exact(D, exponent)).toString());
}

export const UNARY = { exp, ln, log10, expm1, log1p } as const;

/** Finite-result domains, and boundary inputs at each domain's edges. */
export const DOMAIN: Record<
  Unary,
  { min: number; max: number; edges: number[] }
> = {
  exp: {
    min: -745,
    max: 709.78,
    edges: [-745, -744.44, -708.4, -1e-300, 5e-324, 1e-16, 1, 2, 709.78],
  },
  ln: {
    min: Number.MIN_VALUE,
    max: Number.MAX_VALUE,
    edges: [
      5e-324,
      2.2250738585072014e-308,
      0.9999999999999999,
      1.0000000000000002,
      2,
      10,
      Number.MAX_VALUE,
    ],
  },
  log10: {
    min: Number.MIN_VALUE,
    max: Number.MAX_VALUE,
    edges: [
      5e-324,
      1e-300,
      0.1,
      9.999999999999998,
      10,
      1e22,
      1e23,
      Number.MAX_VALUE,
    ],
  },
  expm1: {
    min: -50,
    max: 709.78,
    edges: [-50, -1e-300, -5e-324, 5e-324, 1e-300, 1e-10, 0.5, 1, 709.78],
  },
  log1p: {
    min: -0.9999999999999999,
    max: Number.MAX_VALUE,
    edges: [
      -0.9999999999999999,
      -0.5,
      -1e-300,
      5e-324,
      1e-300,
      1e-10,
      1,
      Number.MAX_VALUE,
    ],
  },
};

/** `name(x)` is within 2 ulp of the reference. */
export function checkUnary(name: Unary, x: number): void {
  expect(
    ulps(UNARY[name](x), reference(name, x)),
    `${name}(${String(x)})`,
  ).toBeLessThanOrEqual(2n);
}

/** `pow(base, exponent)` is within 2 ulp of the reference. */
export function checkPow(base: number, exponent: number): void {
  expect(
    ulps(pow(base, exponent), referencePow(base, exponent)),
    `pow(${String(base)}, ${String(exponent)})`,
  ).toBeLessThanOrEqual(2n);
}
