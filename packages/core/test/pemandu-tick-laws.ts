import { expect } from 'vitest';
import { firstHolding, nextPurchaseTick } from '../src/automation';
import {
  HOUR_MS,
  nextGridTick,
  simMs,
  wallMs,
  type SimMs,
  type WallMs,
} from '../src/clock';
import type { Course, CultureCard, Region } from '../src/course';
import { newWordMemory, review, type WordMemory } from '../src/memory';
import { Num } from '../src/num';
import { rateAt, segments, understandingNow } from '../src/production';
import { createStreams } from '../src/rng';
import type { GameState } from '../src/state';
import { encounterPrice } from '../src/upgrades';

/**
 * Pemandu's next purchase tick (#33 AC3): the shop courses, the games the
 * property draws, and what each must satisfy. The unit suite checks chosen
 * games (pemandu-tick.test.ts) and the properties suite random ones
 * (properties/pemandu-tick.test.ts, #543), through the same checks.
 */

export const START: WallMs = wallMs(Date.UTC(2027, 0, 4));
export const INTERVALS = [10_000, 5_000, 2_000, 1_000] as const;

export function words(r: number): Region['destinations'][number]['lexicon'] {
  return [0, 1, 2].map((k) => ({
    id: `r${String(r)}-w${String(k)}`,
    tags: [k === 2 ? 'travel' : 'food'],
    cefr: 'A1' as const,
  }));
}

export function lebaran(window: readonly [number, number]): CultureCard {
  return {
    id: 'lebaran',
    setId: 'feasts',
    tags: ['food'],
    bonus: 0.5,
    phrasePack: [],
    festival: { windows: [{ startWallMs: window[0], endWallMs: window[1] }] },
  };
}

export function shopRegion(
  r: number,
  scale: number,
  card?: CultureCard,
): Region {
  return {
    id: `r${String(r)}`,
    destinations: [0, 1, 2, 3].map((d) => ({
      id: `r${String(r)}-d${String(d)}`,
      lexicon: d === 0 ? words(r) : [],
    })),
    encounters:
      r === 0
        ? [
            { id: 'tea', tags: ['food'], c0: 10 * scale, p0: 1 },
            { id: 'inn', tags: ['travel'], c0: 50 * scale, p0: 10 },
            { id: 'market', tags: ['food'], c0: 100 * scale, p0: 15 },
          ]
        : [
            {
              id: `ferry${String(r)}`,
              tags: ['travel'],
              c0: 10 * scale,
              p0: 100,
            },
          ],
    cardSets: card === undefined ? [] : [{ id: 'feasts', bonus: 0.25 }],
    cultureCards: card === undefined ? [] : [card],
    grammarNodes: [],
  };
}

/** Every price is `scale` times the listed one, so a purchase can be hours away. */
export function shopWith(window: readonly [number, number], scale = 1): Course {
  return {
    id: 'pemandu-course',
    tags: ['food', 'travel'],
    regions: [
      shopRegion(0, scale, lebaran(window)),
      shopRegion(1, scale),
      shopRegion(2, scale),
    ],
  };
}

/** The state at simulated time `t`, the skew between the clocks kept. */
export function positioned(state: GameState, t: SimMs): GameState {
  return { ...state, sim: t, wall: wallMs(state.wall + t - state.sim) };
}

/** The reference: every tick in (anchor, until], one at a time. */
export function scan(
  course: Course,
  state: GameState,
  until: SimMs,
): SimMs | undefined {
  const reachable = course.regions
    .slice(0, state.reached >= 4 ? 2 : 1)
    .flatMap((r) => r.encounters);
  const cheapest = reachable
    .map((e) => encounterPrice(state, e, 1))
    .reduce((a, b) => (Num.cmp(a, b) <= 0 ? a : b));
  const { intervalMs } = state.automation;
  for (
    let t = nextGridTick(state.anchor.sim, intervalMs);
    t <= until;
    t = simMs(t + intervalMs)
  ) {
    const held = understandingNow(course, positioned(state, t));
    if (Num.cmp(cheapest, held) <= 0) return t;
  }
  return undefined;
}

/** The shop course `nextPurchaseTick`'s chosen cases run on: no festival. */
export const NEXT_TICK_COURSE = shopWith([0, 1]);

export interface Case {
  readonly course: Course;
  readonly state: GameState;
  readonly until: SimMs;
}

/** A game as the property draws it: fractions are in thousandths, read as fractions. */
export interface CaseRecord {
  readonly interval: (typeof INTERVALS)[number];
  readonly scale: number;
  readonly tea: number;
  readonly inn: number;
  readonly market: number;
  readonly ferry: number;
  readonly region2: boolean;
  readonly discount: number;
  readonly phrasebook: boolean;
  readonly stampsEarned: number;
  readonly hour: number;
  readonly nearHourEnd: boolean;
  readonly offset: number;
  readonly skew: number;
  readonly reviewed: readonly { readonly k: number; readonly ageMs: number }[];
  readonly ticks: number;
  readonly jitter: number;
  readonly lead: number;
  readonly festival: boolean;
  readonly edgeA: number;
  readonly edgeB: number;
  readonly untilOnTick: boolean;
}

/** The game, its course and horizon that `r` draws. */
export function caseOf(r: CaseRecord): Case {
  const horizon = r.ticks * r.interval + Math.floor(r.jitter * r.interval);
  const within = r.nearHourEnd
    ? HOUR_MS - Math.floor(r.offset * Math.min(horizon + 1, HOUR_MS))
    : Math.floor(r.offset * HOUR_MS);
  const anchor = simMs(r.hour * HOUR_MS + Math.min(within, HOUR_MS - 1));
  const wall = START + anchor + r.skew;
  const [a, b] = [r.edgeA, r.edgeB].map((x) =>
    Math.floor(wall + x * (horizon + 1)),
  ) as [number, number];
  const window: readonly [number, number] = r.festival
    ? [Math.min(a, b), Math.max(a, b) + 1]
    : [0, 1];
  const course = shopWith(window, r.scale);
  const held: Record<string, WordMemory> = {};
  for (const { k, ageMs } of r.reviewed) {
    const id = `r0-w${String(k)}`;
    held[id] = review(
      newWordMemory(wallMs(wall - ageMs - 1)),
      wallMs(wall - ageMs),
      true,
    );
  }
  const base: GameState = {
    sim: anchor,
    wall: wallMs(wall),
    anchor: { sim: anchor, understanding: Num.toTuple(Num.from(0)) },
    owned: {
      tea: r.tea,
      inn: r.inn,
      market: r.market,
      ...(r.region2 ? { ferry1: r.ferry } : {}),
    },
    insight: Num.toTuple(Num.from(0)),
    words: held,
    memorySince: anchor,
    stamps: 0,
    stampsEarned: r.stampsEarned,
    upgrades: {
      ...(r.discount > 0 ? { encounterDiscount: r.discount } : {}),
      ...(r.phrasebook ? { 'phrasebook:food': 1 } : {}),
    },
    rng: createStreams(1, ['cards']),
    journeys: [null, null, null],
    cards: r.festival ? ['lebaran'] : [],
    tutorialJourneyUsed: false,
    destination: r.region2 ? 4 : 0,
    reached: r.region2 ? 4 : 0,
    finale: false,
    replays: {},
    runSpent: Num.toTuple(Num.from(0)),
    playableRegions: 3,
    grammar: [],
    automation: { enabled: true, intervalMs: r.interval },
    seq: 0,
  };
  // Hold the cheapest price less what `lead` of the horizon earns at the
  // anchor's rate, so most purchases land inside the horizon, some at its
  // first tick and some beyond it.
  const cheapest = course.regions
    .slice(0, r.region2 ? 2 : 1)
    .flatMap((g) => g.encounters)
    .map((e) => Num.toNumber(encounterPrice(base, e, 1)))
    .reduce((x, y) => Math.min(x, y));
  const rate = Num.toNumber(rateAt(course, base, anchor));
  const understanding = Math.max(
    0,
    cheapest - (rate * r.lead * horizon) / 1000,
  );
  return {
    course,
    state: {
      ...base,
      anchor: {
        sim: anchor,
        understanding: Num.toTuple(Num.from(understanding)),
      },
    },
    // On a tick: the first tick of the grid at or after the horizon's end,
    // which is the end itself when it falls on one, 0 included (#800).
    until: simMs(
      r.untilOnTick && (anchor + horizon) % r.interval !== 0
        ? nextGridTick(simMs(anchor + horizon), r.interval)
        : anchor + horizon,
    ),
  };
}

/**
 * `firstHolding` on the grid of `every` from `a` to `b` steps finds the
 * first tick at or past `threshold` steps, as a scan does, from any `guess`.
 */
export function checkGridScan(
  every: number,
  a: number,
  b: number,
  guess: number,
  threshold: number,
): void {
  const g = {
    first: Math.min(a, b) * every,
    last: Math.max(a, b) * every,
    every,
  };
  const holds = (t: number): boolean => t >= threshold * every;
  let want: number | undefined;
  for (let t = g.first; t <= g.last; t += every) {
    if (holds(t)) {
      want = t;
      break;
    }
  }
  expect(firstHolding(g, guess * every, holds).tick).toBe(want);
}

/** Where a solved purchase fell, for the property's reach counts. */
export interface Solved {
  readonly none: boolean;
  readonly firstTick: boolean;
  readonly midSegment: boolean;
  readonly laterSegment: boolean;
  readonly atUntil: boolean;
}

/**
 * `nextPurchaseTick` finds the tick a tick-by-tick scan finds, testing at
 * most one more tick than it walks segments, and returns the Understanding
 * `understandingNow` gives there. Says where the purchase fell.
 */
export function checkNextPurchase({
  course: c,
  state: s,
  until,
}: Case): Solved {
  const got = nextPurchaseTick(c, s, until);
  const tick = got.next?.tick;
  expect(tick).toBe(scan(c, s, until));
  const anchor = s.anchor.sim;
  const every = s.automation.intervalMs;
  const walked = [...segments(c, s, anchor, simMs(until + 1))];
  // One test per segment that holds no purchase, and two, that tick and the
  // one before, in the segment that does (AC3).
  expect(got.checks).toBeLessThanOrEqual(walked.length + 1);
  const solved = {
    none: false,
    firstTick: false,
    midSegment: false,
    laterSegment: false,
    atUntil: false,
  };
  if (tick === undefined) return { ...solved, none: true };
  // The Understanding returned is the bits `understandingNow` gives at the
  // tick, which a purchase there anchors with.
  expect(got.next?.understanding).toEqual(
    understandingNow(c, positioned(s, tick)),
  );
  const k = walked.findIndex((g) => g.start <= tick && tick < g.end);
  const segment = walked[k];
  if (segment === undefined)
    throw new Error(`no segment holds ${String(tick)}`);
  const start = segment.start === anchor ? anchor : simMs(segment.start - 1);
  const firstTick = tick === nextGridTick(anchor, every);
  return {
    ...solved,
    atUntil: tick === until,
    firstTick,
    midSegment: !firstTick && tick > nextGridTick(start, every),
    laterSegment: k > 0,
  };
}
