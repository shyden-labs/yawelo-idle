import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * What the pre-push hook runs (#547). The laptop runs no test suite but the
 * unit suite, and the push runs none at all (operator, 2026-10-12: "No unit
 * in pre-push"): a branch that adds floors fails the unit suite until CI
 * records them, so a unit run here would refuse the push the record needs.
 * The unit suite runs by hand before each push and in CI on every pull
 * request. The hook itself, run with a stand-in npm, is
 * tests/integration/pre-push.test.ts.
 */

const HOOK = '.githooks/pre-push';

/** The hook's commands: every line that is neither blank nor a comment. */
const commands = (): string[] =>
  readFileSync(HOOK, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

describe('the pre-push hook (#547)', () => {
  it('runs the ci-scripts check, format, lint and typecheck, in that order, and nothing else', () => {
    expect(commands()).toEqual([
      'set -euo pipefail',
      'npm run --silent check:ci-scripts',
      'npm run --silent format:check',
      'npm run --silent lint',
      'npm run --silent typecheck',
    ]);
  });
});
