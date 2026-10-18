import { describe, expect, it } from 'vitest';
import {
  mutationFilesIn,
  needsListings,
  nonUnitTests,
  readNameStatus,
  summary,
  testsPredictedRed,
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

describe('summary', () => {
  it('says how many non-unit tests and mutation files changed of how many paths it judged', () => {
    expect(summary({ tests: 2, files: 1, judged: 7 })).toBe(
      '2 non-unit tests and 1 mutation file changed of 7 paths judged',
    );
  });

  it('says so when none changed', () => {
    expect(summary({ tests: 0, files: 0, judged: 3 })).toBe(
      '0 non-unit tests and 0 mutation files changed of 3 paths judged',
    );
  });

  it('names one test in the singular', () => {
    expect(summary({ tests: 1, files: 2, judged: 4 })).toBe(
      '1 non-unit test and 2 mutation files changed of 4 paths judged',
    );
  });
});
