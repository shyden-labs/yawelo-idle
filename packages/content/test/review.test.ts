import { describe, expect, it } from 'vitest';
import { missingEvidence, reviewSchema, type Review } from '../src/index';

/**
 * #51's review block, shared (#104 AC6): the UI catalogue judges its strings
 * with the same schema and evidence rule as course content, not a copy.
 */
const checked: Review = {
  status: 'claude-checked',
  reviewer: 'claude',
  reviewedAt: '2026-11-14T08:00:00Z',
  notes: null,
  sources: ['kbbi:segera', 'wiktionary:hadir'],
  backTranslation: 'Coming soon.',
  labelAudit: 'Two words; a page heading saying the game is not out yet.',
  history: [],
};

describe('the shared review block (#104)', () => {
  it('parses a complete claude-checked block', () => {
    expect(reviewSchema.safeParse(checked).success).toBe(true);
  });

  it('refuses a block with a key left out', () => {
    const short: Partial<Review> = { ...checked };
    delete short.history;
    expect(reviewSchema.safeParse(short).success).toBe(false);
  });

  it('finds no evidence missing on a complete block', () => {
    expect(missingEvidence(checked, 'Segera hadir.')).toEqual([]);
  });

  it('names a missing label audit on text of three words or fewer', () => {
    expect(
      missingEvidence({ ...checked, labelAudit: null }, 'Segera hadir.'),
    ).toEqual([
      [
        'labelAudit',
        'is required on a claude-checked item of 3 words or fewer',
      ],
    ]);
  });
});
