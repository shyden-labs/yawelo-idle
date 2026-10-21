import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #375's guards-suite mutations, each predicted before its first run: the
 * new lockdown test tsconfig is held to erasable syntax by the guard (the
 * flag dropped from it; its typecheck no longer reading it), and the empty
 * burn-down list still refuses an entry for a scope that is proved.
 * Guards-suite mutations: CI only.
 */

const ERASABLE = 'tests/guards/erasable-syntax.test.ts';
const DESCRIBE = `${ERASABLE} › erasable syntax only (#653) >`;
const LIST = `${DESCRIBE} lists every tsconfig git has, each one the typecheck reads, at the recorded floor`;
const FLOORLESS = 'tests/guards/floorless-searches.test.ts';
const PROVED_SCOPE =
  'packages/core/test/sail.test.ts › never needs a review: unreviewed words and no Insight still sail (D1)';

export default mutationFile({
  targets: [ERASABLE, FLOORLESS],
  mutations: [
    {
      name: 'lockdown-test-tsconfig-drops-the-flag',
      file: 'packages/lockdown/test/tsconfig.json',
      anchor: '    "erasableSyntaxOnly": true,\n',
      replacement: '',
      red: {
        [`${DESCRIBE} packages/lockdown/test/tsconfig.json sets erasableSyntaxOnly itself`]:
          'expected undefined to be true',
      },
    },
    {
      name: 'lockdown-typecheck-skips-its-test-tsconfig',
      file: 'packages/lockdown/package.json',
      anchor: ' && tsc --noEmit -p test"',
      replacement: '"',
      red: { [LIST]: 'packages/lockdown/test/tsconfig.json' },
    },
    {
      name: 'burn-down-lists-a-proved-scope',
      file: 'tests/unit/floorless-searches.burn-down.ts',
      anchor: 'export const UNPROVED: Readonly<Record<string, number>> = {};\n',
      replacement: `export const UNPROVED: Readonly<Record<string, number>> = {\n  '${PROVED_SCOPE}': 1,\n};\n`,
      red: {
        [`${FLOORLESS} › every absence search is proved, or listed (#361) > finds every scope holding exactly the unproved searches listed`]: `${PROVED_SCOPE}: 0 unproved, 1 listed.`,
      },
    },
  ],
});
