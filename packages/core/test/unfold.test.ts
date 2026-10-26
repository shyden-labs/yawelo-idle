import { describe, expect, it } from 'vitest';
import { DAY_MS, wallMs } from '../src/clock.ts';
import { collectJourney } from '../src/journeys.ts';
import { Num } from '../src/num.ts';
import { answerReview, buyUpgrade, pickUpWord } from '../src/sim.ts';
import { view } from '../src/view.ts';
import { initialState, type GameState } from '../src/state.ts';
import { UNFOLD_FLAGS, unfold, type UnfoldFlag } from '../src/unfold.ts';
import {
  checkWalk,
  course,
  GOAL_U,
  GOAL_WORDS,
  holding,
  journeyAfter,
  nearGoal,
  ok,
  sailed,
  START,
  TUTORIAL_MS,
  tutorialAfter,
  type Step,
  type Walked,
} from './unfold-laws.ts';

/**
 * Unfolding (#31 AC6, DN7): parent §4.1's reveal flags, derived from state
 * alone, in order, each tested at the state just before it turns on and the
 * state just after. Journeys unfold with Review, and the goal with Culture
 * or once it can be met (operator, 2026-10-03).
 *
 * The course is declared in unfold-laws.ts, so it is checked against the
 * `Course` contract rather than sharing it.
 */

const off = (flag: UnfoldFlag, s: GameState): void => {
  expect(unfold(course, s)[flag]).toBe(false);
};
const on = (flag: UnfoldFlag, s: GameState): void => {
  expect(unfold(course, s)[flag]).toBe(true);
};

describe('the flags, in parent §4.1 order', () => {
  it('are exactly these eight, in this order', () => {
    expect(UNFOLD_FLAGS).toEqual([
      'listen',
      'encounters',
      'words',
      'review',
      'upgrades',
      'journeys',
      'culture',
      'goal',
    ]);
  });

  it('a new game shows only Listen', () => {
    expect(unfold(course, initialState(START, 1))).toEqual({
      listen: true,
      encounters: false,
      words: false,
      review: false,
      upgrades: false,
      journeys: false,
      culture: false,
      goal: false,
    });
  });

  it('view carries the flags at its own time', () => {
    const s = tutorialAfter(TUTORIAL_MS - 1);
    expect(view(course, s, s.wall).unfold.review).toBe(false);
    expect(view(course, s, wallMs(s.wall + 1)).unfold.review).toBe(true);
  });
});

/**
 * Each flag at the state just before it turns on and just after (AC6, DN7).
 * Listen has no before: it shows from the first screen (§4.1 step 1).
 */
const EDGES: readonly {
  readonly flag: UnfoldFlag;
  readonly how: string;
  readonly before: (() => GameState) | undefined;
  readonly after: () => GameState;
}[] = [
  {
    flag: 'listen',
    how: 'from the first screen',
    before: undefined,
    after: () => initialState(START, 1),
  },
  {
    flag: 'encounters',
    how: 'at 10 Understanding earned this run',
    before: () => holding(9),
    after: () => holding(10),
  },
  {
    flag: 'encounters',
    how: 'when the 10 was spent, not held',
    before: () => ({ ...holding(0), runSpent: Num.toTuple(Num.from(9)) }),
    after: () => ({ ...holding(0), runSpent: Num.toTuple(Num.from(10)) }),
  },
  {
    flag: 'encounters',
    how: 'after a sail resets the Understanding',
    before: () => holding(0),
    after: sailed,
  },
  {
    flag: 'words',
    how: 'with the first word picked up',
    before: () => holding(20),
    after: () => ok(pickUpWord(course, holding(20))),
  },
  {
    flag: 'review',
    how: 'when the tutorial word falls due',
    before: () => tutorialAfter(TUTORIAL_MS - 1),
    after: () => tutorialAfter(TUTORIAL_MS),
  },
  {
    flag: 'review',
    how: 'and stays once a word is reviewed and not due',
    before: () => tutorialAfter(TUTORIAL_MS - 1),
    after: () =>
      ok(answerReview(course, tutorialAfter(TUTORIAL_MS), 'd0w0', true)),
  },
  {
    flag: 'upgrades',
    how: 'with the first Insight',
    before: () => tutorialAfter(TUTORIAL_MS),
    after: () =>
      ok(answerReview(course, tutorialAfter(TUTORIAL_MS), 'd0w0', true)),
  },
  {
    flag: 'upgrades',
    how: 'and stays once that Insight is spent',
    before: () => holding(0),
    after: () =>
      ok(
        buyUpgrade(
          course,
          { ...holding(0), insight: Num.toTuple(Num.from(25)) },
          'journeySlot2',
        ),
      ),
  },
  {
    flag: 'upgrades',
    how: 'with the first stamp, for a player who never reviews (D1)',
    before: () => ({ ...tutorialAfter(DAY_MS), stampsEarned: 0 }),
    after: () => ({ ...tutorialAfter(DAY_MS), stampsEarned: 1 }),
  },
  {
    flag: 'journeys',
    how: 'with Review, when the tutorial word falls due',
    before: () => tutorialAfter(TUTORIAL_MS - 1),
    after: () => tutorialAfter(TUTORIAL_MS),
  },
  {
    flag: 'culture',
    how: 'when the first Journey returns',
    before: () => journeyAfter(30 * 60_000 - 1),
    after: () => journeyAfter(30 * 60_000),
  },
  {
    flag: 'culture',
    how: 'and stays once its card is collected',
    before: () => journeyAfter(30 * 60_000 - 1),
    after: () => ok(collectJourney(course, journeyAfter(30 * 60_000), 0)),
  },
  {
    flag: 'goal',
    how: 'with Culture',
    before: () => journeyAfter(30 * 60_000 - 1),
    after: () => journeyAfter(30 * 60_000),
  },
  {
    flag: 'goal',
    how: 'once the goal can be met, before any Journey',
    before: () => nearGoal(GOAL_U - 1),
    after: () => nearGoal(GOAL_U),
  },
  {
    flag: 'goal',
    how: 'after a sail',
    before: () => holding(0),
    after: sailed,
  },
];

describe('each flag just before and just after it turns on (AC6)', () => {
  for (const edge of EDGES) {
    const { before } = edge;
    if (before !== undefined)
      it(`${edge.flag} is off just before it shows ${edge.how}`, () => {
        off(edge.flag, before());
      });
    it(`${edge.flag} is on just after it shows ${edge.how}`, () => {
      on(edge.flag, edge.after());
    });
  }

  it('a Mastery replay of the first destination keeps Encounters and the goal shown', () => {
    const replaying = {
      ...holding(0),
      destination: 0,
      reached: 3,
      finale: true,
    };
    on('encounters', replaying);
    on('goal', replaying);
  });

  it('every flag has an edge that turns it on', () => {
    expect(new Set(EDGES.map((e) => e.flag))).toEqual(new Set(UNFOLD_FLAGS));
  });
});

describe('no flag ever turns off', () => {
  // Stand-ins of the seeded random walks (properties/unfold.test.ts, #543):
  // a new game played through every action to its first sail, and a game
  // near its goal that buys, waits and sails. What each walk sees of each
  // flag is pinned, so a walk that stops reaching a flag fails.
  const WALKS: Record<'a new game' | 'near the goal', [boolean, Step[]]> = {
    'a new game': [
      false,
      [
        { kind: 'listen', taps: 80 },
        { kind: 'listen', taps: 80 },
        { kind: 'listen', taps: 80 },
        { kind: 'buy' },
        { kind: 'listen', taps: 80 },
        { kind: 'buy' },
        { kind: 'buy' },
        { kind: 'wait', ms: 3_600_000 },
        { kind: 'pickUp' },
        { kind: 'pickUp' },
        { kind: 'wait', ms: DAY_MS },
        { kind: 'review' },
        { kind: 'start', duration: 'tutorial' },
        { kind: 'wait', ms: 240_000 },
        { kind: 'collect' },
        { kind: 'start', duration: '2h' },
        { kind: 'wait', ms: 7_200_000 },
        { kind: 'collect' },
        { kind: 'listen', taps: 80 },
        { kind: 'sail' },
      ],
    ],
    'near the goal': [
      true,
      [
        { kind: 'listen', taps: 80 },
        { kind: 'buy' },
        { kind: 'wait', ms: DAY_MS },
        { kind: 'sail' },
        { kind: 'listen', taps: 1 },
        { kind: 'review' },
      ],
    ],
  };

  // Measured 2026-10-12: every flag but Listen, on from the start, turns on
  // in the new game's walk.
  const SEEN: Record<keyof typeof WALKS, Record<UnfoldFlag, Walked>> = {
    'a new game': {
      listen: { steps: 20, judged: 20, turnedOn: 0 },
      encounters: { steps: 20, judged: 19, turnedOn: 1 },
      words: { steps: 20, judged: 11, turnedOn: 1 },
      review: { steps: 20, judged: 10, turnedOn: 1 },
      upgrades: { steps: 20, judged: 8, turnedOn: 1 },
      journeys: { steps: 20, judged: 10, turnedOn: 1 },
      culture: { steps: 20, judged: 3, turnedOn: 1 },
      goal: { steps: 20, judged: 3, turnedOn: 1 },
    },
    'near the goal': {
      listen: { steps: 6, judged: 6, turnedOn: 0 },
      encounters: { steps: 6, judged: 6, turnedOn: 0 },
      words: { steps: 6, judged: 6, turnedOn: 0 },
      review: { steps: 6, judged: 6, turnedOn: 0 },
      upgrades: { steps: 6, judged: 2, turnedOn: 1 },
      journeys: { steps: 6, judged: 6, turnedOn: 0 },
      culture: { steps: 6, judged: 0, turnedOn: 0 },
      goal: { steps: 6, judged: 3, turnedOn: 1 },
    },
  };

  for (const flag of UNFOLD_FLAGS)
    for (const [walk, [nearTheGoal, steps]] of Object.entries(WALKS))
      it(`${flag} never turns off over a walk from ${walk}`, () => {
        expect(checkWalk(flag, nearTheGoal, steps)).toEqual(
          SEEN[walk as keyof typeof WALKS][flag],
        );
      });
});

describe('the fixtures', () => {
  it('nearGoal holds the 8 words and the Understanding it is given', () => {
    const s = nearGoal(GOAL_U);
    expect(Object.keys(s.words)).toHaveLength(GOAL_WORDS);
    expect(Num.toNumber(Num.fromTuple(s.anchor.understanding))).toBe(GOAL_U);
  });

  it('the tutorial Journey returns after 30 minutes', () => {
    expect(journeyAfter(0).journeys[0]?.returnsAt).toBe(30 * 60_000);
  });
});
