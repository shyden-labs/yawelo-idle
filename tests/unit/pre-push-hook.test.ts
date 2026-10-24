import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GATES } from '../../scripts/pre-push';

/**
 * What the pre-push hook runs (#547). The laptop runs no test suite but the
 * unit suite, and the push runs none at all (operator, 2026-10-12: "No unit
 * in pre-push"): a branch that adds floors fails the unit suite until CI
 * records them, so a unit run here would refuse the push the record needs.
 * The unit suite runs by hand before each push and in CI on every pull
 * request. Since #752 the hook hands over to scripts/pre-push.ts, which runs
 * the gates on each pushed commit; the hook itself, run by a real push from a
 * scratch repository, is tests/integration/pre-push.test.ts.
 */

const HOOK = '.githooks/pre-push';

/** The hook's commands: every line that is neither blank nor a comment. */
const commands = (): string[] =>
  readFileSync(HOOK, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

describe('the pre-push hook (#547)', () => {
  it('hands over to scripts/pre-push.ts, and runs nothing else (#752)', () => {
    expect(commands()).toEqual([
      'set -euo pipefail',
      'exec node "$(git rev-parse --show-toplevel)/scripts/pre-push.ts"',
    ]);
  });

  it('runs format, lint and typecheck on each commit, in that order, and no test suite', () => {
    expect(GATES).toEqual(['format:check', 'lint', 'typecheck']);
  });
});
