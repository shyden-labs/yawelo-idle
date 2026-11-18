import fc from 'fast-check';
import {
  BALANCE,
  initialState,
  replay,
  stateHash,
  wallMs,
  type GameEvent,
  type GameState,
} from '@yawelo-idle/core';
import { describe, expect, it } from 'vitest';
import { load, save, SAVE_VERSION } from '../src/index.ts';
import { course, MINUTE_MS, rich, START } from '../test/states.ts';

/**
 * The save round trip on generated states (#158 AC3): any state reached by
 * playing comes back from its save, through JSON text, deep-equal and with
 * the same state hash. States are reached by playing random events from a
 * new game or a rich one, since only played states are ever saved; events
 * the state refuses are skipped, as in play. The unit suite keeps two chosen
 * cases (test/save.test.ts).
 */

const RUNS = 200;

const c = course();
const region = c.regions[0];
const lexicon = c.regions[1]?.destinations[0]?.lexicon ?? [];

/** One event's own fields, without its `seq` and time. */
const body: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
  fc.constant({ type: 'resume' }),
  fc.constant({ type: 'listen' }),
  fc.record({
    type: fc.constant('buyEncounter'),
    id: fc.constantFrom(...(region?.encounters ?? []).map((e) => e.id)),
    count: fc.integer({ min: 1, max: 5 }),
  }),
  fc.constant({ type: 'pickUpWord' }),
  fc.record({
    type: fc.constant('answerReview'),
    itemId: fc.constantFrom(...lexicon.map((item) => item.id)),
    correct: fc.boolean(),
    latencyMs: fc.integer({ min: 300, max: 20_000 }),
    promptType: fc.constant('choice'),
  }),
  fc.record({
    type: fc.constant('answerPractice'),
    itemId: fc.constantFrom(...lexicon.map((item) => item.id)),
  }),
  fc.record({ type: fc.constant('buyUpgrade'), id: fc.constant('offlineCap') }),
  fc.record({
    type: fc.constant('startJourney'),
    slot: fc.integer({ min: 0, max: BALANCE.journeys.maxSlots - 1 }),
    durationId: fc.constantFrom('2h', '4h'),
  }),
  fc.record({
    type: fc.constant('collectJourney'),
    slot: fc.integer({ min: 0, max: BALANCE.journeys.maxSlots - 1 }),
  }),
  fc.record({
    type: fc.constant('buyGrammarNode'),
    id: fc.constantFrom(...(region?.grammarNodes ?? []).map((n) => n.id)),
  }),
  fc.record({
    type: fc.constant('setAutomation'),
    enabled: fc.boolean(),
    intervalMs: fc.constant(BALANCE.automation.intervalsMs[0]),
  }),
  fc.constant({ type: 'setSail' }),
);

type Step = readonly [fields: Record<string, unknown>, gapMinutes: number];

/**
 * A Journey sent out and collected once it is back: the only way to hold a
 * culture card, which a single random event almost never reaches (a 2h
 * Journey needs a later collect at least 120 minutes on, in the same slot).
 */
const journeyTrip: fc.Arbitrary<readonly Step[]> = fc
  .tuple(
    fc.integer({ min: 0, max: BALANCE.journeys.maxSlots - 1 }),
    fc.integer({ min: 0, max: 30 }),
    fc.integer({ min: 121, max: 300 }),
  )
  .map(([slot, before, away]) => [
    [{ type: 'startJourney', slot, durationId: '2h' }, before],
    [{ type: 'collectJourney', slot }, away],
  ]);

/** One move: a random event, or a whole Journey trip. */
const move: fc.Arbitrary<readonly Step[]> = fc.oneof(
  fc.tuple(body, fc.integer({ min: 0, max: 300 })).map((step) => [step]),
  journeyTrip,
);

/** A played state: a start, then moves at rising times. */
const playedState: fc.Arbitrary<GameState> = fc
  .tuple(
    fc.boolean(),
    fc.integer({ min: 0, max: 2 ** 31 }),
    fc.array(move, { maxLength: 30 }),
  )
  .map(([isRich, seed, moves]) => {
    const start = isRich ? rich() : initialState(START, seed);
    let minutes = 0;
    const events = moves.flat().map(([fields, gap], index) => {
      minutes += gap;
      return {
        ...fields,
        seq: index + 1,
        wallMs: wallMs(START + minutes * MINUTE_MS),
      } as unknown as GameEvent;
    });
    return replay(c, start, events).state;
  });

describe('the save round trip', () => {
  it('reads back any played state deep-equal, with the same state hash', () => {
    let withCards = 0;
    fc.assert(
      fc.property(
        playedState,
        fc.string({ minLength: 1 }),
        (state, contentVersion) => {
          if (state.cards.length >= 2) withCards += 1;
          const written = save(state, {}, contentVersion);
          const result = load(JSON.parse(JSON.stringify(written)) as unknown);
          expect(result).toEqual({
            ok: true,
            save: written,
            migratedFrom: SAVE_VERSION,
          });
          expect(result.ok && stateHash(result.save.state)).toBe(
            stateHash(state),
          );
        },
      ),
      { numRuns: RUNS },
    );
    // The generator must reach states holding more than one culture card,
    // or an order bug in `cards` goes unseen (#158: a reversed `cards`
    // passed all 200 runs before Journey trips were drawn).
    console.log(
      `save round trip: ${String(withCards)} of ${String(RUNS)} states held 2+ cards`,
    );
    expect(withCards).toBeGreaterThan(0);
  });
});
