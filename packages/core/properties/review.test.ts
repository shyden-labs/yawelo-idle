import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DAY_MS } from '../src/clock';
import { checkHistory } from '../test/review-laws';

/**
 * Ranks over random review histories (#28 AC5), at the full count (#543).
 * The unit suite checks chosen histories through the same check
 * (test/review.test.ts).
 */

describe('review', () => {
  it('never lowers a rank on a correct answer, over random review histories', () => {
    let correctSteps = 0;
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            correct: fc.boolean(),
            lateMs: fc.integer({ min: 0, max: 60 * DAY_MS }),
          }),
          { minLength: 5, maxLength: 40, size: 'max' },
        ),
        (steps) => {
          correctSteps += checkHistory(steps);
        },
      ),
      { numRuns: 300 },
    );
    expect(correctSteps).toBeGreaterThan(1000);
  });
});
