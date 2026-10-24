import { expect } from 'vitest';
import { nextGridTick, simMs, wallMs, type WallMs } from '../src/clock.ts';
import type { Course, Destination, Encounter, Region } from '../src/course.ts';
import { bestPayback } from '../src/automation.ts';
import { newWordMemory, review, type WordMemory } from '../src/memory.ts';
import { Num, type NumTuple } from '../src/num.ts';
import {
  buyEncounter,
  integrate,
  setAutomation,
  type Rejection,
  type Result,
} from '../src/sim.ts';
import { initialState, type GameState } from '../src/state.ts';

/**
 * Pemandu's course and games (#33), and what its purchases must satisfy:
 * `integrate` buys what buying tick by tick with bestPayback and
 * buyEncounter buys. The unit suite checks chosen games
 * (automation.test.ts) and the properties suite seeded random ones
 * (properties/automation.test.ts, #543), through the same check.
 *
 * The course is declared here, so it is checked against the `Course`
 * contract rather than sharing it.
 */

export const START: WallMs = wallMs(Date.UTC(2027, 0, 4));

export function destination(r: number, d: number): Destination {
  const id = `r${String(r)}-d${String(d)}`;
  return {
    id,
    lexicon: Array.from({ length: 20 }, (_, k) => ({
      id: `${id}-w${String(k)}`,
      tags: ['food'],
      cefr: 'A1' as const,
    })),
  };
}

export function region(r: number): Region {
  return {
    id: `r${String(r)}`,
    destinations: [0, 1, 2, 3].map((d) => destination(r, d)),
    encounters: [
      { id: `tea${String(r)}`, tags: ['food'], c0: 10, p0: 1 },
      { id: `market${String(r)}`, tags: ['food'], c0: 100, p0: 8 },
    ],
    cardSets: [],
    cultureCards: [],
    grammarNodes: [],
  };
}

export const course: Course = {
  id: 'automation-course',
  tags: ['food'],
  regions: [region(0), region(1), region(2)],
};

/** Region 1 only: Pemandu never opens on it. */
export const oneRegion: Course = { ...course, regions: [region(0)] };

/** Region 2 has no destinations, so the first one past region 1 is region 3's. */
export const hollow: Course = {
  ...course,
  regions: [region(0), { ...region(1), destinations: [] }, region(2)],
};

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function tuple(x: number): NumTuple {
  return Num.toTuple(Num.from(x));
}

export interface At {
  readonly upgrades?: Readonly<Record<string, number>>;
  readonly owned?: Readonly<Record<string, number>>;
  readonly held?: number;
  readonly simMs?: number;
  readonly words?: Readonly<Record<string, WordMemory>>;
}

/** A game that has reached destination `reached` and stands there. */
export function at(reached: number, opts: At = {}): GameState {
  const base = initialState(START, 1);
  const sim = simMs(opts.simMs ?? 0);
  return deepFreeze({
    ...base,
    sim,
    wall: wallMs(START + sim),
    anchor: { sim: simMs(0), understanding: tuple(opts.held ?? 0) },
    owned: opts.owned ?? {},
    upgrades: opts.upgrades ?? {},
    words: opts.words ?? {},
    destination: reached,
    reached,
  });
}

export function ok(result: Result): GameState {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result.state;
}

export function refused(result: Result): Rejection {
  if (result.ok) throw new Error('expected a rejection');
  return result.rejection;
}

export const EARLY = { pemanduEarly: 1 };
export const ALL_TIERS = {
  pemanduFaster1: 1,
  pemanduFaster2: 1,
  pemanduFaster3: 1,
};
export function pemandu(state: GameState, intervalMs = 10_000): GameState {
  return ok(setAutomation(course, state, true, intervalMs));
}

export function unitsOwned(state: GameState): number {
  return Object.values(state.owned).reduce((a, b) => a + b, 0);
}

/** The reference: every tick in (anchor, sim + elapsed], one at a time. */
export function tickByTick(
  c: Course,
  s: GameState,
  elapsed: number,
): GameState {
  const until = s.sim + elapsed;
  const every = s.automation.intervalMs;
  let x = s;
  for (
    let t = nextGridTick(s.anchor.sim, every);
    t <= until;
    t = simMs(t + every)
  ) {
    const here = { ...x, sim: t, wall: wallMs(x.wall + t - x.sim) };
    const id = bestPayback(c, here);
    if (id !== undefined) x = ok(buyEncounter(c, here, id, 1));
  }
  return { ...x, sim: simMs(until), wall: wallMs(s.wall + elapsed) };
}

/** A game Pemandu plays on, as the property draws it. */
export interface PemanduGame {
  readonly interval: number;
  readonly reached: number;
  readonly tea0: number;
  readonly market0: number;
  readonly tea1: number;
  readonly held: number;
  readonly sim: number;
  readonly ticks: number;
  readonly discount: number;
  readonly phrasebook: boolean;
  readonly reviewed: number;
}

/**
 * `integrate` over `r.ticks` of Pemandu's ticks buys what buying tick by
 * tick with bestPayback and buyEncounter buys. Returns the units bought.
 */
export function checkTickByTick(r: PemanduGame): number {
  // Reviewed words make each bonus hang on the wall clock, so a tick bought
  // at the wrong skew between the clocks pays wrong. Each review falls
  // before the anchor at 0, as every review in a real game falls at or
  // before `memorySince`.
  const words = Object.fromEntries(
    Array.from({ length: r.reviewed }, (_, k) => {
      const when = wallMs(START - (k + 1) * 86_400_000);
      return [`r0-d0-w${String(k)}`, review(newWordMemory(when), when, true)];
    }),
  );
  const s = pemandu(
    at(r.reached, {
      held: r.held,
      simMs: r.sim,
      words,
      owned: { tea0: r.tea0, market0: r.market0, tea1: r.tea1 },
      upgrades: {
        ...ALL_TIERS,
        ...EARLY,
        ...(r.discount > 0 ? { encounterDiscount: r.discount } : {}),
        ...(r.phrasebook ? { 'phrasebook:food': 1 } : {}),
      },
    }),
    r.interval,
  );
  const elapsed = r.ticks * r.interval;
  const got = integrate(course, s, elapsed);
  expect(got).toEqual(tickByTick(course, s, elapsed));
  return unitsOwned(got) - unitsOwned(s);
}

/**
 * The choice (AC2): with nothing owned, no words and no stamps, an
 * Encounter's first unit adds exactly its p0, so cost / Δrate is c0 / p0:
 * tea 10, inn 5, market 6.67, palace 50, and region 2's ferry 0.1.
 */
export const TEA: Encounter = { id: 'tea', tags: ['food'], c0: 10, p0: 1 };

function shopRegion(r: number): Region {
  const encounters =
    r === 0
      ? [
          TEA,
          { id: 'inn', tags: ['travel'], c0: 50, p0: 10 },
          { id: 'market', tags: ['food'], c0: 100, p0: 15 },
          { id: 'palace', tags: ['travel'], c0: 10_000, p0: 200 },
        ]
      : [{ id: `ferry${String(r)}`, tags: ['travel'], c0: 10, p0: 100 }];
  return { ...region(r), encounters };
}

export const shop: Course = {
  id: 'shop-course',
  tags: ['food', 'travel'],
  regions: [shopRegion(0), shopRegion(1), shopRegion(2)],
};

/** Two Encounters alike in all but id: 'Zed' sorts before 'apple' by code unit. */
export const twins: Course = {
  ...shop,
  regions: [
    {
      ...region(0),
      encounters: [
        { id: 'apple', tags: ['food'], c0: 10, p0: 1 },
        { id: 'Zed', tags: ['food'], c0: 10, p0: 1 },
      ],
    },
  ],
};

/** Every Encounter of the shop course, with its id: a test table. */
export const SHOP_ENCOUNTERS = shop.regions
  .flatMap((r) => r.encounters)
  .map((e) => [e.id, e] as const);
