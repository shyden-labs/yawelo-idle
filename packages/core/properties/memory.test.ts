import { describe, it } from 'vitest';
import fc from 'fast-check';
import { checkMeanBetween } from '../test/memory-laws.ts';

/**
 * The mean retrievability on random windows (#28 AC3), at the full count
 * (#543). The unit suite checks chosen windows, the counterexample this
 * property found among them, through the same check (test/memory.test.ts).
 */

describe('the mean retrievability over a window', () => {
  it('lies between R at the window’s end and R at its start', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 36_500, noNaN: true }),
        fc.double({ min: 0, max: 1e5, noNaN: true }),
        fc.double({ min: 1e-9, max: 1e5, noNaN: true }),
        checkMeanBetween,
      ),
      { numRuns: 2000 },
    );
  });
});
