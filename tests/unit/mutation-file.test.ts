import { describe, expect, it } from 'vitest';
import {
  asMutationFile,
  mutationFile,
  mutationFileProblems,
  type Mutation,
  type MutationFile,
} from '../../scripts/mutation-file';

/**
 * The tracked mutation file (#527, spec §3): one set of mutations proving the
 * tests in `targets` can fail. Its shape is checked when the module loads, so
 * a file the runner cannot judge is refused by name before anything runs.
 */

const MUTATION: Mutation = {
  name: 'first-sail-blind',
  file: 'packages/bots/src/targets.ts',
  anchor: '  const first = run.sails[0];',
  replacement: '  const first = run.sails[1];',
  red: {
    'packages/bots/pacing/pacing.test.ts › the pacing targets > (a) idler sets sail':
      'pacing-first-sail/idler',
  },
};

const FILE: MutationFile = {
  targets: ['packages/bots/pacing/pacing.test.ts'],
  mutations: [MUTATION],
};

describe('mutationFileProblems', () => {
  it('finds none in a well-formed file', () => {
    expect(mutationFileProblems(FILE)).toEqual([]);
  });

  it('accepts a mutation predicted green', () => {
    expect(
      mutationFileProblems({
        ...FILE,
        mutations: [{ ...MUTATION, red: {} }],
      }),
    ).toEqual([]);
  });

  it.each<[string, MutationFile, string]>([
    ['no targets', { ...FILE, targets: [] }, 'names no targets'],
    [
      'a target twice',
      { ...FILE, targets: [FILE.targets[0] ?? '', FILE.targets[0] ?? ''] },
      'names packages/bots/pacing/pacing.test.ts twice in targets',
    ],
    ['an empty target', { ...FILE, targets: [''] }, 'has an empty target'],
    ['no mutations', { ...FILE, mutations: [] }, 'holds no mutations'],
    [
      'a name twice',
      { ...FILE, mutations: [MUTATION, MUTATION] },
      'names first-sail-blind twice',
    ],
    [
      'a name that cannot name a log file',
      { ...FILE, mutations: [{ ...MUTATION, name: 'a/b' }] },
      'a/b: a name is letters, digits, dots, dashes and underscores, starting with a letter or digit',
    ],
    [
      'an empty file',
      { ...FILE, mutations: [{ ...MUTATION, file: '' }] },
      'first-sail-blind: names no file',
    ],
    [
      'an empty anchor',
      { ...FILE, mutations: [{ ...MUTATION, anchor: '' }] },
      'first-sail-blind: has an empty anchor',
    ],
    [
      'a replacement equal to its anchor',
      { ...FILE, mutations: [{ ...MUTATION, replacement: MUTATION.anchor }] },
      'first-sail-blind: its replacement is its anchor',
    ],
    [
      'a red test named without its file',
      {
        ...FILE,
        mutations: [{ ...MUTATION, red: { 'a describe > a title': 'x' } }],
      },
      'first-sail-blind: red test "a describe > a title" is not written <file> › <describe> > … > <title>',
    ],
    [
      'a red test with no text to show',
      {
        ...FILE,
        mutations: [{ ...MUTATION, red: { 'a.test.ts › a title': '' } }],
      },
      'first-sail-blind: red test "a.test.ts › a title" names no text its failure must show',
    ],
  ])('refuses %s', (_case, file, problem) => {
    expect(mutationFileProblems(file)).toEqual([problem]);
  });
});

describe('mutationFile', () => {
  it('returns a well-formed file as it is', () => {
    expect(mutationFile(FILE)).toBe(FILE);
  });

  it('throws every problem of a file it refuses', () => {
    expect(() => mutationFile({ targets: [], mutations: [] })).toThrow(
      'mutation file refused:\n  names no targets\n  holds no mutations',
    );
  });
});

describe('asMutationFile', () => {
  it('passes a well-formed module default through', () => {
    expect(asMutationFile(FILE)).toBe(FILE);
  });

  it.each<[string, unknown]>([
    ['nothing', undefined],
    ['a list', []],
    ['targets that are not text', { targets: [1], mutations: [] }],
    ['mutations that are not a list', { targets: [], mutations: {} }],
    [
      'a mutation with a field that is not text',
      { targets: [], mutations: [{ ...MUTATION, anchor: 3 }] },
    ],
    [
      'a red prediction that is not text',
      {
        targets: [],
        mutations: [{ ...MUTATION, red: { 'a.test.ts › b': 1 } }],
      },
    ],
  ])('refuses %s', (_case, value) => {
    expect(() => asMutationFile(value)).toThrow(
      'does not default-export mutationFile({ targets, mutations })',
    );
  });
});
