import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The coverage CLI as a process (#728), in the integration suite. Predicted
 * before the first run. One row lets the recorder run outside its workflow,
 * one lets it record without a report of HEAD, and one breaks the CLI's
 * load under Node, which the script-loads test and every CLI case see.
 * The second pull request adds three: the check reading the base at HEAD,
 * every record read as added, the proof judging nothing.
 */

const CLI = 'tests/integration/coverage-cli.test.ts';
const C = `${CLI} › the coverage CLI (#728) >`;
const LOADS = 'tests/integration/script-loads.test.ts';
const K = `${CLI} › the coverage check as the job runs it (#728) >`;
const P = `${CLI} › the documents-only proof as the job runs it (#728) >`;

export default mutationFile({
  targets: [CLI, LOADS],
  mutations: [
    {
      name: 'record-outside-its-workflow',
      file: 'scripts/coverage.ts',
      anchor:
        "  if (refusal !== undefined) die(refusal.replace('floors are', 'coverage is'));\n",
      replacement: '',
      red: {
        [`${C} refuses to record outside the record-floors workflow`]:
          'to contain',
      },
    },
    {
      name: 'record-without-a-report-of-head',
      file: 'scripts/coverage.ts',
      anchor: '  if (stale !== undefined) die(stale);\n',
      replacement: '',
      red: {
        [`${C} refuses to record when no report was measured`]:
          'to deeply equal',
        [`${C} refuses to record a report measured on another commit`]:
          'to deeply equal',
      },
    },
    {
      name: 'cli-does-not-load-under-node',
      file: 'scripts/coverage.ts',
      anchor:
        "import { COVERAGE_SUITES, coverageConfigFile } from './coverage-config.ts';\n",
      replacement:
        "import { COVERAGE_SUITES, coverageConfigFile } from './coverage-config';\n",
      red: {
        [`${LOADS} › the scripts load under Node’s own loader (#391) > scripts/coverage.ts loads without running its main`]:
          'to be',
        [`${LOADS} › the scripts load under Node’s own loader (#391) > scripts/fetch-floors.ts loads without running its main`]:
          'to be',
        // fetch-minimums imports fetch-floors, which imports the CLI.
        [`${LOADS} › the scripts load under Node’s own loader (#391) > scripts/fetch-minimums.ts loads without running its main`]:
          'to be',
        [`${C} names its commands when given none`]: 'to deeply equal',
        [`${C} refuses to record outside the record-floors workflow`]:
          'to contain',
        [`${C} refuses to record when no report was measured`]:
          'to deeply equal',
        [`${C} refuses to record a report measured on another commit`]:
          'to deeply equal',
        [`${C} records the measured table, byte for byte, when the report is of HEAD`]:
          'to be',
        [`${K} passes the pull request that adds the record, its table equal to it`]:
          'to deeply equal',
        [`${K} refuses a table that differs from the record, naming the file`]:
          'to deeply equal',
        [`${K} refuses a record that grew against the one at the merge base`]:
          'to deeply equal',
        [`${K} refuses a record renamed in from elsewhere: not added, and none at the base`]:
          'to deeply equal',
        [`${K} refuses when no record is committed`]: 'to deeply equal',
        [`${P} passes a commit that changed only documents the record does not hold`]:
          'to deeply equal',
        [`${P} refuses a commit that changed code too`]: 'to deeply equal',
      },
    },
    {
      // The check and the proof as the job runs them (PR 2).
      name: 'base-read-at-head',
      file: 'scripts/coverage.ts',
      anchor:
        "  const base = output('git', ['merge-base', 'HEAD', 'origin/develop']);\n",
      replacement: "  const base = output('git', ['rev-parse', 'HEAD']);\n",
      red: {
        [`${K} refuses a record that grew against the one at the merge base`]:
          'to deeply equal',
        [`${K} refuses a record renamed in from elsewhere: not added, and none at the base`]:
          'to deeply equal',
      },
    },
    {
      name: 'every-record-read-as-added',
      file: 'scripts/coverage.ts',
      anchor: '    addsRecord: changes.some(\n',
      replacement: '    addsRecord: true || changes.some(\n',
      red: {
        [`${K} refuses a record renamed in from elsewhere: not added, and none at the base`]:
          'to deeply equal',
      },
    },
    {
      name: 'proof-judges-nothing',
      file: 'scripts/coverage.ts',
      anchor: '  const problems = docsOnlyProblems(changed, recorded);\n',
      replacement: '  const problems: string[] = [];\n',
      red: {
        [`${P} refuses a commit that changed code too`]: 'to deeply equal',
      },
    },
  ],
});
