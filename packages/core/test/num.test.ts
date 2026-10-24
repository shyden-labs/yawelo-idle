import { describe, expect, it } from 'vitest';
import { Num, type NumTuple } from '../src/num.ts';
import {
  canonical,
  checkCmp,
  checkDiv,
  checkFrom,
  checkOp,
  checkPow,
  checkRoundTrip,
  Decimal60 as D,
  OPS,
  relativeError,
  sameTuple,
} from './num-laws.ts';

/**
 * Num: break_infinity values held to a canonical, serialisable form (#26 AC4).
 *
 * State stores a Num as a [mantissa, exponent] tuple, so one value must have
 * one tuple: 1 <= |mantissa| < 10 with a safe-integer exponent, or exactly
 * [0, 0]. break_infinity normalises with Math.floor(Math.log10(|m|)) and its
 * add() leaves m < 1 for the integer mantissas 999999999999999 and
 * 999999999999998 (measured on V8 and JavaScriptCore alike), so Num
 * renormalises every result.
 *
 * Each property runs on random tuples at its full count in the properties
 * suite (properties/num.test.ts, #543); here, on chosen stand-ins through the
 * same checks (num-laws.ts): zero, the mantissa and exponent bounds, signs,
 * and operands far apart.
 */

const ROUND_TRIPS: NumTuple[] = [
  [0, 0],
  [1, 0],
  [9.999999999999998, 1000],
  [-1, -1000],
  [3.14159, 7],
];

const FROMS = [
  0.1, -123456.789, 5e-324, -2.2250738585072014e-308, 1.7976931348623157e308,
];

/** Operand pairs for add, sub and mul, each with what it stands in for. */
const PAIRS: [string, NumTuple, NumTuple][] = [
  ['one exponent', [1.5, 3], [2.25, 3]],
  ['exponents 2,000 apart', [9.99, 1000], [1, -1000]],
  ['opposite signs', [-5, 14], [5, 14]],
  ['zero', [0, 0], [7.7, -12]],
];

const DIVS: [string, NumTuple, NumTuple][] = [
  ['zero', [0, 0], [3, 2]],
  ['exponents 2,000 apart', [-9.87, -1000], [1.01, 1000]],
  ['one exponent', [1, 0], [3, 0]],
];

const POWS: [string, NumTuple, number][] = [
  ['a negative fractional power', [2.5, 3], -7.25],
  ['a large base to a power near 1', [9.99, 999], 1.0001],
  ['a small base to a half', [1, -1000], 0.5],
  ['the most negative power', [3.3, 1], -1000],
];

const CMPS: [string, NumTuple, NumTuple][] = [
  ['the larger exponent with the smaller mantissa', [1, 5], [9, 4]],
  ['opposite signs', [-1, 5], [1, -5]],
  ['zero and a negative', [0, 0], [-2, -3]],
  ['equal tuples', [2.5, 3], [2.5, 3]],
];

describe('the serialised form', () => {
  it.each(ROUND_TRIPS)(
    'round-trips [%s, %s] exactly, through JSON too',
    (m, e) => {
      checkRoundTrip([m, e]);
    },
  );

  it.each<[string, NumTuple]>([
    ['a mantissa of 10', [10, 0]],
    ['a mantissa below 1', [0.5, 3]],
    ['a negative zero', [-0, 0]],
    ['zero with an exponent', [0, 3]],
    ['a NaN mantissa', [NaN, 0]],
    ['an infinite mantissa', [Infinity, 0]],
    ['a fractional exponent', [1, 0.5]],
    ['an unsafe exponent', [1, 2 ** 53]],
  ])('refuses %s', (_label, t) => {
    expect(() => Num.fromTuple(t)).toThrow(RangeError);
  });
});

describe('Num.from', () => {
  it.each([NaN, Infinity, -Infinity])('refuses %s', (x) => {
    expect(() => Num.from(x)).toThrow(RangeError);
  });

  it('maps both zeros to [0, 0]', () => {
    expect(sameTuple(Num.toTuple(Num.from(0)), [0, 0])).toBe(true);
    expect(sameTuple(Num.toTuple(Num.from(-0)), [0, 0])).toBe(true);
  });

  it.each(FROMS)(
    'gives a canonical tuple within 2 parts in 2^52 of %s',
    (x) => {
      checkFrom(x);
    },
  );
});

describe('arithmetic stays canonical and accurate', () => {
  it('renormalises the add() mantissa break_infinity leaves below 1', () => {
    // 5e14 + 4.99999999999999e14 = 999999999999999: break_infinity returns
    // [0.999999999999999, 15].
    const t = Num.toTuple(
      Num.add(Num.fromTuple([5, 14]), Num.fromTuple([4.99999999999999, 14])),
    );
    expect(canonical(t), JSON.stringify(t)).toBe(true);
    expect(t[1]).toBe(14);
    expect(relativeError(t, new D('999999999999999'))).toBeLessThanOrEqual(
      2 * Number.EPSILON,
    );
  });

  for (const [name] of OPS)
    for (const [label, a, b] of PAIRS)
      it(`${name} is canonical and within 1e-14 of the larger operand, on ${label}`, () => {
        checkOp(name, a, b);
      });

  for (const [label, a, b] of DIVS)
    it(`div is canonical and within 1e-15, on ${label}`, () => {
      checkDiv(a, b);
    });

  it('div refuses a zero divisor', () => {
    expect(() => Num.div(Num.from(1), Num.from(0))).toThrow(RangeError);
  });
});

describe('Num.pow, built from det-math', () => {
  for (const [label, a, p] of POWS)
    it(`is canonical and within the derived bound 6e-16 x (|p| + |log10 result| + 2), on ${label}`, () => {
      checkPow(a, p);
    });

  for (const k of [0, 1, 7, 300, 4000, -300])
    it(`gives 10^${String(k)} exactly`, () => {
      expect(Num.toTuple(Num.pow(Num.from(10), k))).toEqual([1, k]);
    });

  it('pins the bits of the cost curve far past 1e308', () => {
    // Golden values, measured 2026-10-01 and within the accuracy bound above
    // of decimal.js (3.0846206955449946e303, 6.0818451891827873e6069). Any
    // change to how Num.pow computes (Decimal.pow, Math.pow, another
    // det-math) moves these bits.
    expect(Num.toTuple(Num.pow(Num.from(1.15), 5000))).toEqual([
      3.0846206955449995, 303,
    ]);
    expect(Num.toTuple(Num.pow(Num.from(1.15), 100000))).toEqual([
      6.081845189176603, 6069,
    ]);
  });

  it('handles zero and refuses what has no real answer', () => {
    expect(Num.toTuple(Num.pow(Num.from(0), 3))).toEqual([0, 0]);
    expect(Num.toTuple(Num.pow(Num.from(0), 0))).toEqual([1, 0]);
    expect(Num.toTuple(Num.pow(Num.from(7), 0))).toEqual([1, 0]);
    expect(() => Num.pow(Num.from(0), -1)).toThrow(RangeError);
    expect(() => Num.pow(Num.from(-2), 2)).toThrow(RangeError);
    expect(() => Num.pow(Num.from(2), NaN)).toThrow(RangeError);
    expect(() => Num.pow(Num.from(2), Infinity)).toThrow(RangeError);
  });
});

describe('comparison and reading back', () => {
  for (const [label, a, b] of CMPS)
    it(`cmp orders like the exact values, on ${label}`, () => {
      checkCmp(a, b);
    });

  it('log10 is the exponent plus det-math log10 of the mantissa', () => {
    expect(Num.log10(Num.fromTuple([1, 4000]))).toBe(4000);
    expect(Num.log10(Num.fromTuple([5, -3]))).toBeCloseTo(-2.30103, 5);
    expect(() => Num.log10(Num.from(0))).toThrow(RangeError);
    expect(() => Num.log10(Num.from(-1))).toThrow(RangeError);
  });

  it('toNumber reads back in range and saturates outside it', () => {
    expect(Num.toNumber(Num.fromTuple([1.5, 3]))).toBe(1500);
    expect(Num.toNumber(Num.fromTuple([1, 400]))).toBe(Infinity);
    expect(Num.toNumber(Num.fromTuple([1, -400]))).toBe(0);
  });
});
