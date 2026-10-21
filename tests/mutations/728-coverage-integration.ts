import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The coverage CLI as a process (#728), in the integration suite. Predicted
 * before the first run. One row lets the recorder run outside its workflow,
 * one lets it record without a report of HEAD, and one breaks the CLI's
 * load under Node, which the script-loads test and every CLI case see.
 */

const CLI = 'tests/integration/coverage-cli.test.ts';
const C = `${CLI} › the coverage CLI (#728) >`;
const LOADS = 'tests/integration/script-loads.test.ts';

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
      },
    },
  ],
});
