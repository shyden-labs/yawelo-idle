import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #619's three new entry scripts in the list of scripts that load under
 * Node's own loader (#391), each row predicted before its first run: one
 * misspelt in the list, one whose main runs on import, and one holding
 * syntax Node's type stripping refuses. Integration-suite mutations: CI
 * only.
 */

const LOADS = 'tests/integration/script-loads.test.ts';
const SUITE = `${LOADS} › the scripts load under Node’s own loader (#391) >`;
const LISTED = `${SUITE} lists every script with a main, as git has them, at the recorded floor`;

export default mutationFile({
  targets: [LOADS],
  mutations: [
    // Replaces `list-drops-the-verdict`, whose first run (mutations run
    // 39069727455) the runner refused: deleting the entry also deleted the
    // test the list generates for it, so the total moved (121 tests, not
    // 122). A misspelt entry keeps every test. Predicted before its first
    // run, not copied from one.
    {
      name: 'list-misspells-the-verdict',
      file: LOADS,
      anchor: "  'scripts/mutations-verdict.ts',\n",
      replacement: "  'scripts/mutations-verdict.mts',\n",
      red: {
        [LISTED]: 'scripts/mutations-verdict.mts',
        [`${SUITE} scripts/mutations-verdict.mts loads without running its main`]:
          'ERR_MODULE_NOT_FOUND',
      },
    },
    {
      name: 'verdict-runs-its-main-on-import',
      file: 'scripts/mutations-verdict.ts',
      anchor: 'if (import.meta.main) {',
      replacement: 'if (true) {',
      red: {
        [LISTED]: 'scripts/mutations-verdict.ts',
        [`${SUITE} scripts/mutations-verdict.ts loads without running its main`]:
          'expected 1 to be +0',
      },
    },
    {
      name: 'loader-holds-an-enum',
      file: 'scripts/load-mutation-files.ts',
      anchor: '/** What the loader printed for one file. */',
      replacement:
        'enum Never {\n  A,\n}\n/** What the loader printed for one file. */',
      red: {
        [`${SUITE} scripts/load-mutation-files.ts loads without running its main`]:
          'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX',
      },
    },
  ],
});
