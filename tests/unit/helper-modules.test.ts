import { describe, expect, it } from 'vitest';
import { scanCollection } from './collection-calls.ts';
import {
  dataReaders,
  helperLoaders,
  helperModules,
  type HelperLoaders,
  type HelperReach,
} from './helper-modules.ts';

/**
 * The helper modules a test file loads (#554): every module it reaches by a
 * relative import, transitively, that is neither core source (`src/`) nor
 * another test file. Their top level runs while Vitest collects the test, so
 * the collection-calls guard judges it as it judges the test's own.
 *
 * Each case is an in-memory tree: `reach` gives the follower its files and
 * reads nothing from disk.
 */
const reach = (
  files: Readonly<Record<string, string>>,
  entries: readonly string[] = ['t/a.test.ts'],
): HelperReach => helperModules(entries, (path) => files[path]);

describe('the follower loads what a test imports', () => {
  const FORMS: readonly (readonly [string, string])[] = [
    ['a named import', "import { x } from './h';"],
    ['a default import', "import h from './h';"],
    ['a namespace import', "import * as h from './h';"],
    ['an aliased import', "import { x as y } from './h';"],
    ['an import for its effects alone', "import './h';"],
    ['a named re-export', "export { x } from './h';"],
    ['a re-export of everything', "export * from './h';"],
    ['a namespace re-export', "export * as h from './h';"],
    ['a dynamic import of a literal path', "await import('./h');"],
    [
      'a mixed import whose value part loads it',
      "import { type T, x } from './h';",
    ],
  ];

  it.each(FORMS)('through %s', (_form, code) => {
    expect(
      reach({ 't/a.test.ts': code, 't/h.ts': 'export const x = 1;' }).helpers,
    ).toEqual(['t/h.ts']);
  });

  const SPELLINGS: readonly (readonly [string, string, string])[] = [
    ['with no extension', './h', 't/h.ts'],
    ['by its .ts name', './h.ts', 't/h.ts'],
    ['by its .js name, as TypeScript resolves it', './h.js', 't/h.ts'],
    ['as a directory, by its index', './dir', 't/dir/index.ts'],
    ['up a directory', '../lib/h', 'lib/h.ts'],
    ['as an .mts module', './m', 't/m.mts'],
  ];

  it.each(SPELLINGS)('spelled %s', (_spelling, specifier, path) => {
    expect(
      reach({
        't/a.test.ts': `import { x } from '${specifier}';`,
        [path]: 'export const x = 1;',
      }).helpers,
    ).toEqual([path]);
  });

  it('through a helper that imports another, to any depth', () => {
    expect(
      reach({
        't/a.test.ts': "import { x } from './h1';",
        't/h1.ts': "export { y as x } from './h2';",
        't/h2.ts': "import { z } from './h3'; export const y = z;",
        't/h3.ts': 'export const z = 1;',
      }).helpers,
    ).toEqual(['t/h1.ts', 't/h2.ts', 't/h3.ts']);
  });

  it('once each, through a cycle', () => {
    expect(
      reach({
        't/a.test.ts': "import { x } from './h1';",
        't/h1.ts': "import { y } from './h2'; export const x = y;",
        't/h2.ts': "import { x } from './h1'; export const y = 1;",
      }).helpers,
    ).toEqual(['t/h1.ts', 't/h2.ts']);
  });

  it('once, when two test files load it', () => {
    expect(
      reach(
        {
          't/a.test.ts': "import { x } from './h';",
          't/b.test.ts': "import { x } from './h';",
          't/h.ts': 'export const x = 1;',
        },
        ['t/a.test.ts', 't/b.test.ts'],
      ).helpers,
    ).toEqual(['t/h.ts']);
  });

  it('listing every relative specifier it met, by file, as the population it read', () => {
    expect(
      reach({
        't/a.test.ts': "import { x } from './h'; import fc from 'fast-check';",
        't/h.ts': "import { y } from '../src/y'; export const x = y;",
        'src/y.ts': 'export const y = 1;',
      }).imports,
    ).toEqual(['t/a.test.ts: ./h', 't/h.ts: ../src/y']);
  });
});

/**
 * Which entries load each helper (#659): of a changed helper, the mutation
 * judge asks which non-unit tests load it, directly or through other helpers.
 */
describe('helperLoaders maps each helper to the entries that load it (#659)', () => {
  const loaders = (
    files: Readonly<Record<string, string>>,
    entries: readonly string[],
  ): HelperLoaders => helperLoaders(entries, (path) => files[path]);

  it('directly', () => {
    expect(
      loaders(
        {
          't/a.test.ts': "import { x } from './h';",
          't/h.ts': 'export const x = 1;',
        },
        ['t/a.test.ts'],
      ).loadedBy,
    ).toEqual(new Map([['t/h.ts', ['t/a.test.ts']]]));
  });

  it('through other helpers, to any depth', () => {
    expect(
      loaders(
        {
          't/a.test.ts': "import { x } from './h1';",
          't/h1.ts': "export { y as x } from './h2';",
          't/h2.ts': "import { z } from './h3'; export const y = z;",
          't/h3.ts': 'export const z = 1;',
        },
        ['t/a.test.ts'],
      ).loadedBy,
    ).toEqual(
      new Map([
        ['t/h1.ts', ['t/a.test.ts']],
        ['t/h2.ts', ['t/a.test.ts']],
        ['t/h3.ts', ['t/a.test.ts']],
      ]),
    );
  });

  it('naming every entry that reaches it, sorted, and no entry that does not', () => {
    expect(
      loaders(
        {
          't/b.test.ts': "import { y } from './h2';",
          't/a.test.ts': "import { x } from './h1';",
          't/h1.ts': "import { y } from './h2'; export const x = y;",
          't/h2.ts': 'export const y = 1;',
        },
        ['t/b.test.ts', 't/a.test.ts'],
      ).loadedBy,
    ).toEqual(
      new Map([
        ['t/h1.ts', ['t/a.test.ts']],
        ['t/h2.ts', ['t/a.test.ts', 't/b.test.ts']],
      ]),
    );
  });

  it('once each, through a cycle entered at either end', () => {
    expect(
      loaders(
        {
          't/a.test.ts': "import { x } from './h1';",
          't/b.test.ts': "import { y } from './h2';",
          't/h1.ts': "import { y } from './h2'; export const x = y;",
          't/h2.ts': "import { x } from './h1'; export const y = 1;",
        },
        ['t/a.test.ts', 't/b.test.ts'],
      ).loadedBy,
    ).toEqual(
      new Map([
        ['t/h1.ts', ['t/a.test.ts', 't/b.test.ts']],
        ['t/h2.ts', ['t/a.test.ts', 't/b.test.ts']],
      ]),
    );
  });

  it('carrying what the follower cannot follow, and the population it read', () => {
    expect(
      loaders({ 't/a.test.ts': "import { x } from './gone';" }, [
        't/a.test.ts',
      ]),
    ).toEqual({
      helpers: [],
      imports: ['t/a.test.ts: ./gone'],
      unresolved: ['t/a.test.ts: ./gone names no file'],
      loadedBy: new Map(),
    });
  });
});

/**
 * Which entries read each data file (#659): a test reads a fixture from disk,
 * not by an import, so the follower counts a test as reading one when the
 * test, or a helper it loads, names it in a string: by its bare file name, by
 * a relative path that resolves to it, or by its repository path.
 */
describe('dataReaders maps each data file to the entries whose code names it (#659)', () => {
  const readers = (
    files: Readonly<Record<string, string>>,
    data: readonly string[],
    entries: readonly string[] = ['t/a.test.ts'],
  ): ReadonlyMap<string, readonly string[]> =>
    dataReaders(entries, (path) => files[path], data);

  it.each([
    ['its bare file name', "readFileSync(join(dir, 'x.json'));"],
    ['its bare file name in a template', 'readFileSync(join(dir, `x.json`));'],
    [
      'a relative path that resolves to it',
      "readFileSync('./fixtures/x.json');",
    ],
    ['its repository path', "readFileSync('t/fixtures/x.json');"],
    [
      'a template whose substitution stands for any text',
      'readFileSync(`t/fixtures/${name}.json`);',
    ],
    [
      'a relative path up a folder that resolves to it',
      "readFileSync('../t/fixtures/x.json');",
    ],
    [
      'its repository path written from the root with ./',
      "readFileSync('./t/fixtures/x.json');",
    ],
    [
      'its folder written from the root with ./, and its extension',
      "const DIR = './t/fixtures'; read(join(DIR, `${name}.json`));",
    ],
    [
      'a relative template up a folder that resolves to its folder',
      'read(`../t/fixtures/${name}.json`);',
    ],
    [
      'its folder, up a folder, and its extension, written apart',
      "const DIR = '../t/fixtures'; read(join(DIR, `${name}.json`));",
    ],
    [
      'its folder with a trailing slash and its extension, written apart',
      "const DIR = 't/fixtures/'; read(DIR + `${name}.json`);",
    ],
    [
      'its folder and its extension, written apart',
      "const DIR = 't/fixtures'; read(join(DIR, `${name}.json`));",
    ],
  ])('named in the test by %s', (_how, code) => {
    expect(readers({ 't/a.test.ts': code }, ['t/fixtures/x.json'])).toEqual(
      new Map([['t/fixtures/x.json', ['t/a.test.ts']]]),
    );
  });

  it('named in a helper the test loads, at any depth', () => {
    expect(
      readers(
        {
          't/a.test.ts': "import { x } from './h1';",
          't/h1.ts': "export { y as x } from './h2';",
          't/h2.ts': "export const y = read('x.json');",
        },
        ['t/fixtures/x.json'],
      ),
    ).toEqual(new Map([['t/fixtures/x.json', ['t/a.test.ts']]]));
  });

  it('naming every entry that names it, sorted', () => {
    expect(
      readers(
        {
          't/b.test.ts': "read('x.json');",
          't/a.test.ts': "import { x } from './h';",
          't/h.ts': "export const x = read('x.json');",
        },
        ['t/fixtures/x.json'],
        ['t/b.test.ts', 't/a.test.ts'],
      ),
    ).toEqual(new Map([['t/fixtures/x.json', ['t/a.test.ts', 't/b.test.ts']]]));
  });

  it.each([
    ['a relative path that resolves elsewhere', "read('../other/x.json');"],
    ['a path that does not end with it', "read('other/x.json');"],
    ['a name that only ends like it', "read('ax.json');"],
    ['a name that only starts like it', "read('x.json.bak');"],
    ['a template that resolves elsewhere', 'read(`t/other/${name}.json`);'],
    ['a template of another kind of file', 'read(`t/fixtures/${name}.yml`);'],
    [
      'a template with no folder, which could name any such file',
      'read(join(dir, `${name}.json`));',
    ],
    [
      'a template whose folder is partly built at run time',
      'read(`t/${dir}/${name}.json`);',
    ],
    ['a template that fixes no extension', 'read(`t/fixtures/${name}`);'],
    [
      'a path that ends like it but not on a folder boundary',
      "read('ixtures/x.json');",
    ],
    ['its extension alone', "path.endsWith('.json');"],
    [
      'a template whose folder is built at run time',
      'read(`${dir}/fixtures/${name}.json`);',
    ],
    [
      'its folder with another extension',
      "const DIR = 't/fixtures'; read(join(DIR, `${name}.yml`));",
    ],
    [
      'another folder with its extension',
      "const DIR = 't/other'; read(join(DIR, `${name}.json`));",
    ],
  ])('not named by %s, beside a test that names it', (_how, code) => {
    expect(
      readers(
        { 't/a.test.ts': code, 't/b.test.ts': "read('x.json');" },
        ['t/fixtures/x.json'],
        ['t/a.test.ts', 't/b.test.ts'],
      ),
    ).toEqual(new Map([['t/fixtures/x.json', ['t/b.test.ts']]]));
  });
});

describe('the follower leaves out', () => {
  const OUT: readonly (readonly [string, string, Record<string, string>])[] = [
    [
      'core source under src/, which the guard already refuses a call into',
      "import { x } from '../src/x';",
      { 'src/x.ts': 'export const x = 1;' },
    ],
    [
      'another test file, scanned in its own right',
      "import { x } from './b.test';",
      { 't/b.test.ts': 'export const x = 1;' },
    ],
    [
      'a package, workspace or third-party',
      "import { x } from '@yawelo-idle/core'; import fc from 'fast-check';",
      {},
    ],
    [
      'a type-only import, which loads nothing',
      "import type { T } from './h';",
      { 't/h.ts': 'export type T = 1;' },
    ],
    [
      'an import whose every name is a type',
      "import { type T } from './h';",
      { 't/h.ts': 'export type T = 1;' },
    ],
    [
      'a type-only re-export',
      "export type { T } from './h';",
      { 't/h.ts': 'export type T = 1;' },
    ],
    [
      'a JSON file, which runs no code',
      "import data from './d.json' with { type: 'json' };",
      { 't/d.json': '{}' },
    ],
  ];

  // Each fixture also imports a control helper, so the result is read
  // against what the follower met, never against nothing.
  it.each(OUT)('%s', (_label, code, more) => {
    expect(
      reach({
        't/a.test.ts': `${code}\nimport { c } from './c';`,
        't/c.ts': 'export const c = 1;',
        ...more,
      }).helpers,
    ).toEqual(['t/c.ts']);
  });

  it('src/ at any depth, and nothing src/ itself imports', () => {
    expect(
      reach({
        't/a.test.ts': "import { x } from '../packages/core/src/x';",
        'packages/core/src/x.ts':
          "import { y } from '../test/h'; export const x = y;",
        'packages/core/test/h.ts': 'export const y = 1;',
      }),
    ).toEqual({
      helpers: [],
      imports: ['t/a.test.ts: ../packages/core/src/x'],
      unresolved: [],
    });
  });
});

describe('the follower refuses by name what it cannot follow', () => {
  it('a relative path that names no file', () => {
    expect(reach({ 't/a.test.ts': "import { x } from './gone';" })).toEqual({
      helpers: [],
      imports: ['t/a.test.ts: ./gone'],
      unresolved: ['t/a.test.ts: ./gone names no file'],
    });
  });

  it('a dynamic import of a path it cannot read', () => {
    expect(
      reach({ 't/a.test.ts': "let p = './h'; await import(p);" }).unresolved,
    ).toEqual(['t/a.test.ts: import(p) is not a literal path']);
  });

  it('names what it cannot follow in the order the file writes it (#762)', () => {
    expect(
      reach({
        't/a.test.ts':
          "const h = require('./h');\nawait import(where);\nconst g = require('./g');",
      }).unresolved,
    ).toEqual([
      "t/a.test.ts: require('./h') loads a module the follower does not read",
      't/a.test.ts: import(where) is not a literal path',
      "t/a.test.ts: require('./g') loads a module the follower does not read",
    ]);
  });

  it('a dynamic import of a file URL made at run time (#762)', () => {
    expect(
      reach({
        't/a.test.ts':
          "import { pathToFileURL } from 'node:url';\nawait import(pathToFileURL('./h.ts').href);",
        't/h.ts': 'export const x = 1;',
      }),
    ).toEqual({
      helpers: [],
      imports: [],
      unresolved: [
        "t/a.test.ts: import(pathToFileURL('./h.ts').href) is not a literal path",
      ],
    });
  });

  it('follows a dynamic import of a const bound to a literal path (#762)', () => {
    expect(
      reach({
        't/a.test.ts': "const p = './h.ts'; await import(p);",
        't/h.ts': 'export const x = 1;',
      }),
    ).toEqual({
      helpers: ['t/h.ts'],
      imports: ['t/a.test.ts: ./h.ts'],
      unresolved: [],
    });
  });

  it('a require of a relative path', () => {
    expect(
      reach({
        't/a.test.ts': "const h = require('./h');",
        't/h.ts': 'export const x = 1;',
      }).unresolved,
    ).toEqual([
      "t/a.test.ts: require('./h') loads a module the follower does not read",
    ]);
  });

  it('a loader made by createRequire, given a relative path', () => {
    expect(
      reach({
        't/a.test.ts':
          "import { createRequire } from 'node:module'; const load = createRequire(import.meta.url); load('./h');",
        't/h.ts': 'export const x = 1;',
      }).unresolved,
    ).toEqual([
      "t/a.test.ts: load('./h') loads a module the follower does not read",
    ]);
  });

  it.each([
    ['a package', "load('typescript')"],
    ['a JSON file, which runs no code', "load('../package.json')"],
  ])('but not %s a loader loads', (_what, call) => {
    expect(
      reach({
        't/a.test.ts': `import { createRequire } from 'node:module'; const load = createRequire(import.meta.url); ${call};\nimport { c } from './c';`,
        't/c.ts': 'export const c = 1;',
      }),
    ).toEqual({
      helpers: ['t/c.ts'],
      imports: ['t/a.test.ts: ./c'],
      unresolved: [],
    });
  });
});

/**
 * The follower and the collection scanner together, as the guard runs them
 * (tests/guards/collection-calls.test.ts): each refused form planted in a
 * helper the follower reaches, and the forms the scanner allows there.
 */
describe('a helper the follower reaches is judged as a test is (#554)', () => {
  const TEST = "import { s } from './h';\n";
  /** The files the guard would scan, and what it would refuse in them. */
  const scanTree = (
    files: Readonly<Record<string, string>>,
  ): { scanned: readonly string[]; refused: readonly string[] } => {
    const tree: Readonly<Record<string, string>> = {
      't/a.test.ts': TEST,
      ...files,
    };
    const scanned = ['t/a.test.ts', ...reach(tree).helpers];
    return {
      scanned,
      refused: scanned.flatMap((file) =>
        scanCollection(tree[file] ?? '', file).refused.map(
          (site) => `${file}: ${site.call} -> ${site.reaches}`,
        ),
      ),
    };
  };
  const judgeTree = (files: Readonly<Record<string, string>>) =>
    scanTree(files).refused;

  it('refuses core run at a helper’s top level', () => {
    expect(
      judgeTree({
        't/h.ts':
          "import { initialState } from '../src/state';\nexport const s = initialState(0, 1);",
      }),
    ).toEqual(['t/h.ts: initialState -> initialState (../src/state)']);
  });

  it('refuses a helper whose top level calls another helper', () => {
    expect(
      judgeTree({
        't/h.ts': "import { make } from './h2';\nexport const s = make();",
        't/h2.ts': 'export const make = () => 1;',
      }),
    ).toEqual(['t/h.ts: make -> make (./h2)']);
  });

  it('refuses a helper deeper down, reached through a re-export', () => {
    expect(
      judgeTree({
        't/h.ts': "export { s } from './h2';",
        't/h2.ts':
          "import { initialState } from '../src/state';\nexport const s = initialState(0, 1);",
      }),
    ).toEqual(['t/h2.ts: initialState -> initialState (../src/state)']);
  });

  it('allows core in a helper’s entry point, and in a function only declared there', () => {
    expect(
      scanTree({
        't/h.ts':
          "import { initialState } from '../src/state';\nexport const s = () => initialState(0, 1);\nif (import.meta.main) initialState(0, 1);",
      }),
    ).toEqual({ scanned: ['t/a.test.ts', 't/h.ts'], refused: [] });
  });
});
