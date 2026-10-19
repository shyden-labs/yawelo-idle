import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #687 in the integration suite (judge rule #619): scripts/owner-review.ts
 * running its main when merely imported turns its load test red. With no
 * repository argument the main writes its usage error to stdout and sets
 * exit code 1, so stderr stays empty and the exit status is what fails.
 * Predicted before it first ran (2026-10-19 UTC).
 */
export default mutationFile({
  targets: ['tests/integration/script-loads.test.ts'],
  mutations: [
    {
      name: 'I1-main-runs-on-import',
      file: 'scripts/owner-review.ts',
      anchor: 'if (import.meta.main) {\n',
      replacement: 'if (true) {\n',
      red: {
        'tests/integration/script-loads.test.ts › the scripts load under Node’s own loader (#391) > scripts/owner-review.ts loads without running its main':
          'to be +0',
      },
    },
  ],
});
