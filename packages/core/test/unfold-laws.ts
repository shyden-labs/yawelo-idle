import { expect } from 'vitest';
import { simMs, wallMs, type WallMs } from '../src/clock';
import type { Course, Destination } from '../src/course';
import { collectJourney, startJourney } from '../src/journeys';
import { isDue } from '../src/memory';
import { Num } from '../src/num';
import { setSail } from '../src/sail';
import {
  answerReview,
  buyEncounter,
  integrate,
  listen,
  pickUpWord,
  type Result,
} from '../src/sim';
import { initialState, type GameState } from '../src/state';
import { unfold, type UnfoldFlag } from '../src/unfold';

/**
 * The unfolding course and games (#31 AC6), and what a walk must satisfy: no
 * flag, once on, turns off. The unit suite checks chosen walks
 * (unfold.test.ts) and the properties suite seeded random ones
 * (properties/unfold.test.ts, #543), through the same check.
 *
 * The course is declared here, so it is checked against the `Course`
 * contract rather than sharing it.
 */

export const START: WallMs = wallMs(Date.UTC(2027, 0, 4));
/** The tutorial word falls due this long after pick-up (parent §4.1). */
export const TUTORIAL_MS = 240_000;
/** Destination 0's goal: 10,000 Understanding and 8 words (design §5). */
export const GOAL_U = 2_120_000_000;
export const GOAL_WORDS = 8;

export function destination(d: number): Destination {
  return {
    id: `d${String(d)}`,
    lexicon: Array.from({ length: 12 }, (_, k) => ({
      id: `d${String(d)}w${String(k)}`,
      tags: ['food'],
      cefr: 'A1' as const,
    })),
  };
}

export const course: Course = {
  id: 'unfold-course',
  tags: ['food'],
  regions: [
    {
      id: 'r0',
      destinations: [destination(0), destination(1)],
      encounters: [{ id: 'e0', tags: ['food'], c0: 10, p0: 1 }],
      cardSets: [{ id: 's0', bonus: 0.1 }],
      cultureCards: [
        { id: 'c0', setId: 's0', tags: ['food'], bonus: 0.05, phrasePack: [] },
      ],
      grammarNodes: [],
    },
  ],
};

export function ok(result: Result): GameState {
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result)}`);
  return result.state;
}

/** A new game holding `understanding`. */
export function holding(understanding: number): GameState {
  const base = initialState(START, 1);
  return {
    ...base,
    anchor: {
      sim: simMs(0),
      understanding: Num.toTuple(Num.from(understanding)),
    },
  };
}

/** A game whose first word was picked up `ms` ago. */
export function tutorialAfter(ms: number): GameState {
  return integrate(course, ok(pickUpWord(course, holding(20))), ms);
}

/** A game whose tutorial Journey left at START, `ms` later. */
export function journeyAfter(ms: number): GameState {
  return integrate(
    course,
    ok(startJourney(course, holding(0), 0, 'tutorial')),
    ms,
  );
}

/** A game at destination 0 holding its 8 words and `understanding`. */
export function nearGoal(understanding: number): GameState {
  let s = holding(1e6);
  for (let k = 0; k < GOAL_WORDS; k++) s = ok(pickUpWord(course, s));
  return {
    ...s,
    anchor: {
      sim: s.sim,
      understanding: Num.toTuple(Num.from(understanding)),
    },
    runSpent: Num.toTuple(Num.from(0)),
  };
}

/** A game that has sailed once, its Understanding and words reset to none. */
export function sailed(): GameState {
  return {
    ...holding(0),
    destination: 1,
    reached: 1,
    stamps: 3,
    stampsEarned: 3,
  };
}

export type Step =
  | { readonly kind: 'listen'; readonly taps: number }
  | { readonly kind: 'wait'; readonly ms: number }
  | { readonly kind: 'buy' }
  | { readonly kind: 'pickUp' }
  | { readonly kind: 'review' }
  | { readonly kind: 'start'; readonly duration: 'tutorial' | '2h' }
  | { readonly kind: 'collect' }
  | { readonly kind: 'sail' };

/** The state after `s`, or `s` itself when the action is refused. */
export function act(s: GameState, a: Step): GameState {
  const kept = (r: Result): GameState => (r.ok ? r.state : s);
  switch (a.kind) {
    case 'listen': {
      let next = s;
      // one scenario: a burst of taps is one action.
      for (let k = 0; k < a.taps; k++) next = listen(course, next);
      return next;
    }
    case 'wait':
      return integrate(course, s, a.ms);
    case 'buy':
      return kept(buyEncounter(course, s, 'e0', 1));
    case 'pickUp':
      return kept(pickUpWord(course, s));
    case 'review': {
      const due = Object.keys(s.words).find((id) => {
        const word = s.words[id];
        return word !== undefined && isDue(word, s.wall);
      });
      return due === undefined ? s : kept(answerReview(course, s, due, true));
    }
    case 'start':
      return kept(startJourney(course, s, 0, a.duration));
    case 'collect':
      return kept(collectJourney(course, s, 0));
    case 'sail':
      return kept(setSail(course, s));
  }
}

/** What a walk saw of one flag. */
export interface Walked {
  /** Steps walked. */
  readonly steps: number;
  /** Steps that began with the flag on: the steps the check judges. */
  readonly judged: number;
  /** Steps in which the flag turned on. */
  readonly turnedOn: number;
}

/**
 * Walks `steps` from a new game, or from one 100 Understanding short of its
 * goal, and checks after every step that `flag`, once on, stays on.
 */
export function checkWalk(
  flag: UnfoldFlag,
  startNearGoal: boolean,
  steps: readonly Step[],
): Walked {
  let s = startNearGoal ? nearGoal(GOAL_U - 100) : holding(0);
  let judged = 0;
  let turnedOn = 0;
  // one scenario: a walk, checked after every step.
  for (const a of steps) {
    const before = unfold(course, s)[flag];
    s = act(s, a);
    const after = unfold(course, s)[flag];
    if (before) {
      judged += 1;
      expect(after).toBe(true);
    }
    if (!before && after) turnedOn += 1;
  }
  return { steps: steps.length, judged, turnedOn };
}
