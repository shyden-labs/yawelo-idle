import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * Each required check is a job that always runs under its own id (#782),
 * in the unit suite. Predicted before the first run (2026-10-30 UTC). Each
 * row plants on a required job a key that would let a pull request merge on
 * a check that never ran or never failed: a job-level `if`, a
 * `continue-on-error`, a `strategy`, and a `name` that renames its context.
 * No other test reads those keys on these jobs (searched), so each row is
 * predicted to turn its own job's test red and nothing else.
 */

const CHECKS =
  'tests/unit/required-checks.test.ts › each required check is a job that always runs under its own id (#782) >';
const TITLE = 'exactly its keys, so nothing can skip, excuse or rename it';

export default mutationFile({
  targets: ['tests/unit/required-checks.test.ts'],
  mutations: [
    {
      name: 'build-and-test-skips-pull-requests',
      file: '.github/workflows/ci.yml',
      anchor: '  build-and-test:\n    runs-on: ubuntu-24.04\n',
      replacement:
        "  build-and-test:\n    if: ${{ github.event_name != 'pull_request' }}\n    runs-on: ubuntu-24.04\n",
      red: { [`${CHECKS} ci.yml build-and-test: ${TITLE}`]: 'to deeply equal' },
    },
    {
      name: 'build-and-test-renamed',
      file: '.github/workflows/ci.yml',
      anchor: '  build-and-test:\n    runs-on: ubuntu-24.04\n',
      replacement:
        '  build-and-test:\n    name: Build and test\n    runs-on: ubuntu-24.04\n',
      red: { [`${CHECKS} ci.yml build-and-test: ${TITLE}`]: 'to deeply equal' },
    },
    {
      name: 'board-orphans-excused',
      file: '.github/workflows/board-orphans.yml',
      anchor: '  board-orphans:\n    runs-on: ubuntu-24.04\n',
      replacement:
        '  board-orphans:\n    continue-on-error: true\n    runs-on: ubuntu-24.04\n',
      red: {
        [`${CHECKS} board-orphans.yml board-orphans: ${TITLE}`]:
          'to deeply equal',
      },
    },
    {
      name: 'mutations-gate-matrixed',
      file: '.github/workflows/mutations.yml',
      anchor:
        '    if: ${{ !cancelled() }}\n    runs-on: ubuntu-24.04\n    timeout-minutes: 2\n',
      replacement:
        '    if: ${{ !cancelled() }}\n    strategy:\n      fail-fast: false\n      matrix:\n        shard: [1]\n    runs-on: ubuntu-24.04\n    timeout-minutes: 2\n',
      red: {
        [`${CHECKS} mutations.yml mutations: ${TITLE}`]: 'to deeply equal',
      },
    },
    {
      name: 'mutations-gate-excused',
      file: '.github/workflows/mutations.yml',
      anchor:
        '    if: ${{ !cancelled() }}\n    runs-on: ubuntu-24.04\n    timeout-minutes: 2\n',
      replacement:
        '    if: ${{ !cancelled() }}\n    continue-on-error: true\n    runs-on: ubuntu-24.04\n    timeout-minutes: 2\n',
      red: {
        [`${CHECKS} mutations.yml mutations: ${TITLE}`]: 'to deeply equal',
      },
    },
  ],
});
