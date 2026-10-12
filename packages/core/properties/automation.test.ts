import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkTickByTick } from '../test/automation-laws';
import { floorBreach } from '../../../tests/floors';

/**
 * Pemandu's purchases over seeded random games (#33 AC2), at the count before
 * #474 cut it to fit the unit limit (#543). The unit suite checks chosen
 * games through the same check (test/automation.test.ts).
 */

describe('integrate with Pemandu (AC2)', () => {
  it('equals buying tick by tick with bestPayback and buyEncounter, over generated states', () => {
    // 300 seeded states. Floors: the units bought, and the states in which
    // nothing was bought.
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
          held: fc.integer({ min: 0, max: 5_000 }),
          sim: fc.integer({ min: 0, max: 30 * 3_600_000 }),
          ticks: fc.integer({ min: 0, max: 150 }),
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
      { numRuns: 300, seed: 33 },
    );
    expect({
      bought: floorBreach('core-automation/tick-by-tick-bought', bought),
      idle: floorBreach('core-automation/tick-by-tick-idle', idle),
    }).toEqual({ bought: undefined, idle: undefined });
  });
});
