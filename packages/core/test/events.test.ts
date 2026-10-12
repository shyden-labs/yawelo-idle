import { describe, expect, it } from 'vitest';
import {
  EVENT_TYPES,
  parseEvent,
  PROMPT_TYPES,
  type EventError,
} from '../src/events';
import {
  checkJsonRoundTrip,
  checkNeverThrows,
  EXAMPLES,
  FIELD_CASES,
  MISSING_FIELD_CASES,
  NON_INTEGER_CASES,
  FIELDS,
  INTEGER_CASES,
  TYPES,
  type Kind,
} from './events-laws';

/**
 * The event union and its validator (#34 AC1, design §4). Every field case
 * is generated from the examples and limits declared here, so the tests
 * check the validator against the contract rather than sharing its table.
 */

/** A value of the wrong JavaScript type for each kind. */
const WRONG: Readonly<Record<Kind, unknown>> = {
  string: 7,
  boolean: 'true',
  integer: '1',
  promptType: 3,
};

function without(
  object: Readonly<Record<string, unknown>>,
  field: string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(object).filter(([key]) => key !== field),
  );
}

/** A class instance that looks like an event: not plain data. */
class ListenLike {
  readonly type = 'listen';
  readonly seq = 1;
  readonly wallMs = 0;
}

function errorOf(input: unknown): EventError {
  const result = parseEvent(input);
  if (result.ok) throw new Error(`accepted ${JSON.stringify(input)}`);
  return result.error;
}

describe('the union (AC1)', () => {
  it('has design §4 types, with resume, in this order', () => {
    expect(EVENT_TYPES).toEqual(TYPES);
  });

  it('has the three prompt types of parent §3.4', () => {
    expect(PROMPT_TYPES).toEqual(['choice', 'typed', 'tiles']);
  });

  it('declares a kind for every field the examples use', () => {
    const used = new Set(FIELD_CASES.map(({ field }) => field));
    expect([...used].sort()).toEqual(Object.keys(FIELDS).sort());
  });

  // Liveness of the generated cases below: 12 types, 39 fields between them, 29 of them integers.
  it('generates a case for every field of every type', () => {
    expect(FIELD_CASES).toHaveLength(39);
    expect(INTEGER_CASES).toHaveLength(29);
  });
});

describe('parseEvent accepts (AC1)', () => {
  it.each(TYPES)('a valid %s, as a fresh object equal to it', (type) => {
    const input = EXAMPLES[type];
    const result = parseEvent(input);
    expect(result).toEqual({ ok: true, event: input });
    if (result.ok) expect(result.event).not.toBe(input);
  });

  it.each(INTEGER_CASES)(
    '$type with $field at its least value',
    ({ type, field }) => {
      const input = { ...EXAMPLES[type], [field]: FIELDS[field]?.min };
      expect(parseEvent(input)).toEqual({ ok: true, event: input });
    },
  );

  it.each(INTEGER_CASES)(
    '$type with $field at the largest safe integer',
    ({ type, field }) => {
      const input = { ...EXAMPLES[type], [field]: Number.MAX_SAFE_INTEGER };
      expect(parseEvent(input)).toEqual({ ok: true, event: input });
    },
  );

  it.each(['choice', 'typed', 'tiles'])(
    'answerReview with promptType %s',
    (promptType) => {
      const input = { ...EXAMPLES.answerReview, promptType };
      expect(parseEvent(input)).toEqual({ ok: true, event: input });
    },
  );

  it('answerReview with correct false', () => {
    const input = { ...EXAMPLES.answerReview, correct: false };
    expect(parseEvent(input)).toEqual({ ok: true, event: input });
  });

  it('setSail without a destination: `to` is optional', () => {
    const input = without(EXAMPLES.setSail, 'to');
    const result = parseEvent(input);
    expect(result).toEqual({ ok: true, event: input });
    if (result.ok) expect(Object.hasOwn(result.event, 'to')).toBe(false);
  });

  it('an object with no prototype, as JSON parsers may build', () => {
    const input = Object.assign(Object.create(null) as object, EXAMPLES.listen);
    expect(parseEvent(input)).toEqual({
      ok: true,
      event: { ...EXAMPLES.listen },
    });
  });

  it.each(TYPES)('a round trip through JSON, for the %s example', (type) => {
    checkJsonRoundTrip(EXAMPLES[type]);
  });

  it('a round trip through JSON, at the largest safe seq, time and count', () => {
    checkJsonRoundTrip({
      type: 'buyEncounter',
      seq: Number.MAX_SAFE_INTEGER,
      wallMs: Number.MAX_SAFE_INTEGER,
      id: '',
      count: Number.MAX_SAFE_INTEGER,
    });
  });
});

describe('parseEvent refuses (AC1)', () => {
  // Each input is built inside its test: a constructor run at collection
  // would fail the whole file rather than one test (#97).
  it.each([
    ['null', (): unknown => null],
    ['an array', (): unknown => [EXAMPLES.listen]],
    ['a string', (): unknown => 'listen'],
    ['a number', (): unknown => 1],
    ['undefined', (): unknown => undefined],
    ['a Date', (): unknown => new Date(0)],
    ['a class instance', (): unknown => new ListenLike()],
  ])('%s: not a plain object', (_name, make) => {
    expect(errorOf(make())).toEqual({ kind: 'notAnObject' });
  });

  it('an event with no type', () => {
    expect(errorOf(without(EXAMPLES.listen, 'type'))).toEqual({
      kind: 'missingField',
      field: 'type',
    });
  });

  it.each([
    ['an unknown name', 'tap', 'tap'],
    ['a name off the prototype', 'toString', 'toString'],
    ['a number', 3, 'number'],
    ['null', null, 'null'],
  ])('a type that is %s', (_name, type, found) => {
    expect(errorOf({ ...EXAMPLES.listen, type })).toEqual({
      kind: 'unknownType',
      found,
    });
  });

  it.each(MISSING_FIELD_CASES)('$type without $field', ({ type, field }) => {
    expect(errorOf(without(EXAMPLES[type], field))).toEqual({
      kind: 'missingField',
      field,
    });
  });

  it.each(FIELD_CASES)(
    '$type with $field of the wrong type',
    ({ type, field }) => {
      const kind = FIELDS[field]?.kind ?? 'string';
      expect(errorOf({ ...EXAMPLES[type], [field]: WRONG[kind] })).toEqual({
        kind: 'wrongType',
        field,
        expected: kind === 'promptType' ? 'string' : kind,
      });
    },
  );

  it('setSail with `to` present but undefined: present means typed', () => {
    expect(errorOf({ ...EXAMPLES.setSail, to: undefined })).toEqual({
      kind: 'wrongType',
      field: 'to',
      expected: 'string',
    });
  });

  it.each(NON_INTEGER_CASES)(
    '$type with $field = $value: not a safe integer',
    ({ type, field, value }) => {
      expect(errorOf({ ...EXAMPLES[type], [field]: value })).toEqual({
        kind: 'notInteger',
        field,
        value,
      });
    },
  );

  it.each(INTEGER_CASES)(
    '$type with $field one below its least',
    ({ type, field }) => {
      const min = FIELDS[field]?.min ?? 0;
      expect(errorOf({ ...EXAMPLES[type], [field]: min - 1 })).toEqual({
        kind: 'outOfRange',
        field,
        value: min - 1,
        min,
      });
    },
  );

  it('a negative zero wall time is in range: -0 is not below 0', () => {
    expect(parseEvent({ ...EXAMPLES.listen, wallMs: -0 }).ok).toBe(true);
  });

  it('an unknown prompt type', () => {
    expect(errorOf({ ...EXAMPLES.answerReview, promptType: 'voice' })).toEqual({
      kind: 'notOneOf',
      field: 'promptType',
      value: 'voice',
      allowed: ['choice', 'typed', 'tiles'],
    });
  });

  it.each(TYPES)('%s with a field it does not have', (type) => {
    expect(errorOf({ ...EXAMPLES[type], extra: 1 })).toEqual({
      kind: 'unexpectedField',
      field: 'extra',
    });
  });

  it('a `__proto__` key that JSON.parse made an own field', () => {
    const input: unknown = JSON.parse(
      '{"type":"listen","seq":1,"wallMs":0,"__proto__":{}}',
    );
    expect(errorOf(input)).toEqual({
      kind: 'unexpectedField',
      field: '__proto__',
    });
  });
});

describe('parseEvent checks in order (AC1)', () => {
  it('type before any field', () => {
    expect(errorOf({ type: 'tap' })).toEqual({
      kind: 'unknownType',
      found: 'tap',
    });
  });

  it('fields in their listed order: seq before wallMs', () => {
    expect(errorOf({ type: 'listen' })).toEqual({
      kind: 'missingField',
      field: 'seq',
    });
  });

  it('fields in their listed order: wallMs before the type’s own', () => {
    expect(errorOf({ type: 'buyEncounter', seq: 1 })).toEqual({
      kind: 'missingField',
      field: 'wallMs',
    });
  });

  it('within a field: wrong type before range', () => {
    expect(errorOf({ ...EXAMPLES.listen, seq: '0' })).toEqual({
      kind: 'wrongType',
      field: 'seq',
      expected: 'integer',
    });
  });

  it('a missing field before an unexpected one', () => {
    expect(errorOf({ ...without(EXAMPLES.buyUpgrade, 'id'), aaa: 1 })).toEqual({
      kind: 'missingField',
      field: 'id',
    });
  });

  it('unexpected fields in code-unit order, whatever order they were added', () => {
    expect(errorOf({ ...EXAMPLES.listen, zeta: 1, Zeta: 1, alpha: 1 })).toEqual(
      {
        kind: 'unexpectedField',
        field: 'Zeta',
      },
    );
  });

  // Stand-ins of any JSON value and any mangled event: each JSON kind, an
  // unknown type, and an event with every field of the wrong kind.
  it.each<[string, unknown]>([
    ['null', null],
    ['a number', 42],
    ['a string', 'listen'],
    ['an array', [EXAMPLES.listen]],
    ['an empty object', {}],
    ['an unknown type', { ...EXAMPLES.listen, type: 'tap' }],
    [
      'a mangled event',
      { type: 'buyEncounter', seq: 1.5, wallMs: null, id: 3, count: -0.5 },
    ],
    ['a string seq', { ...EXAMPLES.listen, seq: '2' }],
  ])('never throws, for %s', (_label, input) => {
    checkNeverThrows(input);
  });
});
