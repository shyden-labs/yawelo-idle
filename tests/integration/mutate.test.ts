import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { MutationFile } from '../../scripts/mutation-file';
import { mutableSuites, realIo, runFile } from '../../scripts/mutate';
import { vitestListed, type Suite } from '../../scripts/record-floors';

/**
 * The mutation runner run for real (#527, spec §7 AC4b), over a fixture
 * repository written here: a guards suite with a target guard, a guard that
 * imports a helper, and a whole-repo guard that reads the source as text
 * (the class #491's predictions missed). One run of four mutations, shared
 * by the tests below and started by the first that needs it (#97).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const FILES: Readonly<Record<string, string>> = {
  'package.json':
    '{ "name": "mutate-fixture", "private": true, "type": "module" }\n',
  '.gitignore': 'node_modules\n.mutations\n.vite-cache\n',
  'vitest.guards.config.ts': [
    "import { defineConfig } from 'vitest/config';",
    'export default defineConfig({',
    "  cacheDir: '.vite-cache',",
    "  test: { include: ['guards/**/*.test.ts'] },",
    '});',
    '',
  ].join('\n'),
  // The repository's floor check, cut down: equality, and record mode.
  'floors.ts': [
    "import { appendFileSync, readFileSync } from 'node:fs';",
    'const recorded = (guard: string): Record<string, number> =>',
    "  JSON.parse(readFileSync(new URL(`./tests/floors/${guard}.json`, import.meta.url), 'utf8'));",
    'export function floorBreach(id: string, actual: number, site: string): string | undefined {',
    '  const record = process.env.FLOORS_RECORD;',
    '  if (record) {',
    "    appendFileSync(record, JSON.stringify({ id, actual, site }) + '\\n');",
    '    return undefined;',
    '  }',
    "  const measured = recorded(id.split('/')[0] ?? '')[id];",
    '  if (measured === undefined) return `${id} is not recorded`;',
    '  return actual === measured ? undefined : `${id}: read ${actual}, recorded ${measured}`;',
    '}',
    '',
  ].join('\n'),
  'src/reader.ts':
    'export const readAll = (items: readonly number[]): number[] => items.map((x) => x);\n',
  'src/helper.ts':
    'export const help = (items: readonly number[]): number[] => items.filter(() => true);\n',
  'guards/reader.test.ts': [
    "import { expect, it } from 'vitest';",
    "import { floorBreach } from '../floors';",
    "import { readAll } from '../src/reader';",
    "it('reads every item', () => {",
    '  const read = readAll([1, 2, 3, 4]);',
    '  expect(read.filter((x) => x < 0)).toEqual([]);',
    "  expect(floorBreach('reader/items', read.length, 'guards/reader.test.ts:7')).toBeUndefined();",
    '});',
    '',
  ].join('\n'),
  'guards/helper.test.ts': [
    "import { expect, it } from 'vitest';",
    "import { floorBreach } from '../floors';",
    "import { help } from '../src/helper';",
    "it('helps every item', () => {",
    '  const helped = help([1, 2]);',
    "  expect(floorBreach('helper/items', helped.length, 'guards/helper.test.ts:6')).toBeUndefined();",
    '});',
    '',
  ].join('\n'),
  // A whole-repo guard: reads the source as text, imports none of it.
  'guards/count.test.ts': [
    "import { readFileSync } from 'node:fs';",
    "import { expect, it } from 'vitest';",
    "import { floorBreach } from '../floors';",
    "it('counts every items in the source', () => {",
    "  const text = ['src/reader.ts', 'src/helper.ts'].map((f) => readFileSync(f, 'utf8')).join('');",
    "  const count = text.split('items').length - 1;",
    "  expect(floorBreach('count/items', count, 'guards/count.test.ts:6')).toBeUndefined();",
    '});',
    '',
  ].join('\n'),
  'tests/floors/count.json': '{ "count/items": 4 }\n',
  'tests/floors/helper.json': '{ "helper/items": 2 }\n',
  'tests/floors/reader.json': '{ "reader/items": 4 }\n',
};

const READER = 'guards/reader.test.ts › reads every item';
const HELPER = 'guards/helper.test.ts › helps every item';

const FILE: MutationFile = {
  targets: ['guards/reader.test.ts'],
  mutations: [
    {
      // Blind to the first item, and one more `items` in the source text.
      name: 'reader-blind',
      file: 'src/reader.ts',
      anchor: 'items.map(',
      replacement: 'items.slice(items.length > 3 ? 1 : 0).map(',
      red: { [READER]: 'reader/items' },
    },
    {
      // A target's own floor moves, and the prediction says green.
      name: 'target-floor-unpredicted',
      file: 'guards/reader.test.ts',
      anchor: 'readAll([1, 2, 3, 4])',
      replacement: 'readAll([1, 2, 3])',
      red: {},
    },
    {
      // The helper guard imports the mutated file: its floor is the author's.
      name: 'importer-floor-unpredicted',
      file: 'src/helper.ts',
      anchor: 'filter(() => true)',
      replacement: 'filter((_, i) => i > 0)',
      red: {},
    },
    {
      name: 'importer-floor-predicted',
      file: 'src/helper.ts',
      anchor: 'filter(() => true)',
      replacement: 'filter((_, i) => i > 0)',
      red: { [HELPER]: 'helper/items' },
    },
  ],
};

const IDENTITY = {
  GIT_AUTHOR_NAME: 'fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
};

function git(root: string, args: readonly string[]): void {
  const done = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...IDENTITY },
  });
  if (done.status !== 0)
    throw new Error(`git ${args.join(' ')} failed: ${done.stderr}`);
}

const SUITES: readonly Suite[] = [
  {
    name: 'guards suite',
    cwd: '.',
    list: [
      'npx',
      'vitest',
      'list',
      '--filesOnly',
      '-c',
      'vitest.guards.config.ts',
    ],
    files: vitestListed,
    run: { unrecordable: 'a fixture' },
    mutate: { kind: 'vitest', config: 'vitest.guards.config.ts' },
  },
];

interface Ran {
  readonly root: string;
  readonly lines: readonly string[];
  readonly counts: { readonly matched: number; readonly rows: number };
}

async function runFixture(): Promise<Ran> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mutate-fixture-')));
  for (const [path, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'));
  git(root, ['init', '-q']);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'fixture']);
  const lines: string[] = [];
  const io = {
    ...realIo({ root, ci: true, suites: SUITES, floorsDir: 'tests/floors' }),
    print: (line: string) => lines.push(line),
  };
  const counts = await runFile(
    io,
    'tests/mutations/fixture.ts',
    FILE,
    mutableSuites(SUITES),
  );
  return { root, lines, counts };
}

let ran: Promise<Ran> | undefined;
const fixture = (): Promise<Ran> => (ran ??= runFixture());

/** The lines printed for one row: its verdict and the indented lines after it. */
async function row(name: string): Promise<string[]> {
  const { lines } = await fixture();
  const start = lines.findIndex((line) => line.endsWith(` ${name}`));
  if (start === -1) throw new Error(`no row ${name} in:\n${lines.join('\n')}`);
  const end = lines.findIndex((line, i) => i > start && !line.startsWith('  '));
  return lines.slice(start, end === -1 ? undefined : end);
}

describe('the mutation runner over a fixture guards suite', () => {
  it('matches a blinded reader whose source text moves a whole-repo floor, predicting that floor itself', async () => {
    expect(await row('reader-blind')).toEqual([
      'ok   reader-blind',
      '  whole-repo floor: count/items 4 → 5, guards/count.test.ts',
    ]);
  });

  // The second line's tail is vitest's headline of the failed assertion,
  // which cuts a long string short: the runner owns the prefix, and the
  // floor id survives any cut, so those are asserted.
  it('misses a moved floor in a target that the prediction left out', async () => {
    expect(await row('target-floor-unpredicted')).toEqual([
      'MISS target-floor-unpredicted',
      expect.stringMatching(
        new RegExp(`^  unpredicted red: ${READER}: .*reader/items`),
      ),
    ]);
  });

  it('misses a moved floor in a guard importing the mutated file, when not predicted', async () => {
    expect(await row('importer-floor-unpredicted')).toEqual([
      'MISS importer-floor-unpredicted',
      expect.stringMatching(
        new RegExp(`^  unpredicted red: ${HELPER}: .*helper/items`),
      ),
    ]);
  });

  it('matches that importer’s moved floor when predicted', async () => {
    expect(await row('importer-floor-predicted')).toEqual([
      'ok   importer-floor-predicted',
    ]);
  });

  it('counts two of the four rows matched', async () => {
    const { counts, lines } = await fixture();
    expect(counts).toEqual({ matched: 2, rows: 4 });
    expect(lines.at(-1)).toBe('tests/mutations/fixture.ts: 2 of 4 matched');
  });

  it('leaves the fixture as HEAD has it', async () => {
    const { root } = await fixture();
    const status = spawnSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(status.status).toBe(0);
    expect(status.stdout).toBe('');
  });
});
