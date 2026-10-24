import { expect } from 'vitest';
import { HOUR_MS, simMs, wallMs, type WallMs } from '../src/clock.ts';
import type { Course, Encounter } from '../src/course.ts';
import { Num, type NumTuple } from '../src/num.ts';
import { encounterRate, understandingNow } from '../src/production.ts';
import { advance, buyEncounter, integrate, listen } from '../src/sim.ts';
import { createStreams } from '../src/rng.ts';
import { initialState, type GameState } from '../src/state.ts';

/**
 * The time model's course and states (#27), and what integrate and the
 * actions must satisfy: production is linear inside an hour, a split of time
 * lands where the whole does, and no reachable state holds NaN, a negative
 * or an infinite value. The unit suite checks chosen cases (sim.test.ts) and
 * the properties suite random ones (properties/sim.test.ts, #543), through
 * the same checks.
 *
 * The course is declared here rather than imported, so it is checked
 * against the `Course` contract instead of sharing it.
 */

export const DAY_MS = 24 * HOUR_MS;
export const CAP_MS = DAY_MS;

export const tea: Encounter = { id: 'tea', tags: ['food'], c0: 10, p0: 0.1 };
export const market: Encounter = {
  id: 'market',
  tags: ['food'],
  c0: 100,
  p0: 1,
};
/** An id that is also an `Object.prototype` member. */
export const odd: Encounter = {
  id: 'toString',
  tags: ['food'],
  c0: 5,
  p0: 0.5,
};

export const course: Course = {
  id: 'test-course',
  tags: ['food'],
  regions: [
    {
      id: 'r0',
      destinations: [],
      encounters: [tea, market, odd],
      cardSets: [],
      cultureCards: [],
      grammarNodes: [],
    },
  ],
};

export const START: WallMs = wallMs(Date.UTC(2027, 0, 4));

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function stateWith(
  owned: Record<string, number>,
  understanding: number,
  leadMs = 0,
): GameState {
  const base = initialState(START, 1);
  return deepFreeze({
    ...base,
    sim: simMs(leadMs),
    wall: wallMs(START + leadMs),
    anchor: {
      sim: simMs(0),
      understanding: Num.toTuple(Num.from(understanding)),
    },
    owned,
  });
}

export function u(state: GameState): NumTuple {
  return Num.toTuple(understandingNow(course, state));
}

export function units(state: GameState): number {
  return Object.values(state.owned).reduce((a, b) => a + b, 0);
}

export function json(state: GameState): string {
  return JSON.stringify(state);
}

export function relativeError(got: Num, want: Num): number {
  return Math.abs(Num.toNumber(Num.div(Num.sub(got, want), want)));
}

/** A state as the property draws it. */
export interface StateRecord {
  readonly tea: number;
  readonly market: number;
  readonly understanding: number;
  readonly anchorSim: number;
  readonly lead: number;
  readonly wall: number;
  readonly stampsEarned: number;
  readonly phrasebook: boolean;
}

/** The state `r` draws. */
export function stateOf(r: StateRecord): GameState {
  return {
    sim: simMs(r.anchorSim + r.lead),
    wall: wallMs(r.wall),
    anchor: {
      sim: simMs(r.anchorSim),
      understanding: Num.toTuple(Num.from(r.understanding)),
    },
    owned: { tea: r.tea, market: r.market },
    insight: Num.toTuple(Num.from(0)),
    words: {},
    memorySince: simMs(r.anchorSim),
    stamps: 0,
    stampsEarned: r.stampsEarned,
    upgrades: r.phrasebook ? { 'phrasebook:food': 1 } : {},
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
    automation: { enabled: false, intervalMs: 10_000 },
    seq: 0,
  };
}

/**
 * A gap of simulated time: none, any length up to `maxHours`, or one that ends on
 * an hour edge or a millisecond either side of it, `hours` edges further on.
 * Uniform lengths almost never end on an edge, and an edge is where a split
 * can go wrong: it is where a production bucket and every Pemandu grid
 * (10 s, 5 s, 2 s and 1 s all divide an hour) change (#474).
 */
export type Gap =
  | { readonly ms: number }
  | { readonly hours: number; readonly nudge: -1 | 0 | 1 };

/** The gap's length in ms when it starts at `from`. */
export function gapFrom(from: number, gap: Gap): number {
  if ('ms' in gap) return gap.ms;
  const edge = from - (from % HOUR_MS) + (gap.hours + 1) * HOUR_MS;
  return edge + gap.nudge - from;
}

/** What a split reached: a zero part, and where the split fell against an hour edge. */
export const SPLITS = ['zero-part', 'on-edge', 'beside-edge'] as const;
export type Split = Record<(typeof SPLITS)[number], number>;

export function countSplit(
  seen: Split,
  s: GameState,
  a: number,
  b: number,
): void {
  if (a === 0 || b === 0) seen['zero-part']++;
  const at = (s.sim + a) % HOUR_MS;
  if (at === 0) seen['on-edge']++;
  if (at === 1 || at === HOUR_MS - 1) seen['beside-edge']++;
}

/**
 * Splits `s`'s next `a + b` ms at `a` and checks the two halves land where
 * the whole does: the state deep-equal, and Understanding read back equal,
 * since a memo keyed wrongly could answer two equal states differently.
 */
export function checkSplit(s: GameState, a: number, b: number): GameState {
  const split = integrate(course, integrate(course, s, a), b);
  const whole = integrate(course, s, a + b);
  expect(split).toEqual(whole);
  expect(u(split)).toEqual(u(whole));
  return whole;
}

/**
 * Every way `state` breaks AC8, and how many values were checked: thrown as
 * one error rather than an `expect` a field (#474). The count is a recorded
 * floor, so a check that stops reading the state fails.
 */
export function faults(state: GameState): { checked: number; found: string[] } {
  const found: string[] = [];
  let checked = 0;
  const times = { sim: state.sim, wall: state.wall, anchor: state.anchor.sim };
  for (const [name, t] of Object.entries(times)) {
    checked++;
    if (!Number.isSafeInteger(t) || t < 0)
      found.push(`${name} time ${String(t)}`);
  }
  checked++;
  if (state.anchor.sim > state.sim) found.push('anchor after sim');
  const values = {
    held: Num.fromTuple(state.anchor.understanding),
    now: understandingNow(course, state),
  };
  for (const [name, n] of Object.entries(values)) {
    checked++;
    if (!Number.isFinite(n.mantissa) || n.mantissa < 0)
      found.push(`${name} ${String(n.mantissa)}`);
  }
  for (const [id, n] of Object.entries(state.owned)) {
    checked++;
    if (!Number.isSafeInteger(n) || n < 0)
      found.push(`owns ${String(n)} ${id}`);
  }
  return { checked, found };
}

/** One step of a sequence the AC8 property draws. */
export type Step =
  | { readonly kind: 'listen' }
  | { readonly kind: 'buy'; readonly id: string; readonly count: number }
  | { readonly kind: 'advance'; readonly deltaMs: number };

/** What a sequence reached: each a recorded floor of the property. */
export const SEQUENCE_REACHED = [
  'bought',
  'buy-refused',
  'clock-back',
  'clipped',
  'checked',
] as const;
export type SequenceReached = Record<(typeof SEQUENCE_REACHED)[number], number>;

/**
 * Plays `steps` from a new game, checking after every step that no value is
 * NaN, negative or infinite (AC8), and says what the steps reached.
 */
export function checkSequence(steps: readonly Step[]): SequenceReached {
  const reached: SequenceReached = {
    bought: 0,
    'buy-refused': 0,
    'clock-back': 0,
    clipped: 0,
    checked: 0,
  };
  let s = initialState(START, 1);
  // one scenario: each step plays on from the state the last one left
  for (const e of steps) {
    if (e.kind === 'listen') s = listen(course, s);
    if (e.kind === 'buy') {
      const r = buyEncounter(course, s, e.id, e.count);
      reached[r.ok ? 'bought' : 'buy-refused']++;
      if (r.ok) s = r.state;
    }
    if (e.kind === 'advance') {
      const moved = advance(course, s, wallMs(s.wall + e.deltaMs));
      if (e.deltaMs < 0) reached['clock-back']++;
      if (moved.summary.clipped) reached.clipped++;
      s = moved.state;
    }
    const { checked, found } = faults(s);
    reached.checked += checked;
    if (found.length > 0) throw new Error(found.join('; '));
  }
  return reached;
}

/** A game owning 37 tea, 4 market and 2 of the odd Encounter, holding nothing, built on first use (#97). */
export function producing(): GameState {
  return stateWith({ tea: 37, market: 4, toString: 2 }, 0);
}

/**
 * Understanding read at `from` and at `from + span` (clipped inside the
 * hour) grows at the Encounter rate, to 1e-9.
 */
export function checkLinear(from: number, span: number): void {
  const s = producing();
  const rate = encounterRate(course, s);
  const to = Math.min(from + span, HOUR_MS - 1);
  const a = understandingNow(course, integrate(course, s, from));
  const b = understandingNow(course, integrate(course, s, to));
  const perSecond = Num.div(
    Num.mul(Num.sub(b, a), Num.from(1000)),
    Num.from(to - from),
  );
  expect(relativeError(perSecond, rate)).toBeLessThan(1e-9);
}

/** Adds what one sequence reached to the running totals. */
export function addReached(
  into: SequenceReached,
  got: Readonly<SequenceReached>,
): void {
  for (const name of SEQUENCE_REACHED) into[name] += got[name];
}
