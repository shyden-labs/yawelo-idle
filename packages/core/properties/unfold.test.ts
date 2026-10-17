import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DAY_MS } from '../src/clock';
import { UNFOLD_FLAGS, type UnfoldFlag } from '../src/unfold';
import { checkWalk, type Step } from '../test/unfold-laws';

/**
 * No flag ever turns off, over seeded random walks (#31 AC6), at the full
 * count (#543). The unit suite checks chosen walks through the same check
 * (test/unfold.test.ts).
 */

describe('no flag ever turns off', () => {
  const step: fc.Arbitrary<Step> = fc.oneof(
    fc.record({
      kind: fc.constant('listen'),
      taps: fc.integer({ min: 1, max: 80 }),
    }),
    fc.record({
      kind: fc.constant('wait'),
      ms: fc.integer({ min: 1, max: DAY_MS }),
    }),
    fc.constant({ kind: 'buy' } as const),
    fc.constant({ kind: 'pickUp' } as const),
    fc.constant({ kind: 'review' } as const),
    fc.record({
      kind: fc.constant('start'),
      duration: fc.constantFrom('tutorial' as const, '2h' as const),
    }),
    fc.constant({ kind: 'collect' } as const),
    fc.constant({ kind: 'sail' } as const),
  );

  /**
   * Walks in which each flag turned on, and steps that began with it on (the
   * steps the check judges), measured at seed 31 over 300 walks (1,886
   * steps); Listen is on from the first state. Re-measured in #35, when a tap
   * became 0.5 Understanding and the walk's taps per step doubled to 40, and
   * again when it became 0.25 and they doubled to 80, to keep its
   * Understanding per step. Lower one only when the walk is changed
   * on purpose.
   */
  const TURNED_ON: Readonly<Record<UnfoldFlag, number>> = {
    listen: 0,
    encounters: 55,
    words: 6,
    review: 2,
    upgrades: 60,
    journeys: 2,
    culture: 46,
    goal: 60,
  };
  const JUDGED: Readonly<Record<UnfoldFlag, number>> = {
    listen: 1886,
    encounters: 1054,
    words: 852,
    review: 843,
    upgrades: 253,
    journeys: 843,
    culture: 136,
    goal: 189,
  };

  for (const flag of UNFOLD_FLAGS)
    it(`${flag} never turns off over seeded walks from a new game and from one near its goal`, () => {
      let turnedOn = 0;
      let stepsChecked = 0;
      let judged = 0;
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.array(step, { minLength: 1, maxLength: 40 }),
          (startNearGoal, steps) => {
            const walked = checkWalk(flag, startNearGoal, steps);
            stepsChecked += walked.steps;
            judged += walked.judged;
            turnedOn += walked.turnedOn;
          },
        ),
        { seed: 31, numRuns: 300 },
      );
      expect(stepsChecked).toBeGreaterThan(1885);
      expect(turnedOn).toBeGreaterThan(TURNED_ON[flag] - 1);
      expect(judged).toBeGreaterThan(JUDGED[flag] - 1);
    });
});
