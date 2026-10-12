import { describe, expect, it } from 'vitest';
import { firstHolding, nextPurchaseTick } from '../src/automation';
import { DAY_MS, HOUR_MS, simMs, wallMs } from '../src/clock';
import type { Course } from '../src/course';
import { Num } from '../src/num';
import { producedBetween } from '../src/production';
import { createStreams } from '../src/rng';
import type { GameState } from '../src/state';
import { encounterPrice } from '../src/upgrades';
import {
  START,
  caseOf,
  NEXT_TICK_COURSE,
  checkGridScan,
  checkNextPurchase,
  type CaseRecord,
  type Solved,
} from './pemandu-tick-laws';

/**
 * Pemandu's next purchase tick (#33 AC3): solved from the segment's linear
 * rate, then confirmed at that tick and the one before, so it equals a
 * tick-by-tick scan.
 *
 * The course is declared here, so it is checked against the `Course`
 * contract rather than sharing it. A held festival card cuts segments inside
 * an hour, so the solve meets both kinds of edge.
 */

describe('firstHolding: the first tick of a grid where a monotone test holds', () => {
  const grid = { first: 10_000, last: 100_000, every: 10_000 };
  const from = (threshold: number) => (t: number) => t >= threshold;

  it.each([
    ['guessed exactly, inside the grid', 50_000, 50_000, 50_000, 2],
    ['guessed exactly, at the first tick', 10_000, 10_000, 10_000, 1],
    ['guessed between ticks: the tick after', 50_000, 41_234, 50_000, 2],
    [
      'guessed one tick late: back one, already known to hold',
      50_000,
      60_000,
      50_000,
      2,
    ],
    ['guessed one tick early', 50_000, 40_000, 50_000, 3],
    [
      'guessed past the grid, holding at its last tick',
      100_000,
      Infinity,
      100_000,
      2,
    ],
    ['guessed two ticks late', 50_000, 70_000, 50_000, 3],
    ['guessed past the grid, never holding', 200_000, Infinity, undefined, 1],
    ['guessed before the grid, holding at once', 0, -Infinity, 10_000, 1],
  ] as const)('%s', (_label, threshold, guess, tick, checks) => {
    expect(firstHolding(grid, guess, from(threshold))).toStrictEqual({
      tick,
      checks,
    });
  });

  it.each([
    ['one tick past its last', 20_000],
    ['far past its last', 50_000],
  ] as const)(
    'checks nothing on an empty grid, its first %s',
    (_label, first) => {
      const empty = { first, last: 10_000, every: 10_000 };
      expect(firstHolding(empty, 0, () => true)).toStrictEqual({
        tick: undefined,
        checks: 0,
      });
    },
  );

  it.each([
    ['holding from it: that tick', 100_000, 100_000, 2],
    ['holding only past it: none', 105_000, undefined, 1],
  ] as const)(
    'takes the last tick on the grid when `last` falls between ticks, %s',
    (_label, threshold, tick, checks) => {
      const ragged = { first: 10_000, last: 105_000, every: 10_000 };
      expect(firstHolding(ragged, Infinity, from(threshold))).toStrictEqual({
        tick,
        checks,
      });
    },
  );

  it('refuses a guess that is NaN, since no tick can be snapped to it', () => {
    expect(() => firstHolding(grid, Number.NaN, () => true)).toThrow(
      /guess must not be NaN/,
    );
  });

  // Stand-ins of the random grids (properties/pemandu-tick.test.ts, #543):
  // a 1 ms grid from 0, a threshold past the grid's end, guesses at either
  // infinity, a one-tick grid, and a guess far below.
  it.each([
    [1, 0, 60, 0, 0],
    [50, 60, 0, Infinity, 70],
    [10, 5, 20, -Infinity, 12],
    [7, 3, 3, 1e6, 3],
    [13, 0, 60, -1e6, 30],
  ])(
    'equals a scan of the grid every %s from %s to %s steps, guessing %s, for a threshold of %s steps',
    (every, a, b, guess, threshold) => {
      checkGridScan(every, a, b, guess, threshold);
    },
  );
});

describe('nextPurchaseTick (AC3)', () => {
  const course = NEXT_TICK_COURSE;

  function state(understanding: number, intervalMs = 10_000): GameState {
    const anchor = simMs(3 * HOUR_MS);
    return {
      sim: anchor,
      wall: wallMs(START + anchor),
      anchor: {
        sim: anchor,
        understanding: Num.toTuple(Num.from(understanding)),
      },
      owned: { tea: 1 },
      insight: Num.toTuple(Num.from(0)),
      words: {},
      memorySince: simMs(0),
      stamps: 0,
      stampsEarned: 0,
      upgrades: {},
      rng: createStreams(1, ['cards']),
      journeys: [null, null, null],
      cards: [],
      tutorialJourneyUsed: false,
      destination: 0,
      reached: 0,
      finale: false,
      replays: {},
      runSpent: Num.toTuple(Num.from(0)),
      playableRegions: 3,
      grammar: [],
      automation: { enabled: true, intervalMs },
      seq: 0,
    };
  }

  // One tea earns 1 per second, and the next tea costs 10 x 1.15 = 11.5.
  const at = (s: number) => simMs(3 * HOUR_MS + s * 1000);

  it.each([
    [
      'at the first tick after the anchor, when already affordable',
      50,
      10_000,
      at(10),
    ],
    ['never at the anchor itself, even on the grid', 11.5, 10_000, at(10)],
    ['at the first tick, which pays 11.6 from 1.6 held', 1.6, 10_000, at(10)],
    ['one tick on when 0.6 short at the first', 0.9, 10_000, at(20)],
    ['on the 5 s grid, at 15 s', 0, 5_000, at(15)],
    ['on the 1 s grid, at the first whole second past 11.5', 0, 1_000, at(12)],
  ] as const)('buys %s', (_label, held, intervalMs, want) => {
    expect(
      nextPurchaseTick(course, state(held, intervalMs), at(60)).next?.tick,
    ).toBe(want);
  });

  it('includes the tick at `until` and nothing past it', () => {
    expect(nextPurchaseTick(course, state(0), at(20)).next?.tick).toBe(at(20));
    expect(nextPurchaseTick(course, state(0), at(19)).next).toBeUndefined();
  });

  it('finds nothing when nothing is owned and nothing affordable, testing one tick per hour', () => {
    // Nothing is produced, so no tick can be solved for: each of the six
    // segments, 3 h to 8 h and the instant at 8 h, tests only its last tick.
    const idle = { ...state(5), owned: {} };
    expect(nextPurchaseTick(course, idle, at(3600 * 5))).toStrictEqual({
      next: undefined,
      checks: 6,
    });
  });

  it('buys at the first tick when exactly the price is held and nothing is produced, testing that tick alone', () => {
    const idle = { ...state(0), owned: {} };
    const tea = course.regions[0]?.encounters.find((e) => e.id === 'tea');
    if (tea === undefined) throw new Error('the course sells no tea');
    const price = encounterPrice(idle, tea, 1);
    const exact = {
      ...idle,
      anchor: { sim: idle.anchor.sim, understanding: Num.toTuple(price) },
    };
    expect(nextPurchaseTick(course, exact, at(60))).toStrictEqual({
      next: { tick: at(10), understanding: price },
      checks: 1,
    });
  });

  it('walks no span that ends before it starts: producedBetween refuses one', () => {
    const s = state(0);
    expect(() =>
      producedBetween(course, s, simMs(s.sim + 10), simMs(s.sim + 5)),
    ).toThrow(/producedBetween: \d+ is before \d+/);
  });

  it('finds nothing, testing no tick, when the regions reached sell nothing', () => {
    const bare: Course = {
      ...course,
      regions: course.regions.map((r) => ({ ...r, encounters: [] })),
    };
    expect(nextPurchaseTick(bare, state(1e9), at(60))).toStrictEqual({
      next: undefined,
      checks: 0,
    });
  });

  // Stand-ins of the seeded random games (properties/pemandu-tick.test.ts,
  // #543), one for each place a purchase can fall, found by a probe of
  // candidate games (2026-10-12): none inside the horizon, the first tick,
  // past a segment's first tick in a later segment, exactly at `until`, and
  // a game with every field at its largest. Where each fell is pinned.
  const BASE: CaseRecord = {
    interval: 10_000,
    scale: 1,
    tea: 5,
    inn: 0,
    market: 0,
    ferry: 0,
    region2: false,
    discount: 0,
    phrasebook: false,
    stampsEarned: 0,
    hour: 0,
    nearHourEnd: false,
    offset: 0.5,
    skew: 0,
    reviewed: [],
    ticks: 20,
    jitter: 0,
    lead: 0.5,
    festival: false,
    edgeA: 0,
    edgeB: 0,
    untilOnTick: false,
  };
  const GAMES: [string, CaseRecord][] = [
    [
      'beyond the horizon',
      { ...BASE, lead: 1.05, scale: 1_000_000, untilOnTick: true },
    ],
    [
      'at the first tick',
      {
        ...BASE,
        lead: 1.3,
        scale: 1_000,
        tea: 0,
        untilOnTick: true,
        offset: 0.01,
      },
    ],
    [
      'mid-segment, in a later segment',
      {
        ...BASE,
        lead: 0.9,
        nearHourEnd: true,
        untilOnTick: true,
        offset: 0.01,
      },
    ],
    ['at until', { ...BASE, lead: 1, scale: 1_000, untilOnTick: true }],
    [
      'every field at its largest, with a festival in region 2',
      {
        ...BASE,
        interval: 1_000,
        scale: 1_000,
        tea: 30,
        inn: 20,
        market: 10,
        ferry: 3,
        region2: true,
        discount: 2,
        phrasebook: true,
        stampsEarned: 5,
        hour: 50,
        nearHourEnd: true,
        offset: 0.01,
        skew: 5 * DAY_MS,
        reviewed: [
          { k: 0, ageMs: 0 },
          { k: 2, ageMs: 30 * DAY_MS },
        ],
        ticks: 100,
        jitter: 0.999,
        lead: 0.6,
        festival: true,
        edgeA: 0.2,
        edgeB: 0.7,
      },
    ],
  ];
  const WHERE: Record<string, Solved> = {
    'beyond the horizon': {
      none: true,
      firstTick: false,
      midSegment: false,
      laterSegment: false,
      atUntil: false,
    },
    'at the first tick': {
      none: false,
      firstTick: true,
      midSegment: false,
      laterSegment: false,
      atUntil: false,
    },
    'mid-segment, in a later segment': {
      none: false,
      firstTick: false,
      midSegment: true,
      laterSegment: true,
      atUntil: false,
    },
    'at until': {
      none: false,
      firstTick: false,
      midSegment: true,
      laterSegment: false,
      atUntil: true,
    },
    'every field at its largest, with a festival in region 2': {
      none: false,
      firstTick: false,
      midSegment: true,
      laterSegment: true,
      atUntil: false,
    },
  };

  it.each(GAMES)(
    'equals a tick-by-tick scan, checking at most one more tick than it walks segments, for a purchase %s',
    (label, game) => {
      expect(checkNextPurchase(caseOf(game))).toEqual(WHERE[label]);
    },
  );
});
