import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The erasable-syntax guard (#653), each row predicted before its first run:
 * the flag dropped from one tsconfig, dropped from one that extends a
 * tsconfig still setting it (each must set it itself), set false, a
 * typecheck that stops reading one tsconfig (the typecheck scripts'
 * cross-check), and a typecheck command the guard does not know (it fails,
 * not skips). Guards-suite mutations: CI only.
 */

const GUARD = 'tests/guards/erasable-syntax.test.ts';
const DESCRIBE = `${GUARD} › erasable syntax only (#653) >`;
const LIST = `${DESCRIBE} lists every tsconfig git has, each one the typecheck reads, at the recorded floor`;
const sets = (path: string): string =>
  `${DESCRIBE} ${path} sets erasableSyntaxOnly itself`;

export default mutationFile({
  targets: [GUARD],
  mutations: [
    {
      name: 'root-drops-the-flag',
      file: 'tsconfig.json',
      anchor: '    "erasableSyntaxOnly": true,\n',
      replacement: '',
      red: { [sets('tsconfig.json')]: 'expected undefined to be true' },
    },
    {
      name: 'child-inherits-the-flag',
      file: 'packages/core/test/tsconfig.json',
      anchor: '    "erasableSyntaxOnly": true,\n',
      replacement: '',
      red: {
        [sets('packages/core/test/tsconfig.json')]:
          'expected undefined to be true',
      },
    },
    {
      name: 'flag-set-false',
      file: 'apps/site/tsconfig.json',
      anchor: '"erasableSyntaxOnly": true',
      replacement: '"erasableSyntaxOnly": false',
      red: {
        [sets('apps/site/tsconfig.json')]: 'expected false to be true',
      },
    },
    {
      name: 'typecheck-skips-a-tsconfig',
      file: 'packages/core/package.json',
      anchor: ' && tsc --noEmit -p logs"',
      replacement: '"',
      red: { [LIST]: 'packages/core/logs/tsconfig.json' },
    },
    {
      name: 'unknown-typecheck-command',
      file: 'apps/sync-worker/package.json',
      anchor: '"typecheck": "tsc --noEmit"',
      replacement: '"typecheck": "vue-tsc --noEmit"',
      red: {
        [LIST]:
          'apps/sync-worker/package.json: unknown typecheck command "vue-tsc --noEmit"',
      },
    },
  ],
});
