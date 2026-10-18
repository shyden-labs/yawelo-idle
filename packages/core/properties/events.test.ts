import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { GameEvent } from '../src/events';
import {
  checkJsonRoundTrip,
  checkNeverThrows,
  TYPES,
} from '../test/events-laws';

/**
 * The event validator on random events and inputs (#34 AC1), at their full
 * counts and fresh on every run (#543). The unit suite checks chosen ones
 * through the same checks (test/events.test.ts).
 */

describe('parseEvent accepts (AC1)', () => {
  it('a round trip through JSON, for any valid event', () => {
    let reached = 0;
    fc.assert(
      fc.property(validEvent(), (event) => {
        reached += 1;
        checkJsonRoundTrip(event);
      }),
      { numRuns: 500 },
    );
    expect(reached).toBe(500);
  });
});

describe('parseEvent refuses (AC1)', () => {
  it('never throws, for any JSON value or any mangled event', () => {
    let reached = 0;
    fc.assert(
      fc.property(
        fc.oneof(
          fc.jsonValue(),
          fc.record({
            type: fc.constantFrom(...TYPES, 'tap'),
            seq: fc.oneof(fc.integer(), fc.double(), fc.string()),
            wallMs: fc.oneof(fc.integer(), fc.double(), fc.constant(null)),
            id: fc.oneof(fc.string(), fc.integer()),
            count: fc.oneof(fc.integer(), fc.double()),
          }),
        ),
        (input) => {
          reached += 1;
          checkNeverThrows(input);
        },
      ),
      { numRuns: 2000 },
    );
    expect(reached).toBe(2000);
  });
});

/** Any valid event: every type, every field anywhere in its range. */
function validEvent(): fc.Arbitrary<GameEvent> {
  const stamp = {
    seq: fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
    wallMs: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
  };
  const natural = fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER });
  const positive = fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER });
  const arbitraries: fc.Arbitrary<unknown>[] = [
    fc.record({ type: fc.constant('resume'), ...stamp }),
    fc.record({ type: fc.constant('listen'), ...stamp }),
    fc.record({
      type: fc.constant('buyEncounter'),
      ...stamp,
      id: fc.string(),
      count: positive,
    }),
    fc.record({ type: fc.constant('pickUpWord'), ...stamp }),
    fc.record({
      type: fc.constant('answerReview'),
      ...stamp,
      itemId: fc.string(),
      correct: fc.boolean(),
      latencyMs: natural,
      promptType: fc.constantFrom('choice', 'typed', 'tiles'),
    }),
    fc.record({
      type: fc.constant('answerPractice'),
      ...stamp,
      itemId: fc.string(),
    }),
    fc.record({ type: fc.constant('buyUpgrade'), ...stamp, id: fc.string() }),
    fc.record({
      type: fc.constant('startJourney'),
      ...stamp,
      slot: natural,
      durationId: fc.string(),
    }),
    fc.record({ type: fc.constant('collectJourney'), ...stamp, slot: natural }),
    fc.record(
      { type: fc.constant('setSail'), ...stamp, to: fc.string() },
      { requiredKeys: ['type', 'seq', 'wallMs'] },
    ),
    fc.record({
      type: fc.constant('buyGrammarNode'),
      ...stamp,
      id: fc.string(),
    }),
    fc.record({
      type: fc.constant('setAutomation'),
      ...stamp,
      enabled: fc.boolean(),
      intervalMs: positive,
    }),
  ];
  return fc.oneof(...arbitraries) as fc.Arbitrary<GameEvent>;
}
