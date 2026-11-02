import { describe, expect, it } from 'vitest';
import { COPY } from './copy';
import { COPY_EN } from './copy-en';

/**
 * The site speaks as one person (#848; Shyden, 2026-11-02, global rule): no
 * "we", "us" or "our", and nothing saying Shyden works alone. Every string
 * the site can show is read, in English and Indonesian.
 */

/** Every string inside `value`, however deeply nested. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === 'object' && value !== null)
    return Object.values(value).flatMap(strings);
  return [];
}

const TEAM = /\b(we|we're|we've|we'll|we'd|us|our|ours|ourselves|kami|kita)\b/i;
const ALONE =
  /\b(solo|indie|just me|one-person|one person|working alone|on my own|small team|the team)\b/i;

describe('the site speaks as one person (#848)', () => {
  it.each([
    ['the English source copy', strings(COPY_EN)],
    ['the English pages', strings(COPY.en)],
    ['the Indonesian pages', strings(COPY.id)],
  ])('%s never says we, us or our', (_name, texts) => {
    expect(texts.filter((t) => TEAM.test(t))).toEqual([]);
  });

  it.each([
    ['the English source copy', strings(COPY_EN)],
    ['the English pages', strings(COPY.en)],
    ['the Indonesian pages', strings(COPY.id)],
  ])('%s never says Shyden works alone', (_name, texts) => {
    expect(texts.filter((t) => ALONE.test(t))).toEqual([]);
  });

  it('reads every string, however deeply nested', () => {
    expect(strings({ a: ['x', { b: 'y' }], c: 1, d: null })).toEqual([
      'x',
      'y',
    ]);
  });
});
