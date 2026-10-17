import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  caseOf,
  checkGridScan,
  checkNextPurchase,
  INTERVALS,
  type Case,
} from '../test/pemandu-tick-laws';
import { minimumBreach } from '../../../tests/minimums';
import { DAY_MS } from '../src/clock';

/**
 * Pemandu's next purchase tick on random grids and games (#33 AC3), at the
 * counts before #474 cut them to fit the unit limit (#543). The unit suite
 * checks chosen ones through the same checks (test/pemandu-tick.test.ts).
 */

/**
 * A fraction in thousandths. `fc.double` leans hard on 0 and its bounds:
 * with it, 94% of the states bought at the first tick (measured, #33).
 */
function perMille(min: number, max: number): fc.Arbitrary<number> {
  return fc.integer({ min, max }).map((n) => n / 1000);
}

const arbCase: fc.Arbitrary<Case> = fc
  .record({
    interval: fc.constantFrom(...INTERVALS),
    scale: fc.constantFrom(1, 10, 100, 1_000, 10_000, 100_000, 1_000_000),
    tea: fc.integer({ min: 0, max: 30 }),
    inn: fc.integer({ min: 0, max: 20 }),
    market: fc.integer({ min: 0, max: 10 }),
    ferry: fc.integer({ min: 0, max: 3 }),
    region2: fc.boolean(),
    discount: fc.integer({ min: 0, max: 2 }),
    phrasebook: fc.boolean(),
    stampsEarned: fc.integer({ min: 0, max: 5 }),
    hour: fc.integer({ min: 0, max: 50 }),
    nearHourEnd: fc.boolean(),
    offset: perMille(0, 1000),
    skew: fc.integer({ min: 0, max: 5 * DAY_MS }),
    reviewed: fc.array(
      fc.record({
        k: fc.integer({ min: 0, max: 2 }),
        ageMs: fc.integer({ min: 0, max: 30 * DAY_MS }),
      }),
      { maxLength: 3 },
    ),
    ticks: fc.integer({ min: 0, max: 100 }),
    jitter: perMille(0, 999),
    lead: perMille(-250, 1300),
    festival: fc.boolean(),
    edgeA: perMille(0, 1000),
    edgeB: perMille(0, 1000),
    // Ends the horizon on a tick of the grid half the time, so a purchase
    // can fall exactly at `until`, which is inside it (#474).
    untilOnTick: fc.constant(false),
  })
  .map((r) => caseOf(r));

describe('firstHolding: the first tick of a grid where a monotone test holds', () => {
  it('equals a scan of the grid for any threshold and guess', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 60 }),
        fc.oneof(
          fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          fc.constantFrom(Infinity, -Infinity),
        ),
        fc.integer({ min: 0, max: 70 }),
        checkGridScan,
      ),
      { numRuns: 10_000 },
    );
  });
});

describe('nextPurchaseTick (AC3)', () => {
  // What the generated states reached (#474), each a measured minimum (#84): no
  // purchase inside the horizon, a purchase at the first tick, one solved
  // past a segment's first tick, one past the first segment, and one exactly
  // at `until`.
  const REACHED = [
    'none',
    'firstTick',
    'midSegment',
    'laterSegment',
    'atUntil',
  ] as const;
  type Reached = Record<(typeof REACHED)[number], number>;
  let solved: Reached | undefined;

  /**
   * Solves 10,000 fresh states once a run, for the property and its
   * minimums: the count before #474 cut it to 500 to fit the unit limit
   * (#543).
   */
  function solve(): Reached {
    if (solved !== undefined) return solved;
    const seen: Reached = {
      none: 0,
      firstTick: 0,
      midSegment: 0,
      laterSegment: 0,
      atUntil: 0,
    };
    fc.assert(
      fc.property(arbCase, (c) => {
        const where = checkNextPurchase(c);
        seen.none += Number(where.none);
        seen.firstTick += Number(where.firstTick);
        seen.midSegment += Number(where.midSegment);
        seen.laterSegment += Number(where.laterSegment);
        seen.atUntil += Number(where.atUntil);
      }),
      { numRuns: 10_000 },
    );
    solved = seen;
    return seen;
  }

  it('equals a tick-by-tick scan over 10,000 generated states, checking at most one more tick than it walks segments', () => {
    expect(Object.keys(solve())).toEqual([...REACHED]);
  });

  it.each(REACHED)(
    'the generated states reach %s at least as often as measured',
    (name) => {
      expect(
        minimumBreach(`core-pemandu-tick/${name}`, solve()[name]),
      ).toBeUndefined();
    },
  );
});
