import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { HOUR_MS } from '../src/clock';
import type { Course } from '../src/course';
import type { GameEvent } from '../src/events';
import { checkApply, checkCommute, course, TYPES } from '../test/log-laws';
import { floorBreach } from '../../../tests/floors';

/**
 * The event log on random events (#34 AC2; design §7), at the counts before
 * #474 cut them to fit the unit limit (#543). The unit suite checks chosen
 * events through the same checks (test/log.test.ts).
 */

describe('a refused event leaves state unchanged (AC2)', () => {
  // One property per event type, so each type is drawn by construction
  // (#474): one property over any event left types to the seed, and at 200
  // runs it never accepted a purchase. Before #474 cut it, that property
  // drew 400 events; 34 a type draws 408. Each type's refused and accepted
  // events, and its refusal kinds, are recorded floors; the seed stays until
  // they become measured minimums (#84).
  it.each(TYPES)(
    'for any %s event at any point of the scenario, apply never throws and never writes to its input',
    (type) => {
      const c = course();
      let accepted = 0;
      let refused = 0;
      const kinds = new Set<string>();
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: TYPES.length }),
          eventOf(c, type),
          (index, partial) => {
            const kind = checkApply(c, index, partial);
            if (kind === undefined) accepted += 1;
            else {
              refused += 1;
              kinds.add(kind);
            }
          },
        ),
        { seed: 34, numRuns: 34 },
      );
      expect({
        accepted: floorBreach(`core-log/${type}-accepted`, accepted),
        refused: floorBreach(`core-log/${type}-refused`, refused),
        kinds: floorBreach(`core-log/${type}-refusal-kinds`, kinds.size),
      }).toEqual({ accepted: undefined, refused: undefined, kinds: undefined });
    },
  );
});

describe('apply and advance commute within the offline cap (design §7)', () => {
  it('advance then apply equals apply then advance, the event being later', () => {
    const c = course();
    let reached = 0;
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: TYPES.length }),
        fc.integer({ min: 0, max: 4 * HOUR_MS }),
        fc.integer({ min: 0, max: 2 * HOUR_MS }),
        (index, first, second) => {
          reached += 1;
          checkCommute(c, index, first, second);
        },
      ),
      { numRuns: 60 },
    );
    expect(reached).toBe(60);
  });
});

/**
 * Any event of `type`, valid or not, as the property draws it: its seq and
 * wall time set by the caller, ids from the course and some it does not
 * have, slots and counts in and out of range.
 */
function eventOf(
  c: Course,
  type: (typeof TYPES)[number],
): fc.Arbitrary<GameEvent> {
  // An offset from the state's wall clock, back by up to an hour (clamped)
  // or on by up to three: the caller adds the state's wall time.
  const wall = fc.integer({ min: -HOUR_MS, max: 3 * HOUR_MS });
  // A known id three times in five, so most kinds of event are accepted
  // somewhere in a few hundred runs (#474), else 'none' or any string.
  const ids = (known: readonly string[]): fc.Arbitrary<string> =>
    fc.oneof(
      { arbitrary: fc.constantFrom(...known), weight: 2 },
      { arbitrary: fc.constant('none'), weight: 1 },
      { arbitrary: fc.string(), weight: 1 },
    );
  const encounters = c.regions.flatMap((r) => r.encounters.map((e) => e.id));
  const nodes = c.regions.flatMap((r) => r.grammarNodes.map((n) => n.id));
  const words = c.regions[1]?.destinations[0]?.lexicon.map((i) => i.id) ?? [];
  const destinations = c.regions.flatMap((r) =>
    r.destinations.map((d) => d.id),
  );
  const count = fc.oneof(
    fc.integer({ min: 1, max: 5 }),
    fc.constant(Number.MAX_SAFE_INTEGER),
  );
  const slot = fc.integer({ min: 0, max: 4 });
  const seq = fc.constant(0);
  const arbitraries: Record<(typeof TYPES)[number], fc.Arbitrary<unknown>> = {
    resume: fc.record({ type: fc.constant('resume'), seq, wallMs: wall }),
    listen: fc.record({ type: fc.constant('listen'), seq, wallMs: wall }),
    buyEncounter: fc.record({
      type: fc.constant('buyEncounter'),
      seq,
      wallMs: wall,
      id: ids(encounters),
      count,
    }),
    pickUpWord: fc.record({
      type: fc.constant('pickUpWord'),
      seq,
      wallMs: wall,
    }),
    answerReview: fc.record({
      type: fc.constant('answerReview'),
      seq,
      wallMs: wall,
      itemId: ids(words),
      correct: fc.boolean(),
      latencyMs: fc.integer({ min: 0, max: 60_000 }),
      promptType: fc.constantFrom('choice', 'typed', 'tiles'),
    }),
    answerPractice: fc.record({
      type: fc.constant('answerPractice'),
      seq,
      wallMs: wall,
      itemId: ids(words),
    }),
    buyUpgrade: fc.record({
      type: fc.constant('buyUpgrade'),
      seq,
      wallMs: wall,
      id: ids(['offlineCap', 'journeySlot2', 'journeySlot3', 'pemanduFaster1']),
    }),
    startJourney: fc.record({
      type: fc.constant('startJourney'),
      seq,
      wallMs: wall,
      slot,
      durationId: ids(['tutorial', '2h', '4h', '8h', '24h']),
    }),
    collectJourney: fc.record({
      type: fc.constant('collectJourney'),
      seq,
      wallMs: wall,
      slot,
    }),
    setSail: fc.record(
      {
        type: fc.constant('setSail'),
        seq,
        wallMs: wall,
        to: ids(destinations),
      },
      { requiredKeys: ['type', 'seq', 'wallMs'] },
    ),
    buyGrammarNode: fc.record({
      type: fc.constant('buyGrammarNode'),
      seq,
      wallMs: wall,
      id: ids(nodes),
    }),
    setAutomation: fc.record({
      type: fc.constant('setAutomation'),
      seq,
      wallMs: wall,
      enabled: fc.boolean(),
      intervalMs: fc.constantFrom(1000, 2000, 5000, 10_000, 7),
    }),
  };
  return arbitraries[type] as fc.Arbitrary<GameEvent>;
}
