import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkHashOfStateAlone } from '../test/hash-laws';

/**
 * The state hash on random seeds and wall times (#34), at the full count
 * and fresh on every run (#543). The unit suite checks chosen ones through the same check
 * (test/hash.test.ts).
 */

describe('stateHash', () => {
  it('is a function of the state alone, for any seed and wall time', () => {
    let reached = 0;
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 }),
        fc.integer({ min: 0, max: 2 ** 45 }),
        (seed, wall) => {
          reached += 1;
          checkHashOfStateAlone(seed, wall);
        },
      ),
      { numRuns: 200 },
    );
    expect(reached).toBe(200);
  });
});
