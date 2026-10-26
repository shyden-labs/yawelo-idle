import { beforeEach, describe, expect, it } from 'vitest';
import { HOUR_MS, simMs, wallMs } from '../src/clock.ts';
import { encounterOutput, purchaseCost } from '../src/encounters.ts';
import { Num } from '../src/num.ts';
import { encounterRate, understandingNow } from '../src/production.ts';
import { advance, buyEncounter, integrate, listen } from '../src/sim.ts';
import { view } from '../src/view.ts';
import { createStreams } from '../src/rng.ts';
import { initialState, ownedCount, type GameState } from '../src/state.ts';
import {
  DAY_MS,
  CAP_MS,
  tea,
  market,
  odd,
  course,
  START,
  deepFreeze,
  stateWith,
  u,
  json,
  relativeError,
  checkLinear,
  checkSequence,
  checkSplit,
  countSplit,
  gapFrom,
  stateOf,
  type Gap,
  type Split,
  type StateRecord,
  type Step,
} from './sim-laws.ts';

/**
 * The time model and the Encounter actions (#27 AC1, AC4 to AC9).
 *
 * The course is declared here rather than imported, so it is checked against
 * the `Course` contract instead of sharing it.
 */

describe('initialState', () => {
  it('starts with nothing at simulated time 0', () => {
    const s = initialState(START, 1);
    expect(s).toEqual({
      sim: 0,
      wall: START,
      anchor: { sim: 0, understanding: [0, 0] },
      owned: {},
      insight: [0, 0],
      words: {},
      memorySince: 0,
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
      runSpent: [0, 0],
      playableRegions: 3,
      grammar: [],
      automation: { enabled: false, intervalMs: 10_000 },
      seq: 0,
    });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('plays every region of v1 unless told otherwise', () => {
    expect(initialState(START, 1).playableRegions).toBe(3);
    expect(initialState(START, 1, 1).playableRegions).toBe(1);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'refuses %s playable regions',
    (regions) => {
      expect(() => initialState(START, 1, regions)).toThrow(
        /playable regions must be a positive safe integer/,
      );
    },
  );

  it('seeds its card stream from the seed', () => {
    expect(initialState(START, 2).rng).toEqual(createStreams(2, ['cards']));
    expect(initialState(START, 2).rng).not.toEqual(initialState(START, 1).rng);
  });

  it.each([-1, 1.5, Number.NaN])('refuses the seed %s', (seed) => {
    expect(() => initialState(START, seed)).toThrow(
      /a seed must be a safe non-negative integer/,
    );
  });

  it('reads owned counts from own keys only', () => {
    const s = initialState(START, 1);
    expect(ownedCount(s, 'toString')).toBe(0);
    expect(ownedCount(s, 'constructor')).toBe(0);
    expect(ownedCount(stateWith({ tea: 3 }, 0), 'tea')).toBe(3);
  });
});

describe('listen (AC1)', () => {
  it('adds exactly 0.25 Understanding to a new game', () => {
    expect(u(listen(course, initialState(START, 1)))).toEqual([2.5, -1]);
  });

  it('adds exactly 0.25 to whatever is held, production included', () => {
    const s = stateWith({ tea: 10, market: 3 }, 123.456, 90_000);
    const before = understandingNow(course, s);
    const after = listen(course, s);
    expect(u(after)).toEqual(Num.toTuple(Num.add(before, Num.from(0.25))));
    expect(after.anchor.sim).toBe(s.sim);
  });

  it('1,000 taps on a new game hold exactly 250', () => {
    let s = initialState(START, 1);
    for (let i = 0; i < 1000; i++) s = listen(course, s);
    expect(u(s)).toEqual(Num.toTuple(Num.from(250)));
  });
});

describe('view (AC4)', () => {
  it('derives values at a later time without changing the state', () => {
    const s = stateWith({ tea: 12, market: 2 }, 50, 1_000);
    const before = json(s);
    const later = wallMs(s.wall + 30 * 60_000);
    const v = view(course, s, later);
    expect(json(s)).toBe(before);
    expect(Num.toTuple(v.understanding)).toEqual(
      u(advance(course, s, later).state),
    );
    expect(Num.toTuple(v.rate)).toEqual(Num.toTuple(encounterRate(course, s)));
  });

  it('at the state own wall time, shows the anchored value plus production since', () => {
    const s = stateWith({ tea: 5 }, 7, 60_000);
    const want = Num.add(
      Num.from(7),
      Num.div(
        Num.mul(encounterRate(course, s), Num.from(60_000)),
        Num.from(1000),
      ),
    );
    expect(Num.toTuple(view(course, s, s.wall).understanding)).toEqual(
      Num.toTuple(want),
    );
  });

  it('stores nothing but the anchor: integrate leaves the anchor alone', () => {
    const s = stateWith({ tea: 5 }, 7, 60_000);
    expect(integrate(course, s, 3 * HOUR_MS).anchor).toEqual(s.anchor);
  });
});

describe('encounterRate (AC3)', () => {
  it('sums the output of every owned Encounter in the course', () => {
    const s = stateWith({ tea: 37, market: 4, toString: 2 }, 0);
    const want = Num.add(
      Num.add(encounterOutput(tea, 37), encounterOutput(market, 4)),
      encounterOutput(odd, 2),
    );
    expect(relativeError(encounterRate(course, s), want)).toBeLessThan(1e-15);
  });

  it('is zero with nothing owned', () => {
    expect(encounterRate(course, stateWith({}, 0)).mantissa).toBe(0);
  });
});

describe('production inside an hour (AC5)', () => {
  // Stand-ins of the random times (properties/sim.test.ts, #543): the
  // hour's first millisecond, the whole hour, its last two and one between.
  it.each([
    [0, 1],
    [0, HOUR_MS - 1],
    [HOUR_MS - 2, 1],
    [1_234_567, 600_000],
  ])('is linear at the Encounter rate from %i ms over %i ms', (from, span) => {
    checkLinear(from, span);
  });
});

describe('integrate (AC6)', () => {
  // Stand-ins of the seeded random splits (properties/sim.test.ts, #543):
  // a split with a zero part, one on an hour edge, one a millisecond before
  // one, and two gaps of up to 72 h, each from a drawn state. Which kinds of
  // split each is, is checked too.
  const STATE: StateRecord = {
    tea: 150,
    market: 20,
    understanding: 1e9,
    anchorSim: 123_456_789,
    lead: 5 * HOUR_MS + 1_234,
    wall: 1.8e12,
    stampsEarned: 7,
    phrasebook: true,
  };
  const SPLIT_CASES: [string, StateRecord, Gap, Gap, Split][] = [
    [
      'a zero part',
      { ...STATE, phrasebook: false },
      { ms: 0 },
      { ms: 90 * 60_000 },
      { 'zero-part': 1, 'on-edge': 0, 'beside-edge': 0 },
    ],
    [
      'on an hour edge',
      STATE,
      { hours: 2, nudge: 0 },
      { ms: 72 * HOUR_MS },
      { 'zero-part': 0, 'on-edge': 1, 'beside-edge': 0 },
    ],
    [
      'beside an hour edge',
      { ...STATE, tea: 0, market: 300, stampsEarned: 20 },
      { hours: 0, nudge: -1 },
      { hours: 71, nudge: 1 },
      { 'zero-part': 0, 'on-edge': 0, 'beside-edge': 1 },
    ],
    [
      'two long gaps from nothing owned',
      { ...STATE, tea: 0, market: 0, understanding: 0, anchorSim: 0, lead: 0 },
      { ms: 72 * HOUR_MS - 7 },
      { ms: 33 * HOUR_MS + 17 },
      { 'zero-part': 0, 'on-edge': 0, 'beside-edge': 0 },
    ],
  ];

  for (const [label, record, ga, gb, kinds] of SPLIT_CASES) {
    const play = (s: GameState): Split => {
      const seen: Split = { 'zero-part': 0, 'on-edge': 0, 'beside-edge': 0 };
      const a = gapFrom(s.sim, ga);
      const b = gapFrom(s.sim + a, gb);
      countSplit(seen, s, a, b);
      checkSplit(s, a, b);
      return seen;
    };

    it(`integrate(integrate(s, a), b) deep-equals integrate(s, a + b), bit for bit, at ${label}`, () => {
      expect(play(stateOf(record))).toEqual(kinds);
    });

    for (const intervalMs of [10_000, 1_000])
      it(`integrate(integrate(s, a), b) deep-equals integrate(s, a + b) with Pemandu buying every ${String(intervalMs)} ms (#33 AC4), at ${label}`, () => {
        const s: GameState = {
          ...stateOf(record),
          automation: { enabled: true, intervalMs },
        };
        expect(play(s)).toEqual(kinds);
      });
  }

  it('moves both clocks by the same amount', () => {
    const s = stateWith({ tea: 1 }, 0, 500);
    const t = integrate(course, s, 1234);
    expect(t.sim - s.sim).toBe(1234);
    expect(t.wall - s.wall).toBe(1234);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses an elapsed time of %s',
    (elapsed) => {
      expect(() => integrate(course, stateWith({}, 0, 5_000), elapsed)).toThrow(
        /SimMs must be a safe non-negative integer/,
      );
    },
  );
});

describe('advance (AC7)', () => {
  let s: GameState;
  beforeEach(() => {
    s = stateWith({ tea: 25, market: 1 }, 1_000, 5_000);
  });

  it('credits 1 hour in full', () => {
    const { state, summary } = advance(course, s, wallMs(s.wall + HOUR_MS));
    expect(summary.creditedMs).toBe(HOUR_MS);
    expect(summary.clipped).toBe(false);
    expect(state.sim).toBe(s.sim + HOUR_MS);
    expect(state.wall).toBe(s.wall + HOUR_MS);
    expect(summary.understandingEarned).toEqual(
      Num.toTuple(
        Num.sub(understandingNow(course, state), understandingNow(course, s)),
      ),
    );
    const want = Num.mul(encounterRate(course, s), Num.from(3600));
    expect(
      relativeError(Num.fromTuple(summary.understandingEarned), want),
    ).toBeLessThan(1e-12);
  });

  it('credits 1 day, exactly the cap, without clipping', () => {
    const { state, summary } = advance(course, s, wallMs(s.wall + DAY_MS));
    expect(summary.creditedMs).toBe(CAP_MS);
    expect(summary.clipped).toBe(false);
    expect(state.sim).toBe(s.sim + DAY_MS);
    expect(state.anchor).toEqual(s.anchor);
  });

  it('clips 1 ms over the cap', () => {
    const { summary } = advance(course, s, wallMs(s.wall + CAP_MS + 1));
    expect(summary.creditedMs).toBe(CAP_MS);
    expect(summary.clipped).toBe(true);
  });

  it('caps 30 days at 24 hours, moves the wall clock all the way, and re-anchors', () => {
    const now = wallMs(s.wall + 30 * DAY_MS);
    const { state, summary } = advance(course, s, now);
    expect(summary.creditedMs).toBe(CAP_MS);
    expect(summary.clipped).toBe(true);
    expect(state.sim).toBe(s.sim + CAP_MS);
    expect(state.wall).toBe(now);
    expect(state.anchor.sim).toBe(state.sim);
    const oneDay = advance(course, s, wallMs(s.wall + DAY_MS));
    expect(summary.understandingEarned).toEqual(
      oneDay.summary.understandingEarned,
    );
    expect(u(state)).toEqual(u(oneDay.state));
  });

  it.each([
    ['an hour back', -HOUR_MS],
    ['the same instant', 0],
  ])('advances nothing for %s', (_label, delta) => {
    const { state, summary } = advance(course, s, wallMs(s.wall + delta));
    expect(state).toEqual(s);
    expect(summary).toEqual({
      creditedMs: 0,
      clipped: false,
      understandingEarned: [0, 0],
      journeysReturned: 0,
    });
  });

  it('leaves its input unchanged', () => {
    const before = json(s);
    advance(course, s, wallMs(s.wall + 30 * DAY_MS));
    expect(json(s)).toBe(before);
  });
});

describe('no reachable state holds NaN, a negative or an infinite value (AC8)', () => {
  // Stand-ins of the seeded random sequences (properties/sim.test.ts,
  // #543): a game that listens, buys within its means and beyond, steps its
  // clock back and is away past the cap. What it reached is pinned.
  const STEPS: Step[] = [
    ...Array.from({ length: 40 }, (): Step => ({ kind: 'listen' })),
    { kind: 'buy', id: 'tea', count: 1 },
    { kind: 'buy', id: 'market', count: 20 },
    { kind: 'advance', deltaMs: -DAY_MS },
    { kind: 'listen' },
    { kind: 'buy', id: 'toString', count: 1 },
    { kind: 'advance', deltaMs: 40 * DAY_MS },
    { kind: 'buy', id: 'tea', count: 20 },
    { kind: 'buy', id: 'market', count: 3 },
    { kind: 'advance', deltaMs: 3 * HOUR_MS + 1 },
    { kind: 'listen' },
  ];

  it('over a sequence of listens, purchases and returns', () => {
    expect(checkSequence(STEPS)).toEqual({
      bought: 3,
      'buy-refused': 2,
      'clock-back': 1,
      clipped: 1,
      checked: 313,
    });
  });
});

describe('buyEncounter (AC9)', () => {
  it('rejects an unaffordable purchase with a typed Rejection and leaves state alone', () => {
    const s = stateWith({}, 9.99);
    const before = json(s);
    const r = buyEncounter(course, s, 'tea', 1);
    expect(r).toEqual({
      ok: false,
      rejection: {
        kind: 'unaffordable',
        cost: Num.toTuple(purchaseCost(tea, 0, 1)),
        understanding: Num.toTuple(Num.from(9.99)),
      },
    });
    expect(json(s)).toBe(before);
  });

  it('buys when Understanding equals the cost exactly, leaving zero', () => {
    const cost = purchaseCost(market, 3, 2);
    const s = deepFreeze({
      ...stateWith({ market: 3 }, 0),
      anchor: { sim: simMs(0), understanding: Num.toTuple(cost) },
    });
    const r = buyEncounter(course, s, 'market', 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(u(r.state)).toEqual([0, 0]);
    expect(ownedCount(r.state, 'market')).toBe(5);
  });

  it('pays from Understanding produced since the anchor, and re-anchors', () => {
    const s = stateWith({ tea: 10 }, 0, 10 * 60_000);
    const held = understandingNow(course, s);
    const r = buyEncounter(course, s, 'tea', 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.anchor.sim).toBe(s.sim);
    expect(r.state.anchor.understanding).toEqual(
      Num.toTuple(Num.sub(held, purchaseCost(tea, 10, 1))),
    );
    expect(ownedCount(r.state, 'tea')).toBe(11);
  });

  it('buys an Encounter whose id is an Object.prototype member', () => {
    const r = buyEncounter(course, stateWith({}, 100), 'toString', 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(ownedCount(r.state, 'toString')).toBe(3);
    expect(JSON.parse(JSON.stringify(r.state))).toEqual(r.state);
  });

  it.each(['nope', 'constructor', '__proto__', ''])(
    'rejects the unknown Encounter %j',
    (id) => {
      const s = stateWith({}, 1e9);
      const before = json(s);
      expect(buyEncounter(course, s, id, 1)).toEqual({
        ok: false,
        rejection: { kind: 'unknownEncounter', id },
      });
      expect(json(s)).toBe(before);
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a count of %s',
    (count) => {
      const s = stateWith({}, 1e9);
      const before = json(s);
      expect(buyEncounter(course, s, 'tea', count)).toEqual({
        ok: false,
        rejection: { kind: 'invalidCount', count },
      });
      expect(json(s)).toBe(before);
    },
  );
});
