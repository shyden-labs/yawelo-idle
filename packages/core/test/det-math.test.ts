import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { exp, expm1, ln, log10, log1p, pow } from '../src/det-math';
import {
  checkPow,
  checkUnary,
  DOMAIN,
  exact,
  ulps,
  UNARY,
  type Unary,
} from './det-math-laws';

/**
 * det-math against a high-precision reference (M1 design §2.1, #26 AC2): every
 * result within 2 ulp of the true value rounded to a double (det-math-laws.ts).
 *
 * Here, on chosen inputs: each domain's edges, and stand-ins of the random
 * inputs, which run at their full count in the properties suite
 * (properties/det-math.test.ts, #543). The stand-ins span each domain's
 * small, middling and large magnitudes, away from its edges.
 */

const STAND_INS: Record<Unary, number[]> = {
  exp: [-321.7, 3.1e-7, 0.3, 123.456],
  ln: [3.3e-200, 0.7, 37.5, 4.2e250],
  log10: [6.1e-150, 0.37, 37.5, 8.8e199],
  expm1: [-17.25, -3.1e-7, 2.5e-9, 455.5],
  log1p: [-0.75, -2.5e-9, 3.1e-7, 6.6e123],
};

/** Stand-ins of the random positive bases and real exponents. */
const POW_STAND_INS: [number, number][] = [
  [1.15, 37.5],
  [0.0123, -42.7],
  [987.6, 99.9],
  [2.5, -0.333],
];

describe('det-math is within 2 ulp of a 60-digit reference', () => {
  for (const name of Object.keys(UNARY) as Unary[]) {
    for (const x of DOMAIN[name].edges)
      it(`${name}(${String(x)}), at its domain edge`, () => {
        checkUnary(name, x);
      });

    for (const x of STAND_INS[name])
      it(`${name}(${String(x)}), a stand-in for the random inputs`, () => {
        checkUnary(name, x);
      });
  }

  it('pow(1.15, n) for every n in 0..5000, the Encounter cost curve', () => {
    // The reference walks the curve one multiplication a step instead of a
    // full pow for each n (#474: 14 ms against 326 ms, the same 5,001
    // doubles). Each step rounds to 60 digits, so 5,000 steps drift by
    // under 1e-55 relative, far inside an ulp.
    const D = Decimal.clone({
      precision: 60,
      rounding: Decimal.ROUND_HALF_EVEN,
    });
    const base = exact(D, 1.15);
    let want = new D(1);
    let worst = 0n;
    for (let n = 0; n <= 5000; n++) {
      const d = ulps(pow(1.15, n), Number(want.toString()));
      if (d > worst) worst = d;
      want = want.times(base);
    }
    expect(worst).toBeLessThanOrEqual(2n);
  });

  for (const [base, exponent] of POW_STAND_INS)
    it(`pow(${String(base)}, ${String(exponent)}), a stand-in for the random bases and exponents`, () => {
      checkPow(base, exponent);
    });
});

describe('det-math special values follow ECMAScript exactly', () => {
  // Literal expectations, never `**` or Math.*: a fixture computed by the
  // engine under test cannot disagree with it.
  const cases: [string, () => number, number][] = [
    ['exp(NaN)', () => exp(NaN), NaN],
    ['exp(-0)', () => exp(-0), 1],
    ['exp(Infinity)', () => exp(Infinity), Infinity],
    ['exp(-Infinity)', () => exp(-Infinity), 0],
    ['exp(1000)', () => exp(1000), Infinity],
    ['exp(-1000)', () => exp(-1000), 0],
    ['ln(0)', () => ln(0), -Infinity],
    ['ln(-0)', () => ln(-0), -Infinity],
    ['ln(-1)', () => ln(-1), NaN],
    ['ln(1)', () => ln(1), 0],
    ['ln(Infinity)', () => ln(Infinity), Infinity],
    ['log10(0)', () => log10(0), -Infinity],
    ['log10(-1)', () => log10(-1), NaN],
    ['log10(1)', () => log10(1), 0],
    ['expm1(-0)', () => expm1(-0), -0],
    ['expm1(-Infinity)', () => expm1(-Infinity), -1],
    ['expm1(NaN)', () => expm1(NaN), NaN],
    ['log1p(-1)', () => log1p(-1), -Infinity],
    ['log1p(-2)', () => log1p(-2), NaN],
    ['log1p(-0)', () => log1p(-0), -0],
    ['pow(NaN, 0)', () => pow(NaN, 0), 1],
    ['pow(1, NaN)', () => pow(1, NaN), NaN],
    ['pow(1, Infinity)', () => pow(1, Infinity), NaN],
    ['pow(1, -Infinity)', () => pow(1, -Infinity), NaN],
    ['pow(-1, Infinity)', () => pow(-1, Infinity), NaN],
    ['pow(NaN, -0)', () => pow(NaN, -0), 1],
    ['pow(0, -1)', () => pow(0, -1), Infinity],
    ['pow(-0, -1)', () => pow(-0, -1), -Infinity],
    ['pow(-0, -2)', () => pow(-0, -2), Infinity],
    ['pow(-8, 1/3)', () => pow(-8, 1 / 3), NaN],
    ['pow(-2, 3)', () => pow(-2, 3), -8],
    ['pow(2, 1024)', () => pow(2, 1024), Infinity],
    ['pow(2, -1074)', () => pow(2, -1074), 5e-324],
  ];
  for (const [label, actual, expected] of cases) {
    it(label, () => {
      const value = actual();
      expect(Object.is(value, expected), `${label} = ${String(value)}`).toBe(
        true,
      );
    });
  }
});
