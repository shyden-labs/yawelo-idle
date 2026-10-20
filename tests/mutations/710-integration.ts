import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #710 in the integration suite (judge rule #619): scripts/schedule-watch.ts
 * running its main when merely imported turns its load test red. With no
 * repository argument the main writes its usage error to stdout and sets
 * exit code 1, so stderr stays empty and the exit status is what fails. The
 * guard stays in the text and is only made always true, so the list test,
 * which greps for `import.meta.main`, stays green (the lesson of
 * 687-integration.ts). Predicted before it first ran (2026-10-20 UTC).
 */
export default mutationFile({
  targets: ['tests/integration/script-loads.test.ts'],
  mutations: [
    {
      name: 'I1-main-runs-on-import',
      file: 'scripts/schedule-watch.ts',
      anchor: 'if (import.meta.main) {\n',
      replacement: 'if (import.meta.main || true) {\n',
      red: {
        'tests/integration/script-loads.test.ts › the scripts load under Node’s own loader (#391) > scripts/schedule-watch.ts loads without running its main':
          'to be +0',
      },
    },
  ],
});
