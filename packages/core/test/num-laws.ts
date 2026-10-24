import { expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { Num, type NumTuple } from '../src/num.ts';

/**
 * What Num must satisfy at one input (#26 AC4). The unit suite checks chosen
 * tuples (num.test.ts) and the properties suite random ones
 * (properties/num.test.ts, #543), through the same checks.
 */

const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_EVEN });

export function canonical([m, e]: NumTuple): boolean {
  if (m === 0) return Object.is(m, 0) && e === 0;
  return (
    Number.isFinite(m) &&
    Math.abs(m) >= 1 &&
    Math.abs(m) < 10 &&
    Number.isSafeInteger(e)
  );
}

export function sameTuple(a: NumTuple, b: NumTuple): boolean {
  return Object.is(a[0], b[0]) && Object.is(a[1], b[1]);
}

/** The exact value of a tuple, as a 60-digit decimal. */
function exact([m, e]: NumTuple): Decimal {
  return new D(m.toPrecision(40)).times(D.pow(10, e));
}

export function relativeError(actual: NumTuple, expected: Decimal): number {
  if (expected.isZero()) return actual[0] === 0 ? 0 : Infinity;
  return exact(actual).minus(expected).abs().div(expected.abs()).toNumber();
}

/** `t` round-trips exactly, through JSON too. */
export function checkRoundTrip(t: NumTuple): void {
  const out = Num.toTuple(Num.fromTuple(t));
  expect(sameTuple(out, t), JSON.stringify(t)).toBe(true);
  const viaJson = JSON.parse(JSON.stringify(out)) as NumTuple;
  expect(sameTuple(Num.toTuple(Num.fromTuple(viaJson)), t)).toBe(true);
}

/** `Num.from(x)` is canonical and within 2 parts in 2^52 of `x`. */
export function checkFrom(x: number): void {
  const t = Num.toTuple(Num.from(x));
  expect(canonical(t), String(x)).toBe(true);
  expect(relativeError(t, new D(x.toPrecision(40)))).toBeLessThanOrEqual(
    2 * Number.EPSILON,
  );
}

export const OPS = [
  ['add', Num.add, (a: Decimal, b: Decimal) => a.plus(b)],
  ['sub', Num.sub, (a: Decimal, b: Decimal) => a.minus(b)],
  ['mul', Num.mul, (a: Decimal, b: Decimal) => a.times(b)],
] as const;

export type OpName = (typeof OPS)[number][0];

/** `name(a, b)` is canonical and within 1e-14 of the larger operand. */
export function checkOp(name: OpName, a: NumTuple, b: NumTuple): void {
  const [, op, ref] = OPS.find(([n]) => n === name) ?? OPS[0];
  const t = Num.toTuple(op(Num.fromTuple(a), Num.fromTuple(b)));
  expect(
    canonical(t),
    `${name}(${JSON.stringify(a)}, ${JSON.stringify(b)})`,
  ).toBe(true);
  const want = ref(exact(a), exact(b));
  // break_infinity adds at 15 significant digits, and a sum's error is
  // bounded by its larger operand, not by the (possibly tiny) sum.
  const scale =
    name === 'mul' ? want.abs() : D.max(exact(a).abs(), exact(b).abs());
  if (scale.isZero()) return;
  const err = exact(t).minus(want).abs().div(scale).toNumber();
  expect(err).toBeLessThanOrEqual(1e-14);
}

/** `div(a, b)` is canonical and within 1e-15, for a positive `b`. */
export function checkDiv(a: NumTuple, b: NumTuple): void {
  const t = Num.toTuple(Num.div(Num.fromTuple(a), Num.fromTuple(b)));
  expect(canonical(t)).toBe(true);
  expect(relativeError(t, exact(a).div(exact(b)))).toBeLessThanOrEqual(1e-15);
}

/**
 * `pow(a, p)` is canonical and within the derived bound
 * 6e-16 x (|p| + |log10 result| + 2), for a positive `a`.
 *
 * Num.pow computes l = (e + log10 m) x p. log10 m carries up to 2 ulp
 * (2.2e-16) of absolute error, which p multiplies; rounding l adds half an
 * ulp of l; 10^frac adds 2 ulp. So the relative error is at most
 * ln 10 x 2.2e-16 x (|p| + |l|) + 6.6e-16 <= 6e-16 x (|p| + |l| + 2).
 * Measured over 60,000 random cases (2026-10-01): worst 0.79 of this bound.
 * A guessed (|l| + 1) x 1e-15 was exceeded (1.04 of it).
 */
export function checkPow(a: NumTuple, p: number): void {
  const t = Num.toTuple(Num.pow(Num.fromTuple(a), p));
  expect(canonical(t)).toBe(true);
  const want = exact(a).pow(new D(p.toPrecision(40)));
  const l = Math.abs(want.log(10).toNumber());
  const bound = 6e-16 * (Math.abs(p) + l + 2);
  expect(relativeError(t, want)).toBeLessThanOrEqual(bound);
}

/** `cmp(a, b)` orders like the exact values. */
export function checkCmp(a: NumTuple, b: NumTuple): void {
  expect(Num.cmp(Num.fromTuple(a), Num.fromTuple(b))).toBe(
    exact(a).cmp(exact(b)),
  );
}

export { D as Decimal60 };
