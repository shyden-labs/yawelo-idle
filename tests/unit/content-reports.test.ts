import { describe, expect, it } from 'vitest';
import {
  COURSES,
  KINDS,
  MAX_TEXT,
  PROBLEMS,
  reportBody,
} from '../../apps/sync-worker/src/content-reports';

/**
 * A content report's body (#52 AC1, AC2; design §B.1): strict, every field
 * checked, texts measured in Unicode code points.
 */
const VALID = {
  course: 'en-id',
  kind: 'lexicon',
  itemId: 'lex.selamat-pagi',
  problem: 'wrong-translation',
  suggestion: 'Good morning',
  note: 'Said before about 11:00.',
  appVersion: '0.1.0',
  contentVersion: 'c1',
  installId: '3f2a1c4e-1b2d-4c3e-8f9a-0b1c2d3e4f5a',
  website: '',
} as const;

/** VALID without one of its fields. */
const without = (...keys: (keyof typeof VALID)[]) =>
  Object.fromEntries(
    Object.entries(VALID).filter(([key]) => !keys.includes(key as never)),
  );

/** The dotted path of the first issue, or 'ok' when the body passes. */
const fieldAt = (body: unknown): string => {
  const result = reportBody.safeParse(body);
  if (result.success) return 'ok';
  const issue = result.error.issues[0];
  const path = (issue?.path ?? []).map(String);
  if (issue?.code === 'unrecognized_keys') path.push(issue.keys[0] ?? '');
  return path.join('.');
};

describe('a content report body (#52 AC1)', () => {
  it('accepts a full report', () => {
    expect(fieldAt(VALID)).toBe('ok');
  });

  it('accepts a report without a suggestion or a note', () => {
    expect(fieldAt(without('suggestion', 'note'))).toBe('ok');
  });

  it.each(COURSES)('accepts the course %s', (course) => {
    expect(fieldAt({ ...VALID, course })).toBe('ok');
  });

  it.each(KINDS)('accepts the kind %s', (kind) => {
    expect(fieldAt({ ...VALID, kind })).toBe('ok');
  });

  it.each(PROBLEMS)('accepts the problem %s', (problem) => {
    expect(fieldAt({ ...VALID, problem })).toBe('ok');
  });

  it('accepts a filled honeypot here; the route answers it (AC2)', () => {
    expect(fieldAt({ ...VALID, website: 'http://spam.example' })).toBe('ok');
  });
});

describe('a content report body refuses (#52 AC2)', () => {
  it('an unknown field, by name', () => {
    expect(fieldAt({ ...VALID, email: 'a@b.c' })).toBe('email');
  });

  it('a course outside the two', () => {
    expect(fieldAt({ ...VALID, course: 'en-fr' })).toBe('course');
  });

  it('a kind outside the six', () => {
    expect(fieldAt({ ...VALID, kind: 'example' })).toBe('kind');
  });

  it('a problem outside the six', () => {
    expect(fieldAt({ ...VALID, problem: 'boring' })).toBe('problem');
  });

  it('a missing itemId', () => {
    expect(fieldAt(without('itemId'))).toBe('itemId');
  });

  it('a missing installId', () => {
    expect(fieldAt(without('installId'))).toBe('installId');
  });

  it('a missing honeypot field', () => {
    expect(fieldAt(without('website'))).toBe('website');
  });
});

describe('a suggestion or note at the 1,000 code point limit (#52 AC2)', () => {
  // An emoji outside the BMP is one code point and two UTF-16 units, so
  // a limit counted in UTF-16 would refuse 1,000 of them.
  const wide = (count: number) => '🌴'.repeat(count);

  it('accepts a suggestion of exactly 1,000 code points', () => {
    expect(fieldAt({ ...VALID, suggestion: wide(MAX_TEXT) })).toBe('ok');
  });

  it('refuses a suggestion of 1,001 code points', () => {
    expect(fieldAt({ ...VALID, suggestion: wide(MAX_TEXT + 1) })).toBe(
      'suggestion',
    );
  });

  it('accepts a note of exactly 1,000 code points', () => {
    expect(fieldAt({ ...VALID, note: wide(MAX_TEXT) })).toBe('ok');
  });

  it('refuses a note of 1,001 code points', () => {
    expect(fieldAt({ ...VALID, note: wide(MAX_TEXT + 1) })).toBe('note');
  });
});
