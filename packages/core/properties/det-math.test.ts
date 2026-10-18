import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  checkPow,
  checkUnary,
  DOMAIN,
  UNARY,
  type Unary,
} from '../test/det-math-laws';

/**
 * det-math within 2 ulp of a 60-digit reference on random inputs (#26 AC2),
 * at the full count (#543). The unit suite checks chosen inputs through the
 * same checks (test/det-math.test.ts).
 */

// Each random input costs one decimal.js reference at 60 digits or more,
// 0.24 ms (ln) to 0.31 ms (pow) measured alone. Every run draws 2,000 new
// inputs: the count before #474 cut it to 300 to fit the unit limit, restored
// here (Shyden, 2026-10-12, #543).
const RANDOM_INPUTS = 2000;

describe('det-math is within 2 ulp of a 60-digit reference', () => {
  for (const name of Object.keys(UNARY) as Unary[]) {
    const { min, max } = DOMAIN[name];
    it(`${name} on ${String(RANDOM_INPUTS)} random inputs`, () => {
      fc.assert(
        fc.property(fc.double({ min, max, noNaN: true }), (x) => {
          checkUnary(name, x);
        }),
        { numRuns: RANDOM_INPUTS },
      );
    });
  }

  it(`pow on ${String(RANDOM_INPUTS)} random positive bases and real exponents`, () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-3, max: 1e3, noNaN: true }),
        fc.double({ min: -100, max: 100, noNaN: true }),
        (base, exponent) => {
          checkPow(base, exponent);
        },
      ),
      { numRuns: RANDOM_INPUTS },
    );
  });
});
