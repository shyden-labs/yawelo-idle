import { describe, expect, it } from 'vitest';
import { missingEvidence, reviewSchema } from '@yawelo-idle/content';
import { en, id, slots, type UiKey } from '../src/i18n/catalogue';
import { review } from '../src/i18n/review';
import { sameInBoth } from '../src/i18n/same-in-both';

/**
 * The UI catalogue is checked like content (#104; spec §5.5): a bad
 * machine-seeded label never ships. One test per key and check.
 */
const keys = Object.keys(en) as UiKey[];
const sorted = (list: readonly string[]): string[] => [...list].sort();

describe('the catalogues’ keys (AC3)', () => {
  it('are the same in en and id', () => {
    expect(sorted(Object.keys(id))).toEqual(sorted(keys));
  });

  it('each have a review block, and no block names a key the catalogue lacks', () => {
    expect(sorted(Object.keys(review))).toEqual(sorted(keys));
  });
});

describe.each(keys)('%s', (key) => {
  it('is not empty in en or id (AC3)', () => {
    expect([/\S/.test(en[key]), /\S/.test(id[key])]).toEqual([true, true]);
  });

  it('differs from the English in id, unless allow-listed (AC2)', () => {
    expect(id[key] === en[key]).toBe(key in sameInBoth);
  });

  it('has the same {slots} in en and id (AC5)', () => {
    expect(sorted(slots(id[key]))).toEqual(sorted(slots(en[key])));
  });

  it('carries a well-formed review block (AC6)', () => {
    expect(reviewSchema.safeParse(review[key]).success).toBe(true);
  });

  it('is claude-checked or native-reviewed, so it can ship (AC6)', () => {
    expect(['claude-checked', 'native-reviewed']).toContain(review[key].status);
  });

  it('carries its full evidence, a label audit included when short (AC4, AC6)', () => {
    expect(missingEvidence(review[key], id[key])).toEqual([]);
  });
});

describe('the identical-to-English allow-list (AC2)', () => {
  it.each(Object.keys(sameInBoth) as UiKey[])(
    '%s is still identical, so its entry is not stale',
    (key) => {
      expect(id[key]).toBe(en[key]);
    },
  );
});
