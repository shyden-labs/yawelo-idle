import { describe, it } from 'vitest';
import fc from 'fast-check';
import type { NumTuple } from '../src/num';
import {
  checkCmp,
  checkDiv,
  checkFrom,
  checkOp,
  checkPow,
  checkRoundTrip,
  OPS,
} from '../test/num-laws';

/**
 * Num's properties on random tuples (#26 AC4), at their full counts (#543).
 * The unit suite checks chosen tuples through the same checks
 * (test/num.test.ts).
 */

const mantissa = fc
  .tuple(
    fc.double({ min: 1, max: 10, maxExcluded: true, noNaN: true }),
    fc.boolean(),
  )
  .map(([m, negative]) => (negative ? -m : m));
const tupleArb = fc.oneof(
  { weight: 1, arbitrary: fc.constant<NumTuple>([0, 0]) },
  {
    weight: 20,
    arbitrary: fc
      .tuple(mantissa, fc.integer({ min: -1000, max: 1000 }))
      .map((t): NumTuple => t),
  },
);
const positiveTuple = fc
  .tuple(
    fc.double({ min: 1, max: 10, maxExcluded: true, noNaN: true }),
    fc.integer({ min: -1000, max: 1000 }),
  )
  .map((t): NumTuple => t);

describe('the serialised form', () => {
  it('round-trips every canonical tuple exactly, through JSON too', () => {
    fc.assert(fc.property(tupleArb, checkRoundTrip), { numRuns: 2000 });
  });
});

describe('Num.from', () => {
  it('gives a canonical tuple within 2 parts in 2^52 of the input', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        checkFrom,
      ),
      { numRuns: 2000 },
    );
  });
});

describe('arithmetic stays canonical and accurate', () => {
  for (const [name] of OPS)
    it(`${name} is canonical and within 1e-14 of the larger operand`, () => {
      fc.assert(
        fc.property(tupleArb, tupleArb, (a, b) => {
          checkOp(name, a, b);
        }),
        { numRuns: 2000 },
      );
    });

  it('div is canonical and within 1e-15', () => {
    fc.assert(fc.property(tupleArb, positiveTuple, checkDiv), {
      numRuns: 2000,
    });
  });
});

describe('Num.pow, built from det-math', () => {
  it('is canonical and within the derived bound 6e-16 x (|p| + |log10 result| + 2)', () => {
    // 1,000 random cases a run, each against 60-digit decimal.js, and every
    // run draws 1,000 new ones: the count before #474 cut it to 200 to fit
    // the unit limit, restored here (#543).
    fc.assert(
      fc.property(
        positiveTuple,
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        checkPow,
      ),
      { numRuns: 1000 },
    );
  });
});

describe('comparison', () => {
  it('cmp orders like the exact values', () => {
    fc.assert(fc.property(tupleArb, tupleArb, checkCmp), { numRuns: 2000 });
  });
});
