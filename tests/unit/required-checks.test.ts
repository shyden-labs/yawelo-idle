import { describe, expect, it } from 'vitest';
import { jobIn } from './workflow-file.ts';

/**
 * A required check is green only if its job ran and passed (global rule,
 * 2026-10-18), and branch protection counts a skipped job as passed. So a
 * job-level `if`, `continue-on-error`, a `strategy`, or a `name` (which
 * renames the check's context) on a required job would let a pull request
 * merge on a check that never ran, while every test of its steps still
 * passes (#782, found by ShyTalk's review, 2026-10-29). Each required job
 * holds exactly the keys below, in order.
 *
 * The required checks (#795): develop requires build-and-test,
 * board-orphans and coverage, and main requires build-and-test, each pinned to app 15368 (GitHub Actions). Each is the id
 * of a job with no `name:`. No test reads that list from GitHub, so it is
 * held here as written there.
 */
const REQUIRED: readonly (readonly [string, string, readonly string[]])[] = [
  [
    'ci.yml',
    'build-and-test',
    ['runs-on', 'timeout-minutes', 'container', 'steps'],
  ],
  [
    'board-orphans.yml',
    'board-orphans',
    ['runs-on', 'timeout-minutes', 'environment', 'steps'],
  ],
  ['ci.yml', 'coverage', ['runs-on', 'timeout-minutes', 'container', 'steps']],
];

describe('each required check is a job that always runs under its own id (#782)', () => {
  for (const [file, id, keys] of REQUIRED)
    it(`${file} ${id}: exactly its keys, so nothing can skip, excuse or rename it`, () => {
      expect(Object.keys(jobIn(file, id))).toEqual(keys);
    });
});
