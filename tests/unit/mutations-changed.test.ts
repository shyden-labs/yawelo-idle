import { describe, expect, it } from 'vitest';
import {
  changedHelpers,
  inTestFolder,
  mutationFilesIn,
  nonUnitLoaders,
  needsListings,
  nonUnitTests,
  readNameStatus,
  redByPlantedFile,
  summary,
  testsPredictedRed,
  unnamedData,
  unprovedHelpers,
  unprovedTests,
} from '../../scripts/mutations-changed';
import type { MutationFile } from '../../scripts/mutation-file';
import { againstControl } from '../searched';

/**
 * Which mutation files a pull request adds or changes (#649, spec §7), read
 * from `git diff --name-status`. The `mutations` workflow runs exactly
 * these through the runner. Paths come from the pull request, so any that
 * could carry more than a file name is refused rather than passed on.
 *
 * The judge (#619 AC2): every non-unit test the pull request adds or
 * changes must be a target of a mutation file it adds or changes.
 */

describe('readNameStatus', () => {
  it('reads each line’s status and path', () => {
    expect(
      readNameStatus('A\ttests/mutations/a.ts\nM\tscripts/mutate.ts\n'),
    ).toEqual([
      { status: 'A', path: 'tests/mutations/a.ts' },
      { status: 'M', path: 'scripts/mutate.ts' },
    ]);
  });

  it('reads a rename as its new path', () => {
    expect(
      readNameStatus('R087\ttests/mutations/old.ts\ttests/mutations/new.ts\n'),
    ).toEqual([{ status: 'R', path: 'tests/mutations/new.ts' }]);
  });

  it('reads nothing from an empty diff', () => {
    expect(
      againstControl(readNameStatus, {
        input: '',
        control: 'A\ttests/mutations/a.ts\n',
      }),
    ).toEqual([]);
  });

  it('refuses a line it cannot read', () => {
    expect(() => readNameStatus('tests/mutations/a.ts\n')).toThrow(
      'git diff --name-status printed a line it cannot read: tests/mutations/a.ts',
    );
  });
});

describe('mutationFilesIn', () => {
  it('keeps mutation files added, changed or renamed in', () => {
    expect(
      mutationFilesIn([
        { status: 'A', path: 'tests/mutations/a.ts' },
        { status: 'M', path: 'tests/mutations/b.ts' },
        { status: 'R', path: 'tests/mutations/c.ts' },
      ]),
    ).toEqual([
      'tests/mutations/a.ts',
      'tests/mutations/b.ts',
      'tests/mutations/c.ts',
    ]);
  });

  it('leaves out a deleted mutation file', () => {
    expect(
      mutationFilesIn([
        { status: 'D', path: 'tests/mutations/gone.ts' },
        { status: 'A', path: 'tests/mutations/a.ts' },
      ]),
    ).toEqual(['tests/mutations/a.ts']);
  });

  it('leaves out every path outside tests/mutations/', () => {
    expect(
      mutationFilesIn([
        { status: 'M', path: 'scripts/mutate.ts' },
        { status: 'A', path: 'tests/mutations/a.ts' },
        { status: 'A', path: 'tests/mutations-old/b.ts' },
      ]),
    ).toEqual(['tests/mutations/a.ts']);
  });

  it('leaves out a file in tests/mutations/ that is not TypeScript', () => {
    expect(
      mutationFilesIn([
        { status: 'A', path: 'tests/mutations/README.md' },
        { status: 'A', path: 'tests/mutations/a.ts' },
      ]),
    ).toEqual(['tests/mutations/a.ts']);
  });

  it.each([
    ['a space', 'tests/mutations/a b.ts'],
    ['a command substitution', 'tests/mutations/$(id).ts'],
    ['a semicolon', 'tests/mutations/a;b.ts'],
    ['a subfolder', 'tests/mutations/x/a.ts'],
  ])('refuses a mutation file named with %s', (_case, path) => {
    expect(() => mutationFilesIn([{ status: 'A', path }])).toThrow(
      `${path} is not a mutation file name the workflow passes on (tests/mutations/<letters, digits, . _ ->.ts)`,
    );
  });
});

describe('nonUnitTests', () => {
  it('maps each file a non-unit suite lists to that suite, leaving out the unit suite’s', () => {
    expect(
      nonUnitTests(
        new Map([
          ['unit suite', ['tests/unit/a.test.ts']],
          ['guards suite', ['tests/guards/b.test.ts']],
          ['game harness', ['apps/web/tests/c.test.ts']],
        ]),
      ),
    ).toEqual(
      new Map([
        ['tests/guards/b.test.ts', 'guards suite'],
        ['apps/web/tests/c.test.ts', 'game harness'],
      ]),
    );
  });

  it('refuses a file two suites list', () => {
    expect(() =>
      nonUnitTests(
        new Map([
          ['guards suite', ['tests/x.test.ts']],
          ['properties suite', ['tests/x.test.ts']],
        ]),
      ),
    ).toThrow('tests/x.test.ts is listed by guards suite and properties suite');
  });
});

describe('testsPredictedRed', () => {
  // A row predicted green proves nothing about a test, so only `red` keys
  // count, never `targets` (a side agent's note, 2026-10-18).
  const row = (
    name: string,
    red: Readonly<Record<string, string>>,
  ): MutationFile['mutations'][number] => ({
    name,
    file: 'scripts/x.ts',
    anchor: 'a',
    replacement: 'b',
    red,
  });

  it('collects the file of every test a row of any file predicts red', () => {
    expect(
      testsPredictedRed([
        {
          targets: ['tests/guards/a.test.ts'],
          mutations: [row('one', { 'tests/guards/a.test.ts › d > t': 'x' })],
        },
        {
          targets: ['tests/guards/b.test.ts'],
          mutations: [
            row('two', { 'tests/guards/b.test.ts › d > e > t': 'y' }),
          ],
        },
      ]),
    ).toEqual(new Set(['tests/guards/a.test.ts', 'tests/guards/b.test.ts']));
  });

  it('leaves out a target whose every row is predicted green', () => {
    expect(
      testsPredictedRed([
        {
          targets: ['tests/guards/a.test.ts', 'tests/guards/c.test.ts'],
          mutations: [
            row('red', { 'tests/guards/a.test.ts › d > t': 'x' }),
            row('green', {}),
          ],
        },
      ]),
    ).toEqual(new Set(['tests/guards/a.test.ts']));
  });
});

describe('unprovedTests', () => {
  const NON_UNIT = new Map([
    ['tests/guards/a.test.ts', 'guards suite'],
    ['tests/guards/b.test.ts', 'guards suite'],
    ['apps/web/tests/c.test.ts', 'game harness'],
  ]);
  const unproved = (path: string, suite: string): string =>
    `${path} (${suite}): no row of a mutation file this pull request adds or changes predicts it red`;

  it('names each non-unit test added, changed or renamed in that no changed mutation file predicts red', () => {
    expect(
      unprovedTests(
        [
          { status: 'A', path: 'tests/guards/a.test.ts' },
          { status: 'M', path: 'apps/web/tests/c.test.ts' },
          { status: 'R', path: 'tests/guards/b.test.ts' },
        ],
        NON_UNIT,
        new Set(),
      ),
    ).toEqual([
      unproved('tests/guards/a.test.ts', 'guards suite'),
      unproved('apps/web/tests/c.test.ts', 'game harness'),
      unproved('tests/guards/b.test.ts', 'guards suite'),
    ]);
  });

  it('passes a changed non-unit test that a changed mutation file predicts red', () => {
    expect(
      unprovedTests(
        [
          { status: 'M', path: 'tests/guards/a.test.ts' },
          { status: 'M', path: 'tests/guards/b.test.ts' },
        ],
        NON_UNIT,
        new Set(['tests/guards/a.test.ts']),
      ),
    ).toEqual([unproved('tests/guards/b.test.ts', 'guards suite')]);
  });

  it('passes a deleted non-unit test', () => {
    expect(
      unprovedTests(
        [
          { status: 'D', path: 'tests/guards/a.test.ts' },
          { status: 'M', path: 'tests/guards/b.test.ts' },
        ],
        NON_UNIT,
        new Set(),
      ),
    ).toEqual([unproved('tests/guards/b.test.ts', 'guards suite')]);
  });

  it('passes a changed path no non-unit suite lists', () => {
    expect(
      unprovedTests(
        [
          { status: 'M', path: 'tests/unit/d.test.ts' },
          { status: 'M', path: 'scripts/mutate.ts' },
          { status: 'M', path: 'tests/guards/b.test.ts' },
        ],
        NON_UNIT,
        new Set(),
      ),
    ).toEqual([unproved('tests/guards/b.test.ts', 'guards suite')]);
  });
});

describe('needsListings', () => {
  it('lists the suites when any changed path is off the docs-only allowlist', () => {
    expect(
      needsListings([
        { status: 'M', path: 'HANDOVER.md' },
        { status: 'M', path: 'tests/guards/a.test.ts' },
      ]),
    ).toBe(true);
  });

  it('lists none when every changed path is HANDOVER.md or Markdown under docs/', () => {
    expect(
      needsListings([
        { status: 'M', path: 'HANDOVER.md' },
        { status: 'A', path: 'docs/notes.md' },
      ]),
    ).toBe(false);
  });
});

/**
 * The changed test helpers (#659): a file in a test folder that no suite
 * lists, which a non-unit test may load. A change there can blind every
 * guard that loads it without changing a test file.
 */
const WORKSPACES = ['apps/*', 'packages/*'];
/** The folders of recorded counts CI writes, left out by Shyden's choice (2026-10-18). */
const RECORDED = ['tests/floors', 'tests/minimums'];

describe('inTestFolder', () => {
  it.each([
    ['tests/searched.ts'],
    ['tests/unit/helper-modules.ts'],
    ['packages/core/test/sim-laws.ts'],
    ['apps/site/test/roadmap/fake.ts'],
    ['apps/web/tests/h.ts'],
  ])('holds %s', (path) => {
    expect(inTestFolder(path, WORKSPACES)).toBe(true);
  });

  it.each([
    ['scripts/mutate.ts', 'outside every test folder'],
    ['packages/core/src/test/x.ts', 'a test/ folder inside src/'],
    ['packages/core/testing/x.ts', 'a folder that only starts with test'],
    ['docs/tests/x.ts', 'a tests/ folder under no workspace'],
    ['packages/a/b/test/x.ts', 'a test/ folder deeper than a workspace'],
    ['contests/x.ts', 'a folder that only ends with tests'],
    ['docs/guide/test/x.ts', 'a test/ folder as deep as a workspace’s'],
  ])('leaves out %s, %s', (path) => {
    expect(inTestFolder(path, WORKSPACES)).toBe(false);
  });

  it('reads a workspace folder package.json names without a wildcard', () => {
    expect(inTestFolder('tools/test/x.ts', ['tools'])).toBe(true);
  });

  it('refuses a workspace pattern it cannot read', () => {
    expect(() => inTestFolder('tests/x.ts', ['apps/**'])).toThrow(
      'package.json names the workspace apps/**, which is neither <folder> nor <folder>/*',
    );
  });
});

describe('changedHelpers', () => {
  const LISTED = new Set([
    'tests/unit/a.test.ts',
    'tests/guards/b.test.ts',
    'apps/web/tests/c.test.ts',
  ]);

  it('keeps each TypeScript file added, changed or renamed in a test folder that no suite lists, in diff order', () => {
    expect(
      changedHelpers(
        [
          { status: 'M', path: 'tests/searched.ts' },
          { status: 'A', path: 'packages/core/test/sim.mts' },
          { status: 'R', path: 'apps/web/tests/fake.cts' },
        ],
        LISTED,
        WORKSPACES,
        RECORDED,
      ),
    ).toEqual({
      helpers: [
        'tests/searched.ts',
        'packages/core/test/sim.mts',
        'apps/web/tests/fake.cts',
      ],
      data: [],
      recorded: [],
      unreadable: [],
    });
  });

  it('leaves out a deleted one', () => {
    expect(
      changedHelpers(
        [
          { status: 'D', path: 'tests/gone.ts' },
          { status: 'M', path: 'tests/floors.ts' },
        ],
        LISTED,
        WORKSPACES,
        RECORDED,
      ).helpers,
    ).toEqual(['tests/floors.ts']);
  });

  it('leaves out a test any suite lists, the unit suite’s included', () => {
    expect(
      changedHelpers(
        [
          { status: 'M', path: 'tests/unit/a.test.ts' },
          { status: 'M', path: 'tests/guards/b.test.ts' },
          { status: 'M', path: 'tests/floors.ts' },
        ],
        LISTED,
        WORKSPACES,
        RECORDED,
      ).helpers,
    ).toEqual(['tests/floors.ts']);
  });

  it('leaves out a file outside the test folders', () => {
    expect(
      changedHelpers(
        [
          { status: 'M', path: 'scripts/mutate.ts' },
          { status: 'M', path: 'scripts/fixtures/data.json' },
          { status: 'M', path: 'tests/floors.ts' },
        ],
        LISTED,
        WORKSPACES,
        RECORDED,
      ),
    ).toEqual({
      helpers: ['tests/floors.ts'],
      data: [],
      recorded: [],
      unreadable: [],
    });
  });

  it('keeps each other file in a test folder as data, which a test may read rather than import, leaving out a deleted one', () => {
    expect(
      changedHelpers(
        [
          { status: 'M', path: 'tests/fixtures/data.json' },
          { status: 'D', path: 'tests/fixtures/gone.json' },
          { status: 'A', path: 'packages/core/test/README.md' },
          { status: 'M', path: 'tests/floors.ts' },
        ],
        LISTED,
        WORKSPACES,
        RECORDED,
      ),
    ).toEqual({
      helpers: ['tests/floors.ts'],
      data: ['tests/fixtures/data.json', 'packages/core/test/README.md'],
      recorded: [],
      unreadable: [],
    });
  });

  it('lists apart, and judges no further, the recorded-count files CI writes (Shyden, 2026-10-18)', () => {
    expect(
      changedHelpers(
        [
          { status: 'M', path: 'tests/floors/web-smoke.json' },
          { status: 'A', path: 'tests/minimums/core-sim.json' },
          { status: 'M', path: 'tests/floors-old/x.json' },
          { status: 'M', path: 'tests/floors.ts' },
        ],
        LISTED,
        WORKSPACES,
        RECORDED,
      ),
    ).toEqual({
      helpers: ['tests/floors.ts'],
      data: ['tests/floors-old/x.json'],
      recorded: ['tests/floors/web-smoke.json', 'tests/minimums/core-sim.json'],
      unreadable: [],
    });
  });

  it.each([['tests/h.js'], ['packages/core/test/h.mjs'], ['tests/unit/h.cjs']])(
    'refuses by name a JavaScript file in a test folder, %s, which the follower does not read',
    (path) => {
      expect(
        changedHelpers([{ status: 'M', path }], LISTED, WORKSPACES, RECORDED),
      ).toEqual({
        helpers: [],
        data: [],
        recorded: [],
        unreadable: [
          `${path}: a JavaScript file in a test folder, which the import follower does not read`,
        ],
      });
    },
  );
});

describe('redByPlantedFile', () => {
  const row = (
    name: string,
    file: string,
    red: Readonly<Record<string, string>>,
  ): MutationFile['mutations'][number] => ({
    name,
    file,
    anchor: 'a',
    replacement: 'b',
    red,
  });

  it('maps each file a row plants in to the test files its rows predict red, across mutation files', () => {
    expect(
      redByPlantedFile([
        {
          targets: ['tests/guards/a.test.ts'],
          mutations: [
            row('one', 'tests/searched.ts', {
              'tests/guards/a.test.ts › d > t': 'x',
            }),
            row('two', 'tests/floors.ts', {
              'tests/guards/a.test.ts › d > t': 'x',
            }),
          ],
        },
        {
          targets: ['tests/guards/b.test.ts'],
          mutations: [
            row('three', 'tests/searched.ts', {
              'tests/guards/b.test.ts › d > e > t': 'y',
            }),
          ],
        },
      ]),
    ).toEqual(
      new Map([
        [
          'tests/searched.ts',
          new Set(['tests/guards/a.test.ts', 'tests/guards/b.test.ts']),
        ],
        ['tests/floors.ts', new Set(['tests/guards/a.test.ts'])],
      ]),
    );
  });

  it('leaves out a file whose every row is predicted green', () => {
    expect(
      redByPlantedFile([
        {
          targets: ['tests/guards/a.test.ts'],
          mutations: [
            row('green', 'tests/searched.ts', {}),
            row('red', 'tests/floors.ts', {
              'tests/guards/a.test.ts › d > t': 'x',
            }),
          ],
        },
      ]),
    ).toEqual(
      new Map([['tests/floors.ts', new Set(['tests/guards/a.test.ts'])]]),
    );
  });
});

describe('unprovedHelpers', () => {
  const LOADED_BY = new Map([
    ['tests/searched.ts', ['tests/guards/a.test.ts', 'tests/guards/b.test.ts']],
    ['tests/floors.ts', ['tests/guards/a.test.ts']],
  ]);
  const unproved = (helper: string, loaders: string): string =>
    `${helper}: loaded by ${loaders}; no row of a mutation file this pull request adds or changes plants in it and predicts one of them red`;

  it('names each changed helper a non-unit test loads that no row plants in', () => {
    expect(
      unprovedHelpers(
        ['tests/searched.ts', 'tests/floors.ts'],
        LOADED_BY,
        new Map(),
      ),
    ).toEqual([
      unproved(
        'tests/searched.ts',
        '2 non-unit tests (tests/guards/a.test.ts, tests/guards/b.test.ts)',
      ),
      unproved('tests/floors.ts', '1 non-unit test (tests/guards/a.test.ts)'),
    ]);
  });

  it('passes a helper a row plants in and predicts red for one test that loads it', () => {
    expect(
      unprovedHelpers(
        ['tests/searched.ts', 'tests/floors.ts'],
        LOADED_BY,
        new Map([['tests/searched.ts', new Set(['tests/guards/b.test.ts'])]]),
      ),
    ).toEqual([
      unproved('tests/floors.ts', '1 non-unit test (tests/guards/a.test.ts)'),
    ]);
  });

  it('fails a helper whose rows predict red only tests that do not load it', () => {
    expect(
      unprovedHelpers(
        ['tests/floors.ts'],
        LOADED_BY,
        new Map([['tests/floors.ts', new Set(['tests/guards/b.test.ts'])]]),
      ),
    ).toEqual([
      unproved('tests/floors.ts', '1 non-unit test (tests/guards/a.test.ts)'),
    ]);
  });

  it('fails a helper when the row predicting its loader red plants in another file', () => {
    expect(
      unprovedHelpers(
        ['tests/floors.ts'],
        LOADED_BY,
        new Map([['tests/searched.ts', new Set(['tests/guards/a.test.ts'])]]),
      ),
    ).toEqual([
      unproved('tests/floors.ts', '1 non-unit test (tests/guards/a.test.ts)'),
    ]);
  });

  it('passes a changed helper no non-unit test loads', () => {
    expect(
      unprovedHelpers(
        ['tests/unit/only-unit.ts', 'tests/floors.ts'],
        LOADED_BY,
        new Map(),
      ),
    ).toEqual([
      unproved('tests/floors.ts', '1 non-unit test (tests/guards/a.test.ts)'),
    ]);
  });

  const loaders = (n: number): string[] =>
    Array.from(
      { length: n },
      (_, i) => `tests/guards/t${String(i + 1)}.test.ts`,
    );

  it('names all five tests that load it when there are five', () => {
    expect(
      unprovedHelpers(
        ['tests/searched.ts'],
        new Map([['tests/searched.ts', loaders(5)]]),
        new Map(),
      ),
    ).toEqual([
      unproved(
        'tests/searched.ts',
        '5 non-unit tests (tests/guards/t1.test.ts, tests/guards/t2.test.ts, tests/guards/t3.test.ts, tests/guards/t4.test.ts, tests/guards/t5.test.ts)',
      ),
    ]);
  });

  it('names the first five tests that load it, and how many more', () => {
    expect(
      unprovedHelpers(
        ['tests/searched.ts'],
        new Map([['tests/searched.ts', loaders(7)]]),
        new Map(),
      ),
    ).toEqual([
      unproved(
        'tests/searched.ts',
        '7 non-unit tests (tests/guards/t1.test.ts, tests/guards/t2.test.ts, tests/guards/t3.test.ts, tests/guards/t4.test.ts, tests/guards/t5.test.ts, and 2 more)',
      ),
    ]);
  });
});

describe('nonUnitLoaders', () => {
  it('keeps only the non-unit tests among each file’s loaders, leaving out a file only unit tests load', () => {
    expect(
      nonUnitLoaders(
        new Map([
          [
            'tests/searched.ts',
            ['tests/guards/a.test.ts', 'tests/unit/u.test.ts'],
          ],
          ['tests/unit/only-unit.ts', ['tests/unit/u.test.ts']],
          ['tests/fixtures/x.json', ['apps/web/tests/c.test.ts']],
        ]),
        new Map([
          ['tests/guards/a.test.ts', 'guards suite'],
          ['apps/web/tests/c.test.ts', 'game harness'],
        ]),
      ),
    ).toEqual(
      new Map([
        ['tests/searched.ts', ['tests/guards/a.test.ts']],
        ['tests/fixtures/x.json', ['apps/web/tests/c.test.ts']],
      ]),
    );
  });
});

describe('unnamedData', () => {
  it('names each changed data file that no test, nor a helper one loads, names, and passes one any test names, a unit test’s included', () => {
    expect(
      unnamedData(
        ['tests/fixtures/x.json', 'tests/fixtures/y.json', 'tests/z.json'],
        new Map([['tests/fixtures/y.json', ['tests/unit/u.test.ts']]]),
      ),
    ).toEqual([
      'tests/fixtures/x.json: no test, nor a helper one loads, names it, so the judge cannot tell which tests read it',
      'tests/z.json: no test, nor a helper one loads, names it, so the judge cannot tell which tests read it',
    ]);
  });
});

describe('summary', () => {
  it('says how many non-unit tests, helpers and mutation files changed of how many paths it judged', () => {
    expect(summary({ tests: 1, helpers: 2, files: 1, judged: 9 })).toBe(
      '1 non-unit test, 2 helpers and 1 mutation file changed of 9 paths judged',
    );
  });

  it('says so when none changed', () => {
    expect(summary({ tests: 0, helpers: 0, files: 0, judged: 3 })).toBe(
      '0 non-unit tests, 0 helpers and 0 mutation files changed of 3 paths judged',
    );
  });

  it('names one helper in the singular', () => {
    expect(summary({ tests: 2, helpers: 1, files: 2, judged: 4 })).toBe(
      '2 non-unit tests, 1 helper and 2 mutation files changed of 4 paths judged',
    );
  });
});
