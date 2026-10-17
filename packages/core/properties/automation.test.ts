import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkTickByTick } from '../test/automation-laws';
import { minimumBreach } from '../../../tests/minimums';

/**
 * Pemandu's purchases over random games (#33 AC2), at the count before
 * #474 cut it to fit the unit limit (#543). The unit suite checks chosen
 * games through the same check (test/automation.test.ts).
 */

describe('integrate with Pemandu (AC2)', () => {
  it('equals buying tick by tick with bestPayback and buyEncounter, over generated states', () => {
    // 2,400 fresh states a run (below). Measured minimums (#84): the units bought, and
    // the states in which nothing was bought.
    let bought = 0;
    let idle = 0;
    fc.assert(
      fc.property(
        fc.record({
          interval: fc.constantFrom(10_000, 5_000, 2_000, 1_000),
          reached: fc.constantFrom(3, 4, 8),
          tea0: fc.integer({ min: 0, max: 40 }),
          market0: fc.integer({ min: 0, max: 20 }),
          tea1: fc.integer({ min: 0, max: 10 }),
          held: fc.integer({ min: 5_000, max: 5_000 }),
          sim: fc.integer({ min: 0, max: 30 * 3_600_000 }),
          ticks: fc.integer({ min: 1, max: 150 }),
          discount: fc.integer({ min: 0, max: 2 }),
          phrasebook: fc.boolean(),
          reviewed: fc.integer({ min: 0, max: 5 }),
        }),
        (r) => {
          const units = checkTickByTick(r);
          bought += units;
          if (units === 0) idle += 1;
        },
      ),
      // 300 before any cut (#543), raised (#84, Shyden 2026-10-16: "Raise
      // their runs"): round 1 (run 38830359612) found the idle states 8.62 a
      // run on average (sd 3.04), too few to hold a measured minimum, factor
      // 8: 300 times 8.
      { numRuns: 2_400 },
    );
    expect({
      bought: minimumBreach('core-automation/tick-by-tick-bought', bought),
      idle: minimumBreach('core-automation/tick-by-tick-idle', idle),
    }).toEqual({ bought: undefined, idle: undefined });
  });
});
