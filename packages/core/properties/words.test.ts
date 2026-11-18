import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DAY_MS } from '../src/clock';
import {
  addReached,
  checkAbsence,
  checkPractice,
  checkSequence,
  CURRICULUM,
  SEQUENCE_REACHED,
  type SequenceReached,
  type Step,
} from '../test/words-laws';

/**
 * The word actions on random times, words and sequences (#28 AC5, AC8), at
 * the counts before #474 cut them to fit the unit limit (#543). The unit
 * suite checks chosen cases through the same checks (test/words.test.ts).
 */

describe('the floor (AC4)', () => {
  it('ranks and memory never change through absence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -DAY_MS, max: 400 * DAY_MS }),
        checkAbsence,
      ),
      { numRuns: 200 },
    );
  });
});

describe('practice (AC8)', () => {
  it('is open at any time, due or not, over random states', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 * DAY_MS }),
        fc.constantFrom(...CURRICULUM),
        checkPractice,
      ),
      { numRuns: 100 },
    );
  });
});

describe('no reachable state holds NaN, a negative or an infinite value', () => {
  const step: fc.Arbitrary<Step> = fc.oneof(
    { arbitrary: fc.constant({ kind: 'listen' as const }), weight: 2 },
    {
      arbitrary: fc.record({
        kind: fc.constant('buy' as const),
        id: fc.constantFrom('tea', 'bus', 'stall'),
        // Up to 60 at once, so some purchases cost more than is held.
        count: fc.integer({ min: 1, max: 60 }),
      }),
      weight: 2,
    },
    { arbitrary: fc.constant({ kind: 'pick' as const }), weight: 2 },
    {
      arbitrary: fc.record({
        kind: fc.constant('answer' as const),
        pick: fc.nat(),
        correct: fc.boolean(),
      }),
      weight: 4,
    },
    {
      arbitrary: fc.record({
        kind: fc.constant('advance' as const),
        deltaMs: fc.integer({ min: -DAY_MS, max: 40 * DAY_MS }),
      }),
      weight: 3,
    },
  );

  let played: SequenceReached | undefined;

  /**
   * Plays 300 fresh games of 20 to 120 steps once a run and keeps what they
   * reached, so the property and each minimum share one play: the count
   * before #474 cut it to 25 (#543).
   */
  function play(): SequenceReached {
    if (played !== undefined) return played;
    const reached = Object.fromEntries(
      SEQUENCE_REACHED.map((name) => [name, 0]),
    ) as SequenceReached;
    fc.assert(
      fc.property(
        fc.array(step, { minLength: 20, maxLength: 120, size: 'max' }),
        (steps) => {
          addReached(reached, checkSequence(steps));
        },
      ),
      { numRuns: 300 },
    );
    played = reached;
    return reached;
  }

  it('over random sequences of pick-ups, answers, purchases and returns', () => {
    expect(Object.keys(play())).toEqual([...SEQUENCE_REACHED]);
  });
});
