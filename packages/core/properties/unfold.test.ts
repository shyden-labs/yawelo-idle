import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DAY_MS } from '../src/clock';
import { UNFOLD_FLAGS, type UnfoldFlag } from '../src/unfold';
import { checkWalk, type Step } from '../test/unfold-laws';

/**
 * No flag ever turns off, over random walks (#31 AC6), at the full
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
   * Each flag's walks a run. 300 is the count from before any cut (#543).
   * Four are raised (#84, Shyden 2026-10-16: "Raise their runs"): round 1
   * (run 38830359612, 200 runs at 300 walks) found a count too small to hold
   * a measured minimum, so each takes 300 times its factor, rounded up to two
   * figures. journeys and review turned on 1.25 times a run on average
   * (sd 1.06), factor 42; words 4.86 (sd 2.12), factor 12; culture's judged
   * steps 154.47 (sd 25.62), factor 3.
   */
  const RUNS: Readonly<Record<UnfoldFlag, number>> = {
    listen: 300,
    encounters: 300,
    words: 3_600,
    review: 13_000,
    upgrades: 300,
    journeys: 13_000,
    culture: 900,
    goal: 300,
  };

  for (const flag of UNFOLD_FLAGS)
    it(`${flag} never turns off over random walks from a new game and from one near its goal`, () => {
      let turnedOn = 0;
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.array(step, { minLength: 1, maxLength: 40 }),
          (startNearGoal, steps) => {
            const walked = checkWalk(flag, startNearGoal, steps);
            turnedOn += walked.turnedOn;
          },
        ),
        { numRuns: RUNS[flag] },
      );
      // Listen is on from the first state, so no walk ever turns it on.
      expect(flag === 'listen' ? turnedOn : 0).toBe(0);
    });
});
