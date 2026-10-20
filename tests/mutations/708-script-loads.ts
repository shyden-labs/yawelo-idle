import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * scripts/verify-roadmap.ts (#708) loads under Node's own loader, the way
 * deploy-dev's verify-roadmap job runs it (#391). Predicted before the first
 * run. The row puts back #391's defect: an import without its extension,
 * which Vitest resolves and Node does not. The `import.meta.main` text stays,
 * so the list of scripts with a main does not move.
 */

const LOADS = 'tests/integration/script-loads.test.ts';

export default mutationFile({
  targets: [LOADS],
  mutations: [
    {
      name: 'extensionless-import',
      file: 'scripts/verify-roadmap.ts',
      anchor: "import { required, verifyRoadmap } from './verify-dev.ts';\n",
      replacement: "import { required, verifyRoadmap } from './verify-dev';\n",
      red: {
        [`${LOADS} › the scripts load under Node’s own loader (#391) > scripts/verify-roadmap.ts loads without running its main`]:
          "to be ''",
      },
    },
  ],
});
