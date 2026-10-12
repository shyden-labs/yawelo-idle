import { expect } from 'vitest';
import { parseEvent } from '../src/events';

/**
 * What the event validator must satisfy at one input (#34 AC1, design §4).
 * The unit suite checks chosen inputs (events.test.ts) and the properties
 * suite random ones (properties/events.test.ts, #543), through the same
 * checks. The examples are declared here rather than read from the
 * validator's table, so the tests check it against the contract.
 */

/** One valid event of each type, in design §4's order with `resume` first. */
export const EXAMPLES = {
  resume: { type: 'resume', seq: 1, wallMs: 0 },
  listen: { type: 'listen', seq: 2, wallMs: 10 },
  buyEncounter: {
    type: 'buyEncounter',
    seq: 3,
    wallMs: 20,
    id: 'e0',
    count: 2,
  },
  pickUpWord: { type: 'pickUpWord', seq: 4, wallMs: 30 },
  answerReview: {
    type: 'answerReview',
    seq: 5,
    wallMs: 40,
    itemId: 'w0',
    correct: true,
    latencyMs: 2500,
    promptType: 'choice',
  },
  answerPractice: { type: 'answerPractice', seq: 6, wallMs: 50, itemId: 'w0' },
  buyUpgrade: { type: 'buyUpgrade', seq: 7, wallMs: 60, id: 'offlineCap' },
  startJourney: {
    type: 'startJourney',
    seq: 8,
    wallMs: 70,
    slot: 0,
    durationId: '2h',
  },
  collectJourney: { type: 'collectJourney', seq: 9, wallMs: 80, slot: 1 },
  setSail: { type: 'setSail', seq: 10, wallMs: 90, to: 'd0' },
  buyGrammarNode: { type: 'buyGrammarNode', seq: 11, wallMs: 100, id: 'g0' },
  setAutomation: {
    type: 'setAutomation',
    seq: 12,
    wallMs: 110,
    enabled: true,
    intervalMs: 10_000,
  },
} as const;

export const TYPES = Object.keys(EXAMPLES) as (keyof typeof EXAMPLES)[];

export type Kind = 'string' | 'boolean' | 'integer' | 'promptType';

/** Each field's kind and, for integers, its least value (design §4, #34). */
export const FIELDS: Readonly<Record<string, { kind: Kind; min?: number }>> = {
  seq: { kind: 'integer', min: 1 },
  wallMs: { kind: 'integer', min: 0 },
  id: { kind: 'string' },
  count: { kind: 'integer', min: 1 },
  itemId: { kind: 'string' },
  correct: { kind: 'boolean' },
  latencyMs: { kind: 'integer', min: 0 },
  promptType: { kind: 'promptType' },
  slot: { kind: 'integer', min: 0 },
  durationId: { kind: 'string' },
  to: { kind: 'string' },
  enabled: { kind: 'boolean' },
  intervalMs: { kind: 'integer', min: 1 },
};

/** Every (type, field) pair but `type` itself, in each example's own order. */
export const FIELD_CASES = TYPES.flatMap((type) =>
  Object.keys(EXAMPLES[type])
    .filter((field) => field !== 'type')
    .map((field) => ({ type, field })),
);

export const INTEGER_CASES = FIELD_CASES.filter(
  ({ field }) => FIELDS[field]?.kind === 'integer',
);

/** `event` parses back to itself after a trip through JSON. */
export function checkJsonRoundTrip(event: object): void {
  expect(parseEvent(JSON.parse(JSON.stringify(event)))).toEqual({
    ok: true,
    event,
  });
}

/** `parseEvent` answers `input` without throwing. */
export function checkNeverThrows(input: unknown): void {
  const result = parseEvent(input);
  expect(typeof result.ok).toBe('boolean');
}

/** Every field case but `setSail`'s optional `to`: each can go missing. */
export const MISSING_FIELD_CASES = FIELD_CASES.filter(
  ({ field }) => field !== 'to',
);

/** Each integer field with a fraction, NaN, infinity and an unsafe integer. */
export const NON_INTEGER_CASES = INTEGER_CASES.flatMap(({ type, field }) =>
  [1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53].map((value) => ({
    type,
    field,
    value,
  })),
);
