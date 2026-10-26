import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { OWNED, codeownersRules as rules } from '../../scripts/owner-review.ts';

/**
 * Whose review GitHub requests on what (#374). A bad twin (`againstTwin`)
 * proves the run was working, not that it read the whole sample, so Shyden
 * chose (2026-10-19, "GitHub asks you") to be asked to review every change
 * to the twin list. GitHub requests it through this file and develop's
 * "Require review from Code Owners", but develop requires 0 approvals, so a
 * merge does not wait for that review: probe PR #688 measured it, and
 * Shyden chose on 2026-10-19 to keep the setting (#690). An agent therefore
 * asks him before adding a twin. The file owns itself too: without that, a
 * change could drop the twin list's line and merge with no one asked.
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
