import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * One run job per changed mutation file (#754 AC4), each row predicted
 * before its first run: one file's failure cancelling the others, a job left
 * unbounded, a file with no result read as clean, the results never
 * downloaded, a result for an unlisted file ignored, a lone artifact's
 * result missed at the top of the folder, and the file list word-split
 * where the matrix reads JSON. Unit-suite mutations: they run on the laptop
 * too.
 */

const CI = 'tests/unit/mutations-ci.test.ts';
const VERDICT = 'tests/unit/mutations-verdict.test.ts';
const CHANGED = 'tests/unit/mutations-changed.test.ts';
const TIMEOUTS = 'tests/unit/workflow-timeouts.test.ts';
const SUPPLY = 'tests/unit/supply-chain.test.ts';
const WORKFLOW = '.github/workflows/mutations.yml';
const SCRIPT = 'scripts/mutations-verdict.ts';

export default mutationFile({
  targets: [CI, VERDICT, CHANGED],
  mutations: [
    {
      name: 'fail-fast-left-on',
      file: WORKFLOW,
      anchor: '      fail-fast: false\n',
      replacement: '',
      // The received strategy is a subset of the expected one, so only the
      // message's wording is text the expected value does not hold.
      red: {
        [`${CI} › mutations.yml > runs each listed file in its own job, none cancelling another`]:
          'to deeply equal',
      },
    },
    {
      name: 'per-file-timeout-dropped',
      file: WORKFLOW,
      anchor: '    timeout-minutes: 30\n',
      replacement: '',
      red: {
        [`${CI} › mutations.yml > bounds each job`]:
          'expected undefined to be 30',
        // The repository-wide scan reads every job's bound too.
        [`${TIMEOUTS} › this repo’s workflows stop every job within minutes > every job has a timeout of at most 30 minutes`]:
          'no timeout-minutes, so a hung step runs for 360 minutes',
      },
    },
    {
      name: 'cancelled-read-as-clean',
      file: SCRIPT,
      anchor: "      if (outcome === 'success') return [];\n",
      replacement:
        "      if (outcome === 'success' || outcome === undefined) return [];\n",
      red: {
        [`${VERDICT} › verdict > fails when the run was skipped with files to run`]:
          'files ended skipped',
        [`${VERDICT} › verdict > names a file that uploaded no result, even when the run reads success`]:
          'ran clean',
        [`${VERDICT} › verdict > names every file that did not run clean, in the judge’s order`]:
          'not clean: tests/mutations/3-c.ts',
      },
    },
    {
      name: 'artifact-left-unread',
      file: WORKFLOW,
      anchor:
        "      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2\n        if: ${{ needs.changed.outputs.count != '0' }}\n        with:\n          pattern: mutations-*\n          path: results/\n",
      replacement: '',
      // The floors count this step: 49 uses over 5 action repos and 129
      // workflow steps once #754's floors are recorded, one fewer of each
      // without it.
      red: {
        [`${CI} › mutations.yml > downloads every file job’s artifact before the verdict reads them`]:
          'expected undefined to be',
        [`tests/unit/record-floors.test.ts › the recorder over this repository > runs from no CI workflow step but the record-floors workflow’s (#547)`]:
          'record-floors/workflow-steps: read 128',
        [`${SUPPLY} › the CI supply chain is pinned > every third-party action is pinned to a full commit SHA`]:
          'supply-chain/pinned-uses: read 48',
        [`${SUPPLY} › the CI supply chain is pinned > every pinned action names the version its SHA resolves to`]:
          'supply-chain/versioned-uses: read 48',
        [`${SUPPLY} › Dependabot keeps the pins from rotting > an action repo used at more than one sub-path is grouped into one PR`]:
          'supply-chain/grouped-action-repos: read 4',
        [`${SUPPLY} › Dependabot keeps the pins from rotting > a sub-path group is declared before the catch-all that would swallow it`]:
          'supply-chain/ordered-action-repos: read 4',
      },
    },
    {
      name: 'unlisted-result-ignored',
      file: SCRIPT,
      anchor: '      .filter((file) => !listed.includes(file))\n',
      replacement: '      .filter((file) => !listed.includes(file) && false)\n',
      red: {
        [`${VERDICT} › verdict > refuses a result for a file the judge did not list`]:
          'ran clean',
      },
    },
    {
      name: 'lone-layout-missed',
      file: SCRIPT,
      anchor: 'basename(path) === OUTCOME_FILE',
      replacement: "path.includes('/') && basename(path) === OUTCOME_FILE",
      red: {
        [`${VERDICT} › outcomePaths > finds a lone artifact’s result at the top of the download folder`]:
          'expected [] to deeply equal',
      },
    },
    {
      name: 'list-word-split',
      file: 'scripts/mutations-changed.ts',
      anchor: 'files=${JSON.stringify(files)}',
      replacement: "files=${files.join(' ')}",
      red: {
        [`${CHANGED} › githubOutput > writes the count and the files as a JSON list the run job’s matrix reads (#754)`]:
          '1-a.ts tests/mutations/2-b.ts',
        // A real newline straight after `files=`: only the received string has one.
        [`${CHANGED} › githubOutput > writes an empty list when there is no file, so the check still reports`]:
          'files=\n',
      },
    },
  ],
});
