import { describe, expect, it } from 'vitest';
import {
  mutationFilesIn,
  readNameStatus,
  summary,
} from '../../scripts/mutations-changed';
import { againstControl } from '../searched';

/**
 * Which mutation files a pull request adds or changes (#649, spec §7), read
 * from `git diff --name-status`. The `mutations` workflow runs exactly
 * these through the runner. Paths come from the pull request, so any that
 * could carry more than a file name is refused rather than passed on.
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

describe('summary', () => {
  it('says how many mutation files changed of how many paths it judged', () => {
    expect(summary(['tests/mutations/a.ts'], 7)).toBe(
      '1 mutation file changed of 7 paths judged',
    );
  });

  it('says so when none changed', () => {
    expect(summary([], 3)).toBe('0 mutation files changed of 3 paths judged');
  });
});
