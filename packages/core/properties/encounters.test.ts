import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  checkBulkIsSingles,
  checkClosedForm,
} from '../test/encounters-laws.ts';

/**
 * Encounter costs on random purchases (#27 AC2), at their full counts
 * (#543). The unit suite checks chosen purchases through the same checks
 * (test/encounters.test.ts).
 */

describe('purchaseCost (AC2)', () => {
  it('buying k uses the geometric series closed form', () => {
    // 1,000 random purchases a run against 60-digit decimal.js, and every
    // run draws 1,000 new ones: the count before #474 cut it to 280 to fit
    // the unit limit, restored here (#543).
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        checkClosedForm,
      ),
      { numRuns: 1000 },
    );
  });

  it('buying k at once costs what k single purchases cost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 200 }),
        checkBulkIsSingles,
      ),
      { numRuns: 200 },
    );
  });
});
