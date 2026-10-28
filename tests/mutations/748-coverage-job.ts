import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * record-floors measures coverage in its own job (#748), in the unit suite.
 * Predicted before the first run (2026-10-22 UTC). Each row breaks one
 * property of the coverage job in the workflow, never a test: it waits for
 * the floors job, lays the recorded floors over tests/floors/ before it
 * measures, measures under ci.yml's limit and image, records with the
 * switch, and checks out the commit it was given.
 *
 * #771's SHA-tip test also reds the first and seventh rows (CI mutations run
 * 40697004648): a coverage job that waits on nothing no longer reaches the
 * gate, and one that checks out another commit leaves the jobs checking out
 * the given SHA. Those two SHA_TIP entries were added after that run, not
 * predicted; 771-record-rehearse.ts's last three rows test the explanation.
 */

const FLOORS = 'tests/unit/record-floors-workflow.test.ts';
const F = `${FLOORS} › the record-floors workflow (#547, #718) >`;
const JOBS = `${F} holds the floors job, then a coverage job that waits for it, unconditionally (#748)`;
const FRESH = `${F} measures coverage without the switch on a fresh install of the commit, the recorded floors laid over it, then records it with the switch (#728, #748)`;
const LIMITS = `${F} measures coverage in the pull request's coverage job's image, user and limits (#748)`;
const SWITCH = `${F} is the only workflow that sets the recorder’s switch: a run that checks figures never records them`;
const CHECKOUT = `${F} checks out exactly the SHA it was given, in each job`;
const SHA_TIP = `${F} refuses, before the checkout, a SHA that is not the scratch ref’s tip`;
const FILE = '.github/workflows/record-floors.yml';
const DIRS = 'tests/unit/mutations-recorded-dirs.test.ts';
const D = `${DIRS} › the recorded-count folders the judge leaves out (#728) >`;
const LAY =
  '      - name: Lay the recorded floors over the tree\n        uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2\n        with:\n          name: floors-${{ inputs.sha }}\n          path: tests/floors/\n';
const MEASURE =
  "      # ci.yml's measured limit for the same command (#476).\n      - name: Measure coverage\n        timeout-minutes: 12\n        run: npm run test:coverage -- rehearsal/\n";

export default mutationFile({
  targets: [FLOORS, DIRS],
  mutations: [
    {
      name: 'coverage-does-not-wait',
      file: FILE,
      anchor: '  record-coverage:\n    needs: record-floors\n',
      replacement: '  record-coverage:\n',
      red: { [JOBS]: 'to deeply equal', [SHA_TIP]: 'to deeply equal' },
    },
    {
      name: 'floors-laid-elsewhere',
      file: FILE,
      anchor: `          path: tests/floors/\n${MEASURE.slice(0, 20)}`,
      replacement: `          path: coverage/floors/\n${MEASURE.slice(0, 20)}`,
      red: { [FRESH]: 'to deeply equal' },
    },
    {
      name: 'measured-before-the-floors-are-laid',
      file: FILE,
      anchor: LAY + MEASURE,
      replacement: MEASURE + LAY,
      red: { [FRESH]: 'to deeply equal' },
    },
    {
      name: 'measure-without-the-limit',
      file: FILE,
      anchor:
        '        timeout-minutes: 12\n        run: npm run test:coverage -- rehearsal/\n',
      replacement: '        run: npm run test:coverage -- rehearsal/\n',
      red: { [LIMITS]: 'to deeply equal' },
    },
    {
      name: 'coverage-job-limit-differs',
      file: FILE,
      anchor: '    timeout-minutes: 20\n',
      replacement: '    timeout-minutes: 25\n',
      red: { [LIMITS]: 'to deeply equal' },
    },
    {
      name: 'coverage-recorded-without-the-switch',
      file: FILE,
      anchor:
        '        env:\n          FLOORS_RECORD_JOB: record-floors\n        run: node scripts/coverage.ts record\n',
      replacement: '        run: node scripts/coverage.ts record\n',
      red: {
        [FRESH]: 'to deeply equal',
        [SWITCH]: 'to deeply equal',
      },
    },
    {
      name: 'coverage-checks-out-another-commit',
      file: FILE,
      anchor: '          ref: ${{ inputs.sha }}\n          fetch-depth: 2\n',
      replacement:
        '          ref: ${{ github.sha }}\n          fetch-depth: 2\n',
      red: { [CHECKOUT]: 'to deeply equal', [SHA_TIP]: 'to deeply equal' },
    },
    {
      // Shyden, 2026-10-22: the coverage record counts like floors.
      name: 'coverage-record-judged-as-a-helper',
      file: 'scripts/mutations-changed.ts',
      anchor: '  MINIMUMS_DIR,\n  posix.dirname(RECORD_FILE),\n];\n',
      replacement: '  MINIMUMS_DIR,\n];\n',
      red: {
        [`${D} are the floors, the minimums and the coverage record, and no other`]:
          'to deeply equal',
        [`${D} list the coverage record apart, and still judge a helper named beside its folder`]:
          'to deeply equal',
      },
    },
  ],
});
