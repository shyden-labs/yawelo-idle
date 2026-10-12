import { expect } from 'vitest';
import { syntheticCourse } from '../fixtures/synthetic-course';
import { wallMs, type WallMs } from '../src/clock';
import type { Course } from '../src/course';
import type { GameEvent } from '../src/events';
import { collectJourney, startJourney } from '../src/journeys';
import { apply } from '../src/log';
import { newWordMemory } from '../src/memory';
import { Num } from '../src/num';
import { setSail } from '../src/sail';
import {
  advance,
  answerPractice,
  answerReview,
  buyEncounter,
  buyGrammarNode,
  buyUpgrade,
  listen,
  pickUpWord,
  setAutomation,
  type Result,
} from '../src/sim';
import { initialState, type GameState } from '../src/state';

/**
 * The event log's scenario and states (#34), and what `apply` must satisfy
 * at one event: a refused event leaves its input unchanged and `apply`
 * answers as the action called directly does, and `apply` commutes with
 * `advance` within the offline cap. The unit suite checks chosen events
 * (log.test.ts) and the properties suite random ones
 * (properties/log.test.ts, #543), through the same checks.
 */

export const START: WallMs = wallMs(Date.UTC(2027, 0, 4, 8));
export const MINUTE_MS = 60_000;

let builtCourse: Course | undefined;
/** The synthetic course, built on first use rather than at collection (#97). */
export function course(): Course {
  builtCourse ??= syntheticCourse(1);
  return builtCourse;
}

/** The number of the first destination of region 2: grammar and Pemandu are open there. */
export function regionTwoStart(c: Course): number {
  return c.regions[0]?.destinations.length ?? 0;
}

/**
 * A state at region 2's first destination with plenty of every currency and
 * every word of its lexicon but the last held and due, so each event type
 * has something it can do. Plain data, so it is built by spreading.
 */
export function rich(c: Course): GameState {
  const number = regionTwoStart(c);
  const lexicon = c.regions[1]?.destinations[0]?.lexicon ?? [];
  const base = initialState(START, 34);
  return {
    ...base,
    anchor: { sim: base.sim, understanding: Num.toTuple(Num.from(1e40)) },
    insight: Num.toTuple(Num.from(1e12)),
    stamps: 1000,
    stampsEarned: 1000,
    destination: number,
    reached: number,
    words: Object.fromEntries(
      lexicon.slice(0, -1).map((item) => [item.id, newWordMemory(START)]),
    ),
  };
}

export function firstWord(c: Course): string {
  return c.regions[1]?.destinations[0]?.lexicon[0]?.id ?? '';
}

/**
 * One event of each type, in an order where each is accepted: resume first,
 * Set Sail last, since a sail resets Encounters and Understanding.
 */
export function scenario(c: Course): readonly GameEvent[] {
  const at = (minutes: number): WallMs => wallMs(START + minutes * MINUTE_MS);
  const encounter = c.regions[0]?.encounters[0]?.id ?? '';
  const node = c.regions[0]?.grammarNodes[0]?.id ?? '';
  return [
    { type: 'resume', seq: 1, wallMs: at(1) },
    { type: 'listen', seq: 2, wallMs: at(2) },
    { type: 'buyEncounter', seq: 3, wallMs: at(3), id: encounter, count: 3 },
    { type: 'pickUpWord', seq: 4, wallMs: at(4) },
    {
      type: 'answerReview',
      seq: 5,
      wallMs: at(5),
      itemId: firstWord(c),
      correct: true,
      latencyMs: 2500,
      promptType: 'choice',
    },
    { type: 'answerPractice', seq: 6, wallMs: at(6), itemId: firstWord(c) },
    { type: 'buyUpgrade', seq: 7, wallMs: at(7), id: 'offlineCap' },
    { type: 'startJourney', seq: 8, wallMs: at(8), slot: 0, durationId: '2h' },
    { type: 'collectJourney', seq: 9, wallMs: at(8 + 121), slot: 0 },
    { type: 'buyGrammarNode', seq: 10, wallMs: at(130), id: node },
    {
      type: 'setAutomation',
      seq: 11,
      wallMs: at(131),
      enabled: true,
      intervalMs: 10_000,
    },
    { type: 'setSail', seq: 12, wallMs: at(132) },
  ];
}

/**
 * The action an event names, called directly: the reference `apply` is
 * checked against. Written out here rather than shared with `log.ts`.
 */
export function direct(c: Course, state: GameState, event: GameEvent): Result {
  const at = advance(c, state, event.wallMs).state;
  switch (event.type) {
    case 'resume':
      return { ok: true, state: at };
    case 'listen':
      return { ok: true, state: listen(c, at) };
    case 'buyEncounter':
      return buyEncounter(c, at, event.id, event.count);
    case 'pickUpWord':
      return pickUpWord(c, at);
    case 'answerReview':
      return answerReview(c, at, event.itemId, event.correct);
    case 'answerPractice':
      return answerPractice(at, event.itemId);
    case 'buyUpgrade':
      return buyUpgrade(c, at, event.id);
    case 'startJourney':
      return startJourney(c, at, event.slot, event.durationId);
    case 'collectJourney':
      return collectJourney(c, at, event.slot);
    case 'setSail':
      return setSail(c, at, event.to);
    case 'buyGrammarNode':
      return buyGrammarNode(c, at, event.id);
    case 'setAutomation':
      return setAutomation(c, at, event.enabled, event.intervalMs);
  }
}

export const befores = new WeakMap<Course, GameState[]>();

/**
 * The state before scenario event `index`, every earlier one accepted,
 * memoised per course: states are immutable, and the property below asks
 * for them hundreds of times.
 */
export function before(c: Course, index: number): GameState {
  const states = befores.get(c) ?? [rich(c)];
  befores.set(c, states);
  const events = scenario(c);
  while (states.length <= index) {
    const event = events[states.length - 1];
    const last = states[states.length - 1];
    if (event === undefined || last === undefined) {
      throw new RangeError(`no scenario state ${String(index)}`);
    }
    const result = apply(c, last, event);
    if (!result.ok) throw new Error(`scenario ${String(event.seq)} refused`);
    states.push(result.state);
  }
  const state = states[index];
  if (state === undefined)
    throw new RangeError(`no scenario state ${String(index)}`);
  return state;
}

/** A deep copy of plain data, kept apart from the value it copies. */
export function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(deepCopy) as T;
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, deepCopy(child)]),
    ) as T;
  }
  return value;
}

/** Freeze a state all the way down, so any write to it throws. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const TYPES = [
  'resume',
  'listen',
  'buyEncounter',
  'pickUpWord',
  'answerReview',
  'answerPractice',
  'buyUpgrade',
  'startJourney',
  'collectJourney',
  'buyGrammarNode',
  'setAutomation',
  'setSail',
] as const;

/**
 * `partial`, an event of any kind at a wall-clock offset, applied to the
 * scenario's state before event `index`: `apply` never throws, never writes
 * to its input, and answers as the action called directly does. Returns the
 * refusal's kind, or undefined when accepted.
 */
export function checkApply(
  c: Course,
  index: number,
  partial: GameEvent,
): string | undefined {
  const state = deepFreeze(before(c, index));
  const snapshot = deepCopy(state);
  // The partial's wallMs is an offset from the state's wall clock.
  const event = {
    ...partial,
    seq: state.seq + 1,
    wallMs: wallMs(state.wall + partial.wallMs),
  } as GameEvent;
  const result = apply(c, state, event);
  expect(state).toEqual(snapshot);
  const reference = direct(c, state, event);
  expect(result).toEqual(
    reference.ok
      ? { ok: true, state: { ...reference.state, seq: event.seq } }
      : reference,
  );
  return result.ok ? undefined : result.rejection.kind;
}

/**
 * From the scenario's state before event `index`, advancing `first` ms then
 * applying a Listen `second` ms later equals applying it then advancing.
 */
export function checkCommute(
  c: Course,
  index: number,
  first: number,
  second: number,
): void {
  const state = before(c, index);
  const t = wallMs(state.wall + first);
  const event: GameEvent = {
    type: 'listen',
    seq: state.seq + 1,
    wallMs: wallMs(t + second),
  };
  const viaAdvance = apply(c, advance(c, state, t).state, event);
  const applied = apply(c, state, event);
  if (!applied.ok) throw new Error('listen refused');
  expect(viaAdvance).toEqual({
    ok: true,
    state: advance(c, applied.state, t).state,
  });
}

/** Each event type with its place in the scenario: a test table. */
export const TYPE_INDEXES = TYPES.map((type, index) => ({ type, index }));
