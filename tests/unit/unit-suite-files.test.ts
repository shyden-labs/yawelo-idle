import { describe, expect, it } from 'vitest';
import { unitSuiteFiles } from './unit-suite-files';

/**
 * The files the unit suite loads (#551): the unit config's include globs over
 * the files git has, less its exclude globs, its setup files, and every helper
 * module those load by a relative import (#554's follower). Guards that judge
 * "what the unit suite runs" share this one derivation, so a glob added to
 * the config, or a helper imported from anywhere, widens them all.
 */
const TREE: Readonly<Record<string, string>> = {
  'tests/unit/a.test.ts': "import { h } from './h';",
  'tests/unit/h.ts': "import { f } from '../floors';\nexport const h = f;",
  'tests/floors.ts': 'export const f = 1;',
  'tests/unit/setup.ts': "import { s } from '../../scripts/s';",
  'scripts/s.ts': 'export const s = 1;',
  'tests/guards/g.test.ts': "import { g } from './gh';",
  'tests/guards/gh.ts': 'export const g = 1;',
  'packages/core/test/c.test.ts': "import { x } from '../src/x';",
  'packages/core/src/x.ts': 'export const x = 1;',
  'packages/core/properties/p.test.ts': "import fc from 'fast-check';",
};

const files = (overrides: Partial<Parameters<typeof unitSuiteFiles>[0]> = {}) =>
  unitSuiteFiles({
    tracked: Object.keys(TREE),
    read: (path) => TREE[path],
    include: ['tests/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
    exclude: ['tests/guards/**'],
    setupFiles: ['tests/unit/setup.ts'],
    ...overrides,
  });

describe('the unit suite’s files', () => {
  it('are the tests its globs take, its setup files, and the helpers those load', () => {
    expect(files()).toEqual({
      tests: ['packages/core/test/c.test.ts', 'tests/unit/a.test.ts'],
      setup: ['tests/unit/setup.ts'],
      helpers: ['scripts/s.ts', 'tests/floors.ts', 'tests/unit/h.ts'],
      all: [
        'packages/core/test/c.test.ts',
        'scripts/s.ts',
        'tests/floors.ts',
        'tests/unit/a.test.ts',
        'tests/unit/h.ts',
        'tests/unit/setup.ts',
      ],
      imports: [
        'packages/core/test/c.test.ts: ../src/x',
        'tests/unit/a.test.ts: ./h',
        'tests/unit/setup.ts: ../../scripts/s',
        'tests/unit/h.ts: ../floors',
      ],
      unresolved: [],
    });
  });

  it('follow a glob added to the config', () => {
    expect(
      files({
        include: [
          'tests/**/*.test.ts',
          'packages/*/test/**/*.test.ts',
          'packages/*/properties/**/*.test.ts',
        ],
      }).tests,
    ).toEqual([
      'packages/core/properties/p.test.ts',
      'packages/core/test/c.test.ts',
      'tests/unit/a.test.ts',
    ]);
  });

  it('leave out what an exclude glob takes, and the helpers only it loads', () => {
    const { tests, helpers } = files();
    expect({ tests, helpers }).toEqual({
      tests: ['packages/core/test/c.test.ts', 'tests/unit/a.test.ts'],
      helpers: ['scripts/s.ts', 'tests/floors.ts', 'tests/unit/h.ts'],
    });
  });

  it('carry the follower’s refusals', () => {
    expect(
      unitSuiteFiles({
        tracked: ['tests/unit/a.test.ts'],
        read: (path) =>
          path === 'tests/unit/a.test.ts'
            ? "import { h } from './gone';"
            : undefined,
        include: ['tests/**/*.test.ts'],
        exclude: [],
        setupFiles: [],
      }).unresolved,
    ).toEqual(['tests/unit/a.test.ts: ./gone names no file']);
  });
});
