import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #679's integration tests, predicted before their first run: the pre-push
 * hook runs format, lint and typecheck alone now that the ci-scripts check
 * is retired, and the new squash-only script loads under Node's own loader
 * without running its main. Integration-suite mutations: they run in CI only.
 */

const PRE_PUSH = 'tests/integration/pre-push.test.ts';
const HOOK_CASE = `${PRE_PUSH} › the pre-push hook (#123 AC2) > `;
const LOADS = 'tests/integration/script-loads.test.ts';
const LOAD_CASE = `${LOADS} › the scripts load under Node’s own loader (#391) > scripts/develop-squash-only.ts loads without running its main`;
const RETIRED = 'check:ci-scripts';

export default mutationFile({
  targets: [PRE_PUSH, LOADS],
  mutations: [
    {
      // The retired check is back in the hook, ahead of format.
      name: 'retired-check-runs-again',
      file: '.githooks/pre-push',
      anchor: 'set -euo pipefail\n\nnpm run --silent format:check\n',
      replacement:
        'set -euo pipefail\n\nnpm run --silent check:ci-scripts\nnpm run --silent format:check\n',
      red: {
        [`${HOOK_CASE}runs format:check, lint and typecheck, in that order, and passes (#547: no test suite)`]:
          RETIRED,
        [`${HOOK_CASE}stops the push when format:check fails, running nothing after it`]:
          RETIRED,
        [`${HOOK_CASE}stops the push when lint fails, running nothing after it`]:
          RETIRED,
        [`${HOOK_CASE}stops the push when typecheck fails, running nothing after it`]:
          RETIRED,
      },
    },
    {
      // The import Vitest resolves and Node does not (#391's defect).
      name: 'extensionless-import',
      file: 'scripts/develop-squash-only.ts',
      anchor: "from './gh-reads.ts';",
      replacement: "from './gh-reads';",
      red: { [LOAD_CASE]: 'ERR_MODULE_NOT_FOUND' },
    },
    {
      // Importing the script runs the check: mutations.yml's mutate step sets
      // no GH_TOKEN, so it refuses before any request and exits 1.
      name: 'main-runs-on-import',
      file: 'scripts/develop-squash-only.ts',
      anchor: 'if (import.meta.main) {',
      replacement: 'if (true) {',
      red: { [LOAD_CASE]: 'expected 1 to be +0' },
    },
  ],
});
