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
const SUITE = `${LOADS} › the scripts load under Node’s own loader (#391) >`;
const LOAD_CASE = `${SUITE} scripts/develop-squash-only.ts loads without running its main`;
const LISTED = `${SUITE} lists every script with a main, as git has them, at the recorded floor`;
const SCRIPT = 'scripts/develop-squash-only.ts';
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
      // no GH_TOKEN, so it refuses before any request and exits 1. The
      // replacement also drops the `import.meta.main` text the list derives
      // from, so the list reds too. That red was added after CI run
      // 39174825654 showed it (a hindsight prediction); the two rows below
      // split the causes and were predicted before their first run.
      name: 'main-runs-on-import',
      file: SCRIPT,
      anchor: 'if (import.meta.main) {',
      replacement: 'if (true) {',
      red: { [LISTED]: SCRIPT, [LOAD_CASE]: 'expected 1 to be +0' },
    },
    {
      // The main runs on import, but the text stays, so the list still has it.
      name: 'main-runs-with-the-text-kept',
      file: SCRIPT,
      anchor: 'if (import.meta.main) {',
      replacement: 'if (import.meta.main || true) {',
      red: { [LOAD_CASE]: 'expected 1 to be +0' },
    },
    {
      // The same guard spelt so the text is gone: the script still loads
      // without running its main, and only the list misses it.
      name: 'main-hidden-from-the-list',
      file: SCRIPT,
      anchor: 'if (import.meta.main) {',
      replacement: "if (import.meta['main']) {",
      red: { [LISTED]: SCRIPT },
    },
  ],
});
