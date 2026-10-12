import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { HOUR_MS } from '../src/clock';
import type { GameState } from '../src/state';
import {
  addReached,
  checkLinear,
  checkSequence,
  checkSplit,
  countSplit,
  DAY_MS,
  gapFrom,
  SEQUENCE_REACHED,
  SPLITS,
  stateOf,
  units,
  type Gap,
  type SequenceReached,
  type Split,
  type Step,
} from '../test/sim-laws';
import { floorBreach } from '../../../tests/floors';

/**
 * The time model on random times, states and sequences (#27 AC5, AC6, AC8;
 * #33 AC4), at the counts before #474 cut them to fit the unit limit (#543).
 * The unit suite checks chosen cases through the same checks
 * (test/sim.test.ts). The seeded properties keep their seeds until their
 * floors become measured minimums (#84).
 */

const arbState = fc
  .record({
    tea: fc.integer({ min: 0, max: 300 }),
    market: fc.integer({ min: 0, max: 300 }),
    understanding: fc.double({ min: 0, max: 1e15, noNaN: true }),
    anchorSim: fc.integer({ min: 0, max: 1e12 }),
    lead: fc.integer({ min: 0, max: 72 * HOUR_MS }),
    wall: fc.integer({ min: 1.7e12, max: 1.9e12 }),
    stampsEarned: fc.integer({ min: 0, max: 20 }),
    phrasebook: fc.boolean(),
  })
  .map((r) => stateOf(r));

function arbGap(maxHours: number): fc.Arbitrary<Gap> {
  return fc.oneof(
    { arbitrary: fc.constant({ ms: 0 }), weight: 1 },
    {
      arbitrary: fc.record({
        ms: fc.integer({ min: 0, max: maxHours * HOUR_MS }),
      }),
      weight: 4,
    },
    {
      arbitrary: fc.record({
        hours: fc.integer({ min: 0, max: maxHours - 1 }),
        nudge: fc.constantFrom(-1 as const, 0 as const, 1 as const),
      }),
      weight: 3,
    },
  );
}

describe('production inside an hour (AC5)', () => {
  it('is linear at the Encounter rate between any two times', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: HOUR_MS - 2 }),
        fc.integer({ min: 1, max: HOUR_MS - 1 }),
        (from, span) => {
          fc.pre(Math.min(from + span, HOUR_MS - 1) > from);
          checkLinear(from, span);
        },
      ),
    );
  });
});

describe('integrate (AC6)', () => {
  let plain: Split | undefined;

  /**
   * 1,000 seeded splits over spans of up to 144 h, the count before #474 cut
   * it to 90 (#543). The gaps end on or beside an hour edge three times in
   * eight: a uniform split ends on an edge about once in 3.6 million.
   */
  function playPlain(): Split {
    if (plain !== undefined) return plain;
    const seen: Split = { 'zero-part': 0, 'on-edge': 0, 'beside-edge': 0 };
    const gap = arbGap(72);
    fc.assert(
      fc.property(arbState, gap, gap, (s, ga, gb) => {
        const a = gapFrom(s.sim, ga);
        const b = gapFrom(s.sim + a, gb);
        countSplit(seen, s, a, b);
        checkSplit(s, a, b);
      }),
      { seed: 474, numRuns: 1000 },
    );
    plain = seen;
    return seen;
  }

  it('integrate(integrate(s, a), b) deep-equals integrate(s, a + b), bit for bit', () => {
    expect(Object.keys(playPlain())).toEqual([...SPLITS]);
  });

  it.each(SPLITS)('the splits reach %s as often as recorded', (name) => {
    expect(
      floorBreach(`core-sim/split-${name}`, playPlain()[name]),
    ).toBeUndefined();
  });

  const PEMANDU = [...SPLITS, 'bought'] as const;
  type PemanduSplit = Record<(typeof PEMANDU)[number], number>;
  let pemandu: PemanduSplit | undefined;

  /**
   * With Pemandu buying, every purchase is replayed three times over: 300
   * seeded splits of up to 72 h a side, the count and span before #474 cut
   * them to 15 of up to 12 h (#543).
   */
  function playPemandu(): PemanduSplit {
    if (pemandu !== undefined) return pemandu;
    const seen: PemanduSplit = {
      'zero-part': 0,
      'on-edge': 0,
      'beside-edge': 0,
      bought: 0,
    };
    const gap = arbGap(72);
    const buying = fc
      .tuple(arbState, fc.constantFrom(10_000, 5_000, 2_000, 1_000))
      .map(([s, intervalMs]): GameState => ({
        ...s,
        automation: { enabled: true, intervalMs },
      }));
    fc.assert(
      fc.property(buying, gap, gap, (s, ga, gb) => {
        const a = gapFrom(s.sim, ga);
        const b = gapFrom(s.sim + a, gb);
        countSplit(seen, s, a, b);
        seen.bought += units(checkSplit(s, a, b)) - units(s);
      }),
      { seed: 474, numRuns: 300 },
    );
    pemandu = seen;
    return seen;
  }

  it('integrate(integrate(s, a), b) deep-equals integrate(s, a + b) with Pemandu buying (#33 AC4)', () => {
    expect(Object.keys(playPemandu())).toEqual([...PEMANDU]);
  });

  it.each(PEMANDU)(
    'the splits with Pemandu buying reach %s as often as recorded',
    (name) => {
      expect(
        floorBreach(`core-sim/pemandu-${name}`, playPemandu()[name]),
      ).toBeUndefined();
    },
  );
});

describe('no reachable state holds NaN, a negative or an infinite value (AC8)', () => {
  const step: fc.Arbitrary<Step> = fc.oneof(
    { arbitrary: fc.constant({ kind: 'listen' as const }), weight: 5 },
    {
      arbitrary: fc.record({
        kind: fc.constant('buy' as const),
        id: fc.constantFrom('tea', 'market', 'toString'),
        count: fc.integer({ min: 1, max: 20 }),
      }),
      weight: 3,
    },
    {
      arbitrary: fc.record({
        kind: fc.constant('advance' as const),
        deltaMs: fc.integer({ min: -DAY_MS, max: 40 * DAY_MS }),
      }),
      weight: 2,
    },
  );

  let played: SequenceReached | undefined;

  /** 500 seeded games of 20 to 120 steps, the count before #474 cut it to 100 (#543). */
  function play(): SequenceReached {
    if (played !== undefined) return played;
    const reached: SequenceReached = {
      bought: 0,
      'buy-refused': 0,
      'clock-back': 0,
      clipped: 0,
      checked: 0,
    };
    fc.assert(
      fc.property(
        fc.array(step, { minLength: 20, maxLength: 120, size: 'max' }),
        (steps) => {
          addReached(reached, checkSequence(steps));
        },
      ),
      { seed: 474, numRuns: 500 },
    );
    played = reached;
    return reached;
  }

  it('over random sequences of listens, purchases and returns', () => {
    expect(Object.keys(play())).toEqual([...SEQUENCE_REACHED]);
  });

  it.each(SEQUENCE_REACHED)(
    'the random sequences reach %s as often as recorded',
    (name) => {
      expect(
        floorBreach(`core-sim/sequence-${name}`, play()[name]),
      ).toBeUndefined();
    },
  );
});
