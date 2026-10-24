import { expect } from 'vitest';
import Decimal from 'decimal.js';
import { BALANCE } from '../src/balance.ts';
import { DAY_MS, HOUR_MS, wallMs, type WallMs } from '../src/clock.ts';
import type { Course, Encounter, LexiconItem } from '../src/course.ts';
import { encounterOutput } from '../src/encounters.ts';
import { reviewQueue, type WordMemory } from '../src/memory.ts';
import { Num } from '../src/num.ts';
import { rateAt, understandingNow } from '../src/production.ts';
import {
  advance,
  answerPractice,
  answerReview,
  buyEncounter,
  integrate,
  listen,
  pickUpWord,
  type Result,
} from '../src/sim.ts';
import { initialState, type GameState } from '../src/state.ts';
import { exactMean, exactR } from './fsrs-reference.ts';

/**
 * The words course and games (#28), and what the word actions must satisfy:
 * absence never changes ranks or memory, practice is open at any time, and
 * no reachable state holds NaN, a negative or an infinite value. The unit
 * suite checks chosen cases (words.test.ts) and the properties suite random
 * ones (properties/words.test.ts, #543), through the same checks.
 */

export const tea: Encounter = { id: 'tea', tags: ['food'], c0: 10, p0: 1 };
export const bus: Encounter = { id: 'bus', tags: ['transport'], c0: 10, p0: 2 };
/** Shares both of `both`'s tags. */
export const stall: Encounter = {
  id: 'stall',
  tags: ['food', 'transport'],
  c0: 10,
  p0: 3,
};

export const lexicon: readonly LexiconItem[] = [
  { id: 'b1-food', tags: ['food'], cefr: 'B1' },
  { id: 'a1-food', tags: ['food'], cefr: 'A1' },
  { id: 'both', tags: ['food', 'transport'], cefr: 'A2' },
  { id: 'a1-bus', tags: ['transport'], cefr: 'A1' },
  { id: 'toString', tags: ['market'], cefr: 'A2' },
];
export const CURRICULUM = ['a1-food', 'a1-bus', 'both', 'toString', 'b1-food'];

export const course: Course = {
  id: 'words-course',
  tags: ['food', 'transport', 'market'],
  regions: [
    {
      id: 'r0',
      destinations: [
        { id: 'd0', lexicon },
        { id: 'd1', lexicon: [{ id: 'later', tags: ['food'], cefr: 'A1' }] },
      ],
      encounters: [tea, bus, stall],
      cardSets: [],
      cultureCards: [],
      grammarNodes: [],
    },
  ],
};

export const START: WallMs = wallMs(Date.UTC(2027, 0, 4));
export const D = Decimal.clone({ precision: 50 });

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** A new game holding `understanding` and owning `owned`. */
export function rich(
  understanding: number,
  owned: Record<string, number> = {},
): GameState {
  const base = initialState(START, 1);
  return deepFreeze({
    ...base,
    anchor: {
      ...base.anchor,
      understanding: Num.toTuple(Num.from(understanding)),
    },
    owned,
  });
}

export function ok(result: Result): GameState {
  if (!result.ok) {
    throw new Error(`rejected: ${JSON.stringify(result.rejection)}`);
  }
  return deepFreeze(result.state);
}

export function held(state: GameState): number {
  return Num.toNumber(understandingNow(course, state));
}

export function at(state: GameState, deltaMs: number): GameState {
  return deepFreeze(advance(course, state, wallMs(state.wall + deltaMs)).state);
}

/**
 * A played game: all five words picked up, Encounters owned, the first
 * three words reviewed correctly at different times, then left alone. The
 * first answer waits the 4 minutes until the tutorial word is due.
 */
export function played(): GameState {
  let s = rich(1e6, { tea: 3, bus: 2, stall: 1 });
  for (let k = 0; k < 5; k++) s = ok(pickUpWord(course, s));
  s = at(s, 240_000);
  s = ok(answerReview(course, s, 'a1-food', true));
  s = at(s, 7 * HOUR_MS + 123_457);
  s = ok(answerReview(course, s, 'a1-bus', true));
  s = at(s, 3 * DAY_MS);
  s = ok(answerReview(course, s, 'both', true));
  s = ok(answerReview(course, s, 'a1-food', true));
  return at(s, 5 * HOUR_MS + 999);
}

/** Exact R of a word at wall time `wall`, straight from the curve. */
export function exactWordR(word: WordMemory, wall: Decimal): Decimal {
  const { lastReview, stability } = word.card;
  if (lastReview === null) return new D(0);
  return exactR(stability, wall.minus(lastReview).div(DAY_MS));
}

/**
 * The floor share, written out from spec §3.3 (four fifths since #35) rather
 * than read from `BALANCE`, so the model and the engine cannot move together.
 */
export const FLOOR = 0.8;

/**
 * The continuous model's Understanding over sim [from, to), in decimal:
 * for each owned Encounter, output x (1 + sum of rankBonus x (F + (1 - F) R))
 * over the words sharing a tag, R taken on the wall clock (sim + skew), F the
 * floor share. The rate is linear in each word's R, so the integral is exact:
 * each Encounter's output times the span, plus, per word sharing a tag, its
 * bonus times F of the span and 1 - F of R's integral, which is closed form.
 *
 * Measured for #76: the 60-digit result agrees with a 120-digit run in all
 * 45 digits compared, and the Simpson's rule over 2,000 panels it replaces
 * to 4.5e-23 or better. Each of the four tests that call it takes
 * 6 to 11 ms alone, against 2.8 to 4.6 s with Simpson's rule, and up to
 * 118 ms over ten full-suite runs, so they run under the global timeout.
 */
export function continuous(
  state: GameState,
  from: number,
  to: number,
): Decimal {
  const skew = state.wall - state.sim;
  const span = new D(to - from);
  // Each word's term is integrated once and shared by every Encounter.
  const terms = Object.entries(state.words).map(([id, word]) => {
    const { lastReview, stability } = word.card;
    const integralOfR =
      lastReview === null
        ? new D(0)
        : exactMean(
            stability,
            new D(from + skew - lastReview).div(DAY_MS),
            span.div(DAY_MS),
          ).mul(span);
    return {
      tags: lexicon.find((x) => x.id === id)?.tags ?? [],
      value: new D(BALANCE.words.rankBonus[word.rank]).mul(
        span.mul(FLOOR).plus(integralOfR.mul(new D(1).minus(FLOOR))),
      ),
    };
  });
  let total = new D(0);
  for (const e of [tea, bus, stall]) {
    const owned = state.owned[e.id] ?? 0;
    if (owned === 0) continue;
    let m = span;
    for (const { tags, value } of terms) {
      if (tags.some((g) => e.tags.includes(g))) m = m.plus(value);
    }
    total = total.plus(new D(Num.toNumber(encounterOutput(e, owned))).mul(m));
  }
  return total.div(1000);
}

export function relative(got: number, want: Decimal): number {
  return new D(got).minus(want).div(want).abs().toNumber();
}

export type Step =
  | { readonly kind: 'listen' }
  | { readonly kind: 'buy'; readonly id: string; readonly count: number }
  | { readonly kind: 'pick' }
  | {
      readonly kind: 'answer';
      readonly pick: number;
      readonly correct: boolean;
    }
  | { readonly kind: 'advance'; readonly deltaMs: number };

/**
 * Every way `s` breaks the property, and how many values were checked.
 * Thrown as one error rather than asserted field by field: about 30
 * `expect` calls a step took a quarter of the time (#474). The count is a
 * recorded floor, so a check that stops reading the state fails.
 */
export function faults(s: GameState): { checked: number; found: string[] } {
  const found: string[] = [];
  let checked = 0;
  const times = {
    sim: s.sim,
    wall: s.wall,
    anchor: s.anchor.sim,
    memory: s.memorySince,
  };
  for (const [name, t] of Object.entries(times)) {
    checked++;
    if (!Number.isSafeInteger(t) || t < 0)
      found.push(`${name} time ${String(t)}`);
  }
  checked += 2;
  if (s.memorySince > s.anchor.sim) found.push('memorySince after the anchor');
  if (s.anchor.sim > s.sim) found.push('anchor after sim');
  const values = {
    insight: Num.fromTuple(s.insight),
    understanding: understandingNow(course, s),
    rate: rateAt(course, s, s.sim),
  };
  for (const [name, n] of Object.entries(values)) {
    checked++;
    if (!Number.isFinite(n.mantissa) || n.mantissa < 0)
      found.push(`${name} ${String(n.mantissa)}`);
  }
  for (const [id, w] of Object.entries(s.words)) {
    const { due, stability, difficulty, reps, lapses } = w.card;
    const card = { due, stability, difficulty, reps, lapses };
    for (const [name, x] of Object.entries(card)) {
      checked++;
      if (!Number.isFinite(x) || x < 0)
        found.push(`${id} ${name} ${String(x)}`);
    }
    checked++;
    if (w.card.lastReview !== null && w.card.lastReview > s.wall)
      found.push(`${id} reviewed after the wall clock`);
  }
  return { checked, found };
}

// What the property reached (#474): picks taken and refused, purchases
// made and refused, right and wrong answers, an answer with nothing due, a
// clock stepped back, an absence clipped by the cap, and games that picked
// up every word of the destination, and the values checked. Each is a
// recorded floor.
export const SEQUENCE_REACHED = [
  'picked',
  'pick-refused',
  'bought',
  'buy-refused',
  'right',
  'wrong',
  'nothing-due',
  'clock-back',
  'clipped',
  'every-word',
  'checked',
] as const;
export type SequenceReached = Record<(typeof SEQUENCE_REACHED)[number], number>;

/**
 * Plays `steps` from a game holding 500 Understanding, checking after every
 * step that no value is NaN, negative or infinite, and says what the steps
 * reached.
 */
export function checkSequence(steps: readonly Step[]): SequenceReached {
  const reached = Object.fromEntries(
    SEQUENCE_REACHED.map((name) => [name, 0]),
  ) as SequenceReached;
  let s = rich(500);
  // one scenario: each step plays on from the state the last one left
  for (const e of steps) {
    let r: Result | undefined;
    if (e.kind === 'listen') s = listen(course, s);
    if (e.kind === 'buy') {
      r = buyEncounter(course, s, e.id, e.count);
      reached[r.ok ? 'bought' : 'buy-refused']++;
    }
    if (e.kind === 'pick') {
      r = pickUpWord(course, s);
      reached[r.ok ? 'picked' : 'pick-refused']++;
    }
    if (e.kind === 'answer') {
      const due = reviewQueue(s.words, s.wall);
      const q = due[e.pick % Math.max(due.length, 1)];
      if (q === undefined) reached['nothing-due']++;
      else {
        r = answerReview(course, s, q.itemId, e.correct);
        if (r.ok) reached[e.correct ? 'right' : 'wrong']++;
      }
    }
    if (e.kind === 'advance') {
      const moved = advance(course, s, wallMs(s.wall + e.deltaMs));
      if (e.deltaMs < 0) reached['clock-back']++;
      if (moved.summary.clipped) reached.clipped++;
      s = moved.state;
    }
    if (r?.ok === true) s = r.state;
    const { checked, found } = faults(s);
    reached.checked += checked;
    if (found.length > 0) throw new Error(found.join('; '));
  }
  if (lexicon.every((x) => x.id in s.words)) reached['every-word']++;
  return reached;
}

/** Ranks and memory never change through `delta` ms of absence, either way. */
export function checkAbsence(delta: number): void {
  const s = played();
  expect(advance(course, s, wallMs(s.wall + delta)).state.words).toEqual(
    s.words,
  );
  expect(integrate(course, s, Math.max(delta, 0)).words).toEqual(s.words);
}

/** Practice on `id`, `delta` ms after the played game, changes nothing. */
export function checkPractice(delta: number, id: string): void {
  const s = at(played(), delta);
  expect(answerPractice(s, id)).toEqual({ ok: true, state: s });
}

/** Adds what one sequence reached to the running totals. */
export function addReached(
  into: SequenceReached,
  got: Readonly<SequenceReached>,
): void {
  for (const name of SEQUENCE_REACHED) into[name] += got[name];
}
