import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEATURES, type Milestone } from './features';

/**
 * Every stage has its approved features in both languages (#1068 AC5), and
 * every line is one the evidence file read back (content rule, D18).
 */
const MILESTONES: Milestone[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const EVIDENCE = readFileSync(
  new URL(
    '../../../../docs/translations/2026-11-22-roadmap-map-id.md',
    import.meta.url,
  ),
  'utf8',
);

describe.each(['en', 'id'] as const)('the %s features (#1068)', (locale) => {
  it.each(MILESTONES)('gives milestone %i at least one line', (milestone) => {
    expect(FEATURES[locale][milestone].length).toBeGreaterThan(0);
  });

  it.each(
    MILESTONES.flatMap((milestone) =>
      FEATURES[locale][milestone].map((line) => [milestone, line] as const),
    ),
  )(
    'takes milestone %i’s line %j from the evidence file',
    (_milestone, line) => {
      expect(EVIDENCE).toContain(`| ${line} `);
    },
  );
});

describe('the shared first line (#1068)', () => {
  it('gives Shipyard and The engine the same line', () => {
    expect(FEATURES.en[0]).toEqual(FEATURES.en[1]);
    expect(FEATURES.id[0]).toEqual(FEATURES.id[1]);
  });
});
