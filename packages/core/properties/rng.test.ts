import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  checkFloatRange,
  checkIndependent,
  checkIntRange,
  checkJsonRoundTrip,
  NAMES,
} from '../test/rng-laws';
import { minimumBreach } from '../../../tests/minimums';

/**
 * The PRNG's properties on random seeds and orders (#26 AC6), at their full
 * counts (#543). The unit suite checks chosen ones through the same checks
 * (test/rng.test.ts).
 */

describe('xoshiro128**', () => {
  it('round-trips through JSON and continues the same sequence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        fc.integer({ min: 0, max: 50 }),
        checkJsonRoundTrip,
      ),
    );
  });
});

describe('derived draws', () => {
  it('nextFloat is in [0, 1)', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 1e9 }), checkFloatRange));
  });

  it('nextInt(n) stays in [0, n)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e9 }),
        fc.integer({ min: 1, max: 2 ** 32 }),
        checkIntRange,
      ),
    );
  });
});

describe('named sub-streams', () => {
  // Each stream's values equal drawing that stream alone, whatever the
  // interleaving with the others: one property per stream.
  for (const name of NAMES)
    it(`are independent: drawing the others never changes ${name}`, () => {
      let longest = 0;
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...NAMES), { maxLength: 50, size: 'max' }),
          (order) => {
            longest = Math.max(longest, order.length);
            checkIndependent(name, order);
          },
        ),
      );
      // fast-check's default size never generates more than 10 elements
      // (measured, #27), whatever maxLength says: the property must reach
      // longer interleavings than that, at least its measured minimum (#84).
      expect(
        minimumBreach(`core-rng/${name}-longest`, longest),
      ).toBeUndefined();
    });
});
