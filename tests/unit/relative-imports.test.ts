import { describe, expect, it } from 'vitest';
import {
  relativeSpecifiers,
  type RelativeSpecifier,
} from './helper-modules.ts';
import { unnamedFiles } from './relative-imports.ts';

/**
 * Every relative specifier names its file (#762): the reader lists each one
 * a file writes, in every form that loads or mocks a module, and the judge
 * finds each that names no file exactly, as Node's own loader resolves it.
 * Each case is in memory; nothing is read from disk.
 */

/**
 * `vi`, for fixtures that write a mock call. Vitest 5.0.3's native loader
 * (the coverage runs, #762) hoists mocks in any test file whose raw text,
 * strings and comments included, spells a mock call on `vi` (mock, unmock,
 * hoisted, doMock, doUnmock), and then breaks the
 * file's imports (measured: `__vi_import_0__ is not defined`); a fixture
 * built from this name never spells the call.
 */
const VI = 'vi';

const only = (source: string): RelativeSpecifier => {
  const { specifiers, unread } = relativeSpecifiers('t/a.ts', source);
  expect(unread).toHaveLength(0);
  expect(specifiers).toHaveLength(1);
  const [specifier] = specifiers;
  if (specifier === undefined) throw new Error('no specifier read');
  return specifier;
};

describe('the reader lists each relative specifier a file writes', () => {
  const FORMS: readonly (readonly [
    string,
    string,
    RelativeSpecifier['form'],
    boolean,
  ])[] = [
    ['a named import', "import { x } from './h';", 'import', false],
    ['a default import', "import h from './h';", 'import', false],
    ['a namespace import', "import * as h from './h';", 'import', false],
    ['an aliased import', "import { x as y } from './h';", 'import', false],
    ['an import for its effects alone', "import './h';", 'import', false],
    [
      'a mixed import whose value part loads it',
      "import { type T, x } from './h';",
      'import',
      false,
    ],
    [
      'an import of types alone',
      "import type { T } from './h';",
      'import',
      true,
    ],
    [
      'an import whose every name is a type',
      "import { type T } from './h';",
      'import',
      true,
    ],
    ['a named re-export', "export { x } from './h';", 'export', false],
    ['a re-export of everything', "export * from './h';", 'export', false],
    ['a namespace re-export', "export * as h from './h';", 'export', false],
    [
      'a re-export of types alone',
      "export type { T } from './h';",
      'export',
      true,
    ],
    [
      'a dynamic import of a literal path',
      "await import('./h');",
      'import()',
      false,
    ],
    ['a require of a literal path', "require('./h');", 'require', false],
    [
      'a createRequire loader of a literal path',
      "const load = createRequire(import.meta.url);\nload('./h');",
      'require',
      false,
    ],
    ['a mock of a literal path', `${VI}.mock('./h');`, 'vi', false],
    ['a mock with a factory', `${VI}.mock('./h', () => ({}));`, 'vi', false],
    ['a mock set in place', `${VI}.doMock('./h');`, 'vi', false],
    ['a mock taken away', `${VI}.unmock('./h');`, 'vi', false],
    ['a mock taken away in place', `${VI}.doUnmock('./h');`, 'vi', false],
    [
      'the real module read past a mock',
      "await vi.importActual('./h');",
      'vi',
      false,
    ],
    ['a mocked module read', "await vi.importMock('./h');", 'vi', false],
    [
      'an import in a type position',
      "type T = typeof import('./h');",
      'import-type',
      true,
    ],
    [
      'an import type naming a member',
      "let x: import('./h').T;",
      'import-type',
      true,
    ],
    [
      'a dynamic import of a const bound to a literal path',
      "const H = './h';\nawait import(H);",
      'import()',
      false,
    ],
  ];

  it.each(FORMS)('reads %s', (_, source, form, typeOnly) => {
    const read = only(source);
    expect(read.specifier).toBe('./h');
    expect(read.form).toBe(form);
    expect(read.typeOnly).toBe(typeOnly);
    expect(source.slice(read.start, read.end)).toBe('./h');
  });

  it('gives each its 1-based line', () => {
    const { specifiers } = relativeSpecifiers(
      't/a.ts',
      "import a from './a';\n\nexport * from '../b';\n",
    );
    expect(specifiers.map(({ specifier, line }) => [specifier, line])).toEqual([
      ['./a', 1],
      ['../b', 3],
    ]);
  });

  it('reads a specifier in double quotes', () => {
    expect(only('import { x } from "./h";').specifier).toBe('./h');
  });

  it('reads a dynamic import written as a template with no substitution', () => {
    expect(only('await import(`./h`);').form).toBe('import()');
  });

  it('leaves out a package specifier', () => {
    const { specifiers, unread } = relativeSpecifiers(
      't/a.ts',
      "import { it } from 'vitest';\nimport x from '@yawelo-idle/core';\nawait import('node:fs');",
    );
    expect({ specifiers, unread }).toEqual({ specifiers: [], unread: [] });
    // Liveness: the same file with one relative import reads that one.
    expect(
      relativeSpecifiers(
        't/a.ts',
        "import { it } from 'vitest';\nimport './h';",
      ).specifiers,
    ).toHaveLength(1);
  });

  it('leaves out a string that only looks like a path', () => {
    const { specifiers } = relativeSpecifiers(
      't/a.ts',
      "const fixture = \"import x from './h';\";\nconst path = './h';",
    );
    expect(specifiers).toHaveLength(0);
    expect(only("const path = './h';\nimport './h';").line).toBe(2);
  });

  it('refuses a dynamic import it cannot read, by its text', () => {
    const { specifiers, unread } = relativeSpecifiers(
      't/a.ts',
      'await import(`./${name}`);\nawait import(where);',
    );
    expect(specifiers).toHaveLength(0);
    expect(unread).toEqual([
      { line: 1, what: 'import(`./${name}`) is not a literal path' },
      { line: 2, what: 'import(where) is not a literal path' },
    ]);
  });

  const COMPUTED_READ: readonly (readonly [string, string])[] = [
    [
      'a const bound to a package path',
      "const P = '@vitest/x';\nawait import(P);",
    ],
    [
      'a file URL made by pathToFileURL',
      "import { pathToFileURL } from 'node:url';\nawait import(pathToFileURL(p).href);",
    ],
    [
      'a file URL made by an aliased pathToFileURL',
      "import { pathToFileURL as url } from 'node:url';\nawait import(url(p).href);",
    ],
  ];
  it.each(COMPUTED_READ)('reads %s as no relative specifier', (_, source) => {
    expect(relativeSpecifiers('t/a.ts', source)).toEqual({
      specifiers: [],
      unread: [],
    });
  });

  const COMPUTED_REFUSED: readonly (readonly [string, string, number])[] = [
    ['a let bound to a path', "let P = './h';\nawait import(P);", 2],
    [
      'a const with a second binding of its name',
      "const P = './h';\nfunction f(P) {\n  return import(P);\n}",
      3,
    ],
    [
      'a const shadowed by a name after a hole in an array pattern',
      "const P = './h';\nconst [, P2, P3] = x, [, , P] = y;\nawait import(P);",
      3,
    ],
    [
      'a const shadowed by a destructured parameter',
      "const P = './h';\nconst f = ({ P }) => import(P);",
      2,
    ],
    [
      'a const bound to a computed path',
      'const P = `./${n}`;\nawait import(P);',
      2,
    ],
    [
      'a pathToFileURL not from node:url',
      "import { pathToFileURL } from './url';\nawait import(pathToFileURL(p).href);",
      2,
    ],
    [
      'a pathToFileURL declared in the file',
      'const pathToFileURL = (p) => p;\nawait import(pathToFileURL(p).href);',
      2,
    ],
    [
      'a pathToFileURL result read for another member',
      "import { pathToFileURL } from 'node:url';\nawait import(pathToFileURL(p).pathname);",
      2,
    ],
  ];
  it.each(COMPUTED_REFUSED)('refuses %s', (_, source, line) => {
    const { specifiers, unread } = relativeSpecifiers('t/a.ts', source);
    expect(specifiers.filter(({ form }) => form === 'import()')).toEqual([]);
    expect(unread.map((entry) => entry.line)).toEqual([line]);
  });

  it('refuses an import() given nothing', () => {
    expect(relativeSpecifiers('t/a.ts', 'await import();').unread).toEqual([
      { line: 1, what: 'import() is not a literal path' },
    ]);
  });

  it('refuses a vi call whose path it cannot read', () => {
    expect(relativeSpecifiers('t/a.ts', `${VI}.mock(where);`)).toEqual({
      specifiers: [],
      unread: [{ line: 1, what: `${VI}.mock(where) is not a literal path` }],
    });
  });

  it('reads a vi call given an import of a literal path, through the import', () => {
    expect(only(`${VI}.mock(import('./h'));`).form).toBe('import()');
  });
});

describe('the judge finds each specifier that names no file exactly', () => {
  const FILES = new Set([
    't/h.ts',
    't/data.json',
    't/dir/index.ts',
    'up.ts',
    't/h.js.ts',
  ]);
  const has = (path: string): boolean => FILES.has(path);
  const judge = (source: string): string[] =>
    unnamedFiles(
      't/a.ts',
      relativeSpecifiers('t/a.ts', source).specifiers,
      has,
    );

  const NAMED: readonly (readonly [string, string])[] = [
    ['a file in the same folder', "import './h.ts';"],
    ['a file a folder up', "import '../up.ts';"],
    ['a data file', "import data from './data.json' with { type: 'json' };"],
    ['a path through its own folder', "import './dir/../h.ts';"],
    ['a path that starts with ./ twice', "import '././h.ts';"],
  ];
  it.each(NAMED)('passes %s', (_, source) => {
    expect(judge(source)).toEqual([]);
    // Liveness: the same specifier with its extension dropped is found.
    expect(judge(source.replace(/\.(ts|json)'/, "'"))).toHaveLength(1);
  });

  const UNNAMED: readonly (readonly [string, string, string])[] = [
    ['no extension', "import './h';", "t/a.ts:1: './h' names no file"],
    [
      'a .js extension for a .ts file',
      "import './h.js';",
      "t/a.ts:1: './h.js' names no file",
    ],
    ['a folder', "import './dir';", "t/a.ts:1: './dir' names no file"],
    [
      'a folder with a trailing slash',
      "import './dir/';",
      "t/a.ts:1: './dir/' names no file",
    ],
    [
      'a type-only import with no extension',
      "import type { T } from './h';",
      "t/a.ts:1: './h' names no file",
    ],
    [
      'a mock with no extension',
      `${VI}.mock('./h');`,
      "t/a.ts:1: './h' names no file",
    ],
    [
      'a dynamic import with no extension',
      "await import('./h');",
      "t/a.ts:1: './h' names no file",
    ],
    [
      'a file that is not there',
      "import './gone.ts';",
      "t/a.ts:1: './gone.ts' names no file",
    ],
  ];
  it.each(UNNAMED)('finds %s', (_, source, finding) => {
    expect(judge(source)).toEqual([finding]);
  });

  it('finds every one in a file, in order, each by its line', () => {
    expect(
      judge("import './h';\nimport './h.ts';\nexport * from '../up';"),
    ).toEqual([
      "t/a.ts:1: './h' names no file",
      "t/a.ts:3: '../up' names no file",
    ]);
  });
});
