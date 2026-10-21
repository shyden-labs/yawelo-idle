import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The coverage record's two whole-tree rules (#728), in the guards suite.
 * Predicted before the first run. One row takes a kind out of the table, so
 * a tracked stylesheet is of no listed kind; one writes a skip comment into
 * tracked code, in the form v8 reads; and one row breaks each helper this
 * pull request changed that a guard loads (#659): the skip pattern, the
 * comment reader, the list of non-unit configs.
 */

const GUARD = 'tests/guards/coverage.test.ts';
const G = `${GUARD} › coverage (#728) >`;
const CONFIGS = 'tests/guards/suite-configs.test.ts';

export default mutationFile({
  targets: [GUARD, CONFIGS],
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
    {
      // The changed helpers the guards load (#659): each one broken in turn.
      name: 'every-comment-read-as-a-skip',
      file: 'tests/unit/coverage-skip.ts',
      anchor: 'const SKIP = /\\b(?:v8|c8|istanbul)\\s+ignore\\b/i;\n',
      replacement: 'const SKIP = /./;\n',
      red: {
        [`${G} no JavaScript or TypeScript file tells a coverage tool to skip lines`]:
          'to deeply equal',
      },
    },
    {
      name: 'strings-read-as-comments',
      file: 'tests/unit/source-text.ts',
      anchor: '  blankLiterals(sf).match(',
      replacement: '  sf.getFullText().match(',
      red: {
        [`${G} no JavaScript or TypeScript file tells a coverage tool to skip lines`]:
          'to deeply equal',
      },
    },
    {
      name: 'a-config-listed-that-is-not-there',
      file: 'tests/unit/suite-configs.ts',
      anchor: 'export const NON_UNIT_VITEST_CONFIGS = [\n',
      replacement:
        "export const NON_UNIT_VITEST_CONFIGS = [\n  'vitest.bogus.config.ts',\n",
      red: {
        [`${CONFIGS} › the non-unit Vitest configs (#476 AC2, #530) > covers every Vitest config but the unit suite’s`]:
          'to deeply equal',
      },
    },
  ],
});
