import { describe, it } from 'vitest';
import fc from 'fast-check';
import { checkBucket, checkGridSplit } from '../test/clock-laws.ts';

/**
 * The clock helpers against BigInt arithmetic on random times (#26 AC5), at
 * their full counts (#543). The unit suite checks chosen times through the
 * same checks (test/clock.test.ts).
 */

const safeTime = fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER });
const interval = fc.integer({ min: 1, max: 86_400_000 });

describe('hour buckets', () => {
  it('agree with exact BigInt arithmetic at every magnitude', () => {
    fc.assert(fc.property(safeTime, checkBucket), { numRuns: 5000 });
  });
});

describe('the automation grid', () => {
  it('splits exactly: ticks(a, b) + ticks(b, c) = ticks(a, c)', () => {
    fc.assert(
      fc.property(
        fc.array(safeTime, { minLength: 3, maxLength: 3 }),
        interval,
        checkGridSplit,
      ),
      { numRuns: 5000 },
    );
  });
});
