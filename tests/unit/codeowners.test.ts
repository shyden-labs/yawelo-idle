import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { OWNED, codeownersRules as rules } from '../../scripts/owner-review';

/**
 * Who must approve what (#374). A bad twin (`againstTwin`) proves the run was
 * working, not that it read the whole sample, so Shyden chose (2026-10-19,
 * "GitHub asks you") to approve every change to the twin list himself.
 * GitHub enforces it through this file and develop's "Require review from
 * Code Owners". The file owns itself too: without that, a change could drop
 * the twin list's line and merge with no one asked.
 *
 * Every other path has no owner, so agents still merge into develop on a
 * green head as before. The rules live in scripts/owner-review.ts, which the
 * daily check (#687) reads too.
 */

describe('.github/CODEOWNERS', () => {
  it('names Shyden as the one owner of exactly the twin list and itself', () => {
    expect(rules(readFileSync('.github/CODEOWNERS', 'utf8'))).toEqual(OWNED);
  });

  it.each(OWNED)(
    'owns %s, a path that exists, so a rename cannot leave the rule owning nothing',
    (path) => {
      expect(existsSync(path.slice(1))).toBe(true);
    },
  );
});
