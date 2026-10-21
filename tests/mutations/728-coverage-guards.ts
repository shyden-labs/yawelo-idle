import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The coverage record's two whole-tree rules (#728), in the guards suite.
 * Predicted before the first run. One row takes a kind out of the table, so
 * a tracked stylesheet is of no listed kind; the other writes a skip comment
 * into tracked code, in the form v8 reads.
 */

const GUARD = 'tests/guards/coverage.test.ts';
const G = `${GUARD} › coverage (#728) >`;

export default mutationFile({
  targets: [GUARD],
  mutations: [
    {
      name: 'css-of-no-kind',
      file: 'scripts/coverage-kinds.ts',
      anchor: "  '.css',\n",
      replacement: '',
      red: {
        [`${G} every committable file is of a kind the coverage record names`]:
          'to deeply equal',
      },
    },
    {
      name: 'skip-comment-written',
      file: 'scripts/coverage-kinds.ts',
      anchor: 'export function kindOf(',
      replacement: '/* v8 ignore next */\nexport function kindOf(',
      red: {
        [`${G} no JavaScript or TypeScript file tells a coverage tool to skip lines`]:
          'to deeply equal',
      },
    },
  ],
});
