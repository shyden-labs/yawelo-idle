# M1 #92: Core Import-Cycle Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A unit guard that reads every module under `packages/core/src`, builds the graph of value imports between them, and fails naming each cycle as `a -> b -> a`, so the class of defect #32's first build shipped through every gate step cannot merge again.

**Architecture:** One helper module, `tests/unit/core-import-graph.ts`, beside the repo's other guard helpers. `scanModule` parses one module with the TypeScript compiler API and lists its relative import and export declarations, each marked value or type-only, and refuses by name what it cannot place in the graph (dynamic `import()`, `require`, `import = require()`, core's own package name). `rawRelativeImports` counts the same declarations in the raw text without the parser, as the independent cross-check. `importGraph` resolves each specifier to a module read, draws an edge for each value import, and reports any module whose raw count and parsed count disagree. `cycles` names every elementary cycle once, from its first module in sorted order. The guard in `core-import-graph.test.ts` runs them over the tracked `packages/core/src` files, with the population read at each level as its own assertion.

**Tech Stack:** Node 24, npm workspaces, TypeScript 6.0 (the compiler API, already a dev dependency), Vitest 4.1. No new dependency.

**Spec:** Story #92. No spec changes: none of the design specs states the acyclic rule; it lived only in the #31 and #32 plans' constraint lists, and this guard is what enforces it.

## Global Constraints

- Node `>=24`; npm workspaces. No new dependency.
- Zero warnings: lint `--max-warnings 0`, typecheck, Prettier, `npm ci` and `npm run build` (design spec §12).
- The guard reads git-tracked files (`trackedFiles`), as `one-test-per-case.test.ts` does, so it judges what CI judges and never an untracked scratch file.
- Every guard proves it saw what it judges, counted at the level it judges (#82): modules read, declarations judged and edges drawn are separate assertions, each with a floor of the measured figure minus one; the raw-text count is the independent cross-check; anything the reader cannot place is refused by name.
- One test per case: a population known before the run is generated as one test each (`it.each`); no loop inside a test body (#58). `BURN_DOWN` stays empty.
- Tests are written first and seen red against stubs, each failing on its own assertion. Every guard is mutation-verified; each mutation's predicted failures are written before it runs.
- Commit messages and PR bodies say `Refs #92`; never put close/fix/resolve next to an issue number. Commits are authored as Shyden.

## Review Focus

1. **Parsed, not grepped.** The reader uses `ts.createSourceFile`, so a comment or a string naming an import is never read as one ("is not misled by a comment or a string naming import()"). The raw count is a regex on purpose: it must not share the parser's blind spots, and a comment spelling out a clause reddens the check rather than hiding a miss.
2. **What counts as relative.** `.` and `..` load a directory's `index.ts`, so they are relative too. The first build read only `./` and `../`, and the raw count needed a `/` after the dots, so both counters were blind to the same form and agreed: `import { x } from '.'` in `grammar.ts` would have closed a cycle through `index.ts` unseen. Found while writing the mutation anchors; the reader, the raw count and resolution now handle both (M1.12, M1.13, M1.26, M2.2, M2.4, M3.4).
3. **Type-only is no edge, an empty import is one.** `import type`, `export type`, and a declaration whose every specifier is `type X` carry no value. `import {} from './x'` and `export {} from './x'` bind nothing but still load the module, and `verbatimModuleSyntax` keeps them (M1.5, M1.9).
4. **AC5 (f) measured first.** Treating type-only declarations as edges finds 2 cycles in today's tree (`sail.ts` type-imports `./sim`: `sail -> sim -> sail` and `sail -> sim -> unfold -> sail`), so M3.7 goes red on the real tree as well as on the fixtures.
5. **Each floor is tight.** 20 modules, 97 declarations and 77 edges. A probe read them at the previous rebuild's head, whose reader this head keeps unchanged, over a `packages/` byte-identical to `develop` `d4b1f94`; the mutations pin them here too, since the baseline is green and one fewer goes red: one declaration (M3.9) and one edge (M3.10) alone, one module (M3.11, `index.ts` left out) with the declarations and edges it carries.
6. **AC6 has one meta-guard to pass, not two.** This repo has no test named a guard-liveness meta-guard: #82 was an audit that put each guard's liveness controls inside the guard itself. The one-test-per-case meta-guard scans this file (M3.13 plants a loop in it and goes red); the liveness controls are this guard's own (Review Focus 5).

## Decisions this plan makes

- **Home:** `tests/unit/core-import-graph.test.ts`, beside the other repo guards, with its helpers in `core-import-graph.ts` as `one-test-per-case.ts` and `workflow-timeouts.ts` are.
- **Resolution:** as TypeScript's bundler resolution within the modules read: as written when the specifier ends in `.ts`, else with `.ts` added, else the directory's `index.ts`. A specifier naming no module read, or reaching outside them, is refused by name; a type-only specifier is resolved too, so a dead one is still refused.
- **Refused, never skipped:** dynamic `import()` (of anything, since its name could be computed), `require()`, `import = require()`, and `@wordfarer/core` or a subpath of it inside core, which would load `index.ts` behind the graph's back.
- **Cycle naming:** each elementary cycle once, from its first module in sorted order (`a.ts -> b.ts -> a.ts`), and the list sorted.

## Acceptance criteria → tasks (#92)

| AC  | What                                                                                                                                                                                                                                                                                             | Task    | Proved by                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | reads every `packages/core/src/*.ts`, builds the graph of value imports and re-exports (type-only ones are no edge), and fails naming each cycle as `a -> b -> a`                                                                                                                                | 1, 2, 3 | `core-import-graph.test.ts` "scanModule reads a value import from every form", "scanModule reads a type-only declaration as no edge", "importGraph resolves each value import to a module read", "cycles names each value-import cycle once", "packages/core/src holds no value-import cycle"; M1.1 to M1.14, M2.3 to M2.9, M2.12, M2.14 to M2.19, M3.1 to M3.4, M3.7, M3.8 |
| 2   | the verdict carries its population: modules read and declarations judged, as separate assertions, each with a floor of the measured figure minus one                                                                                                                                             | 3       | `core-import-graph.test.ts` "packages/core/src holds no value-import cycle"; M2.10, M3.6, M3.9 to M3.11                                                                                                                                                                                                                                                                     |
| 3   | an independent cross-check: the raw count of relative specifiers in each file equals the declarations the parser read for it                                                                                                                                                                     | 1, 2, 3 | `core-import-graph.test.ts` "rawRelativeImports counts relative specifiers in the raw text", "importGraph cross-checks each module against its raw text"; M1.22 to M1.26, M2.11, M3.5                                                                                                                                                                                       |
| 4   | fail-closed parsing: what the reader cannot place is refused by name, never skipped                                                                                                                                                                                                              | 1, 2, 3 | `core-import-graph.test.ts` "scanModule refuses what it cannot place in the graph, by name", "scanModule leaves a package import out of the graph", "importGraph refuses what it cannot resolve, by name"; M1.15 to M1.21, M2.1, M2.2, M2.13, M3.12                                                                                                                         |
| 5   | mutation-verified as predicted: (a) a value import of `reanchor` from `./sim` in `grammar.ts`; (b) the same, multi-line; (c) the same as `export { x } from`; (d) the reader blind to multi-line imports; (e) the walk narrowed to skip one file; (f) type-only imports as edges, measured first | 3       | (a) M3.1, (b) M3.2, (c) M3.3, (d) M3.5, (e) M3.6, (f) M3.7; with M3.4, the same cycle through `'.'`                                                                                                                                                                                                                                                                         |
| 6   | the one-test-per-case and guard-liveness meta-guards pass over the new file                                                                                                                                                                                                                      | 3       | `one-test-per-case.test.ts` "the suite"; M3.13. See Review Focus 6 for the liveness half                                                                                                                                                                                                                                                                                    |

## How this plan was reviewed

The plan was generated from the stage commits by `gen.py`: every code block is the committed file or the diff between two stages, and `verify_blocks.py` checks each one byte for byte. Each pass below ran the mechanical checks (the stage gate on a clean `npm ci` of every stage, the red runs at each stage, every mutation at the head, `verify_blocks.py`, `check_names.py` for every AC row's test names and mutation ids) and then read the whole document.

| Pass | Date       | Findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | 2026-10-03 | Found while building, before the first generation. (1) `isRelative` read only `./` and `../`, and the raw count's regex needed a `/` after the dots, so `'.'` and `'..'` (each loads a directory's `index.ts`) were invisible to the reader and to its cross-check alike; resolution also built `./index.ts` for `'.'`. All three were fixed in Tasks 1 and 2, with tests seen red against the old code (4 in Task 1, 2 in Task 2). (2) The export branch's `clause.elements.length === 0` had no test: `export {} from './b'` joined VALUE_FORMS, and it alone goes red when that check is removed (M1.9). (3) Two sorts were dead: the start-module sort in `cycles` (each cycle is found only from its smallest module and the list is sorted at the end) and the per-module edge sort in `importGraph` (no reader judges edge order); both were removed, with the dead `edges.has(next)` guard in `cycles`. A test now pins the sorted cycle list (M2.17). (4) The liveness comments named a commit the rebuild had removed; they now cite `develop` `d4b1f94`, whose `packages/` is byte-identical to this branch's.                                                                                                                                                                                                                       |
| 1    | 2026-10-03 | Mechanical: the stage gate on a clean `npm ci` passed at all three stages (3,563, 3,590 and 3,597 unit tests); the red runs gave 52, 27 and 33 failures as described, every one the stub's own `not implemented`; all 58 mutations caught as predicted at 3,597, with no run invalid or timed out (the unpredicted failures of non-exact rows are all this guard's own tests, and no real-tree plant reddened another suite); `verify_blocks.py` matched all 7 code blocks; `check_names.py` found every AC row's test names and all 58 mutation ids, each cited; each Task's file list matches its stage diff. Read as an adversary, it found five defects in the prose. (1) Review Focus 5 said the figures were measured at this head; the probe ran at the previous rebuild's head, and the floors' own mutations are what pin them here, now said, with the modules floor (M3.11) added. (2) "as every guard in `tests/unit` does" was false: four guards walk with `readdirSync`; it now names `one-test-per-case.test.ts`. (3) "spec §12" named no spec in a plan that has none; it is the design spec's. (4) Task 3's mutation note left out M3.9, which edits `sim.ts`. (5) The Task 2 stub note left out the `ImportGraph` type it declares. Versions were checked against the lockfile's installs (TypeScript 6.0.3, Vitest 4.1.11). |
| 2    | 2026-10-03 | Mechanical checks re-run on the regenerated plan: 7 code blocks byte-identical, 6 AC rows with every test name and all 58 mutation ids found and cited, every Task's file list matching its stage diff, no placeholder left; no code changed since pass 1, so the stage gate, red runs and mutations stand. Read whole again, with every mutation row this time (the rows whose change holds a `                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `, backticks or several lines render as one cell each): no findings. The plan is approved. |

---

### Task 1: Read each core module's relative imports, value or type

**Files:**

- Create: `tests/unit/core-import-graph.ts`, `tests/unit/core-import-graph.test.ts`

**Interfaces:**

- Consumes: the TypeScript compiler API (`typescript`).
- Produces: `scanModule(file, source) → ModuleScan` (`imports`: `RelativeImport[]` of `{ specifier, value }` in source order; `refused`: each unplaceable form named with its line), `rawRelativeImports(source) → number`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/core-import-graph.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rawRelativeImports, scanModule } from './core-import-graph';

/**
 * packages/core/src keeps an acyclic graph of value imports (#92).
 *
 * #32's first build put four cycles into core through every gate step. These
 * fixtures pin how the reader classifies each way a module can name another;
 * the last block runs it over the real tree.
 */

const VALUE_FORMS: [string, string][] = [
  ['a named import', "import { x } from './b';"],
  ['a default import', "import x from './b';"],
  ['a default and a named import', "import x, { y } from './b';"],
  ['a namespace import', "import * as b from './b';"],
  ['a deferred namespace import', "import defer * as b from './b';"],
  ['a side-effect import', "import './b';"],
  ['a multi-line named import', "import {\n  x,\n  y,\n} from './b';"],
  [
    'a named import with one type specifier',
    "import { type T, x } from './b';",
  ],
  ['an empty import, which still loads the module', "import {} from './b';"],
  ['a double-quoted specifier', 'import { x } from "./b";'],
  ['a named re-export', "export { x } from './b';"],
  ['a multi-line re-export', "export {\n  x,\n  y,\n} from './b';"],
  ['a star re-export', "export * from './b';"],
  ['a namespace re-export', "export * as b from './b';"],
  ['a re-export with one type specifier', "export { type T, x } from './b';"],
  ['an empty re-export, which still loads the module', "export {} from './b';"],
];

const TYPE_FORMS: [string, string][] = [
  ['import type with names', "import type { T } from './b';"],
  ['import type with a default', "import type T from './b';"],
  ['import type with a namespace', "import type * as b from './b';"],
  ['an import whose one specifier is a type', "import { type T } from './b';"],
  [
    'an import whose every specifier is a type',
    "import { type T, type U } from './b';",
  ],
  ['export type with names', "export type { T } from './b';"],
  [
    'a re-export whose every specifier is a type',
    "export { type T } from './b';",
  ],
  ['export type star', "export type * from './b';"],
];

describe('scanModule reads a value import from every form', () => {
  it.each(VALUE_FORMS)('%s', (_label, source) => {
    expect(scanModule('a.ts', source)).toEqual({
      imports: [{ specifier: './b', value: true }],
      refused: [],
    });
  });

  it('reads a parent-relative specifier as written', () => {
    expect(scanModule('x/a.ts', "import { x } from '../b';")).toEqual({
      imports: [{ specifier: '../b', value: true }],
      refused: [],
    });
  });

  it.each([
    ['the current directory', '.'],
    ['the parent directory', '..'],
  ])('reads %s as a relative specifier', (_label, specifier) => {
    expect(scanModule('x/a.ts', `import { x } from '${specifier}';`)).toEqual({
      imports: [{ specifier, value: true }],
      refused: [],
    });
  });

  it('reads every declaration in a module, in source order', () => {
    const source = [
      "import { a } from './a';",
      "import type { T } from './t';",
      "export { c } from './c';",
      "import './d';",
    ].join('\n');
    expect(scanModule('m.ts', source)).toEqual({
      imports: [
        { specifier: './a', value: true },
        { specifier: './t', value: false },
        { specifier: './c', value: true },
        { specifier: './d', value: true },
      ],
      refused: [],
    });
  });
});

describe('scanModule reads a type-only declaration as no edge', () => {
  it.each(TYPE_FORMS)('%s', (_label, source) => {
    expect(scanModule('a.ts', source)).toEqual({
      imports: [{ specifier: './b', value: false }],
      refused: [],
    });
  });
});

describe('scanModule leaves a package import out of the graph', () => {
  it.each([
    ['a bare package', "import Decimal from 'break_infinity.js';"],
    ['a scoped package', "import pow from '@stdlib/math-base-special-pow';"],
    ['a package re-export', "export { z } from 'zod';"],
  ])('%s', (_label, source) => {
    expect(scanModule('a.ts', source)).toEqual({ imports: [], refused: [] });
  });
});

describe('scanModule refuses what it cannot place in the graph, by name', () => {
  it.each([
    [
      'a dynamic import()',
      "export const m = import('./b');",
      'a.ts:1: dynamic import() names a module only when it runs, so the graph cannot hold it; import it statically',
    ],
    [
      'a dynamic import() of a package, whose name could be computed',
      "export const m = import('zod');",
      'a.ts:1: dynamic import() names a module only when it runs, so the graph cannot hold it; import it statically',
    ],
    [
      'a require() call',
      "export const m = require('./b');",
      'a.ts:1: require() is CommonJS, which the graph does not read; import it statically',
    ],
    [
      'an import-equals require',
      "import b = require('./b');",
      'a.ts:1: import = require() is CommonJS, which the graph does not read; import it statically',
    ],
    [
      'core importing its own package by name',
      "import { x } from '@wordfarer/core';",
      "a.ts:1: '@wordfarer/core' names core's own package, which loads index.ts behind the graph's back; import the module relatively",
    ],
    [
      'core importing a subpath of its own package',
      "import { x } from '@wordfarer/core/sim';",
      "a.ts:1: '@wordfarer/core/sim' names core's own package, which loads index.ts behind the graph's back; import the module relatively",
    ],
  ])('%s', (_label, source, refusal) => {
    expect(scanModule('a.ts', source).refused).toEqual([refusal]);
  });

  it('names the line of a refusal deep inside a function', () => {
    const source = "export function f() {\n  return () => import('./b');\n}";
    expect(scanModule('a.ts', source).refused).toEqual([
      'a.ts:2: dynamic import() names a module only when it runs, so the graph cannot hold it; import it statically',
    ]);
  });

  it('refuses every unplaceable form in a module, not only the first', () => {
    const source =
      "export const a = import('./a');\nexport const b = require('./b');";
    expect(scanModule('a.ts', source).refused).toHaveLength(2);
  });

  it('is not misled by a comment or a string naming import()', () => {
    const source =
      "// import('./b') would be refused\nexport const s = \"require('./b')\";";
    expect(scanModule('a.ts', source)).toEqual({ imports: [], refused: [] });
  });
});

describe('rawRelativeImports counts relative specifiers in the raw text', () => {
  it.each([
    ['a single-line import', "import { x } from './b';", 1],
    ['a multi-line import', "import {\n  x,\n} from './b';", 1],
    ['a re-export', "export * from './b';", 1],
    ['a side-effect import', "import './b';", 1],
    ['a double-quoted specifier', 'import { x } from "./b";', 1],
    ['a parent-relative specifier', "import { x } from '../b';", 1],
    ['a bare current directory', "import { x } from '.';", 1],
    ['a bare parent directory', "import { x } from '..';", 1],
    ['a name that only starts with a dot', "import x from '.x';", 0],
    [
      'a type-only import, which is still a declaration',
      "import type { T } from './b';",
      1,
    ],
    ['a package import', "import Decimal from 'break_infinity.js';", 0],
    [
      'three declarations',
      "import { a } from './a';\nimport type { T } from './t';\nexport { c } from './c';",
      3,
    ],
  ])('%s', (_label, source, count) => {
    expect(rawRelativeImports(source)).toBe(count);
  });
});
```

- [ ] **Step 2: Write stubs**

`tests/unit/core-import-graph.ts` (stub):

```ts
export interface RelativeImport {
  readonly specifier: string;
  readonly value: boolean;
}

export interface ModuleScan {
  readonly imports: readonly RelativeImport[];
  readonly refused: readonly string[];
}

export function scanModule(_file: string, _source: string): ModuleScan {
  throw new Error('not implemented: scanModule');
}

export function rawRelativeImports(_source: string): number {
  throw new Error('not implemented: rawRelativeImports');
}
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `npx vitest run tests/unit/core-import-graph.test.ts`

Expected: `Tests  52 failed (52)`. Every test in the new file meets `Error: not implemented` from the stubs, each inside its own test (vitest groups the 52 under 11 distinct error blocks).

- [ ] **Step 4: Implement**

`tests/unit/core-import-graph.ts`:

```ts
import ts from 'typescript';

/**
 * The value-import graph of packages/core/src, which must stay acyclic (#92).
 *
 * An ES module cycle that carries values can read a binding before the module
 * defining it has run, and in core it also means a leaf module (`grammar.ts`)
 * has grown a dependency on the simulation that uses it. #32's first build
 * shipped four such cycles through every gate step.
 *
 * The source is PARSED, not grepped, so a comment or a string naming an
 * import is never read as one. A type-only declaration (`import type`,
 * `export type`, or one whose every specifier is `type X`) carries no value,
 * so it is no edge. An empty `import {} from './x'` is one: it binds nothing
 * but still loads the module, and `verbatimModuleSyntax` keeps it.
 */

/** One relative import or export declaration. */
export interface RelativeImport {
  /** The specifier as written: `'./sim'`. */
  readonly specifier: string;
  /** False for a type-only declaration, which carries no value and is no edge. */
  readonly value: boolean;
}

/** What one module names, read from its source. */
export interface ModuleScan {
  /** Every relative import and export declaration, in source order. */
  readonly imports: readonly RelativeImport[];
  /** Forms the reader cannot place in the graph, each named with its line. */
  readonly refused: readonly string[];
}

const CORE_PACKAGE = '@wordfarer/core';

/** `.` and `..` name a directory's index.ts, so they are relative too. */
const isRelative = (specifier: string): boolean =>
  specifier === '.' ||
  specifier === '..' ||
  specifier.startsWith('./') ||
  specifier.startsWith('../');

/** Does the declaration bind or load a value, or is it types only? */
function carriesValue(
  node: ts.ImportDeclaration | ts.ExportDeclaration,
): boolean {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (clause === undefined) return true;
    if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return false;
    if (clause.name !== undefined) return true;
    const bindings = clause.namedBindings;
    if (bindings === undefined || ts.isNamespaceImport(bindings)) return true;
    return (
      bindings.elements.length === 0 ||
      bindings.elements.some((element) => !element.isTypeOnly)
    );
  }
  if (node.isTypeOnly) return false;
  const clause = node.exportClause;
  if (clause === undefined || ts.isNamespaceExport(clause)) return true;
  return (
    clause.elements.length === 0 ||
    clause.elements.some((element) => !element.isTypeOnly)
  );
}

export function scanModule(file: string, source: string): ModuleScan {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports: RelativeImport[] = [];
  const refused: string[] = [];
  const refuse = (node: ts.Node, problem: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    refused.push(`${file}:${String(line + 1)}: ${problem}`);
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      if (isRelative(specifier)) {
        imports.push({ specifier, value: carriesValue(node) });
      } else if (
        specifier === CORE_PACKAGE ||
        specifier.startsWith(`${CORE_PACKAGE}/`)
      ) {
        refuse(
          node,
          `'${specifier}' names core's own package, which loads index.ts behind the graph's back; import the module relatively`,
        );
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      refuse(
        node,
        'import = require() is CommonJS, which the graph does not read; import it statically',
      );
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        refuse(
          node,
          'dynamic import() names a module only when it runs, so the graph cannot hold it; import it statically',
        );
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require'
      ) {
        refuse(
          node,
          'require() is CommonJS, which the graph does not read; import it statically',
        );
      }
    }
    // A block body: forEachChild stops at the first callback that returns
    // something truthy, so the visitor must return nothing.
    ts.forEachChild(node, (child) => {
      visit(child);
    });
  };
  visit(sf);
  return { imports, refused };
}

/**
 * Relative specifiers in a module's RAW text, counted without the parser: a
 * `from` clause or a side-effect `import` naming `.`, `..` or a path under
 * either. The guard checks this against `scanModule`'s imports, so a reader
 * blind to one form of declaration goes red on the file holding it. A comment spelling out
 * such a clause counts too, which reddens the check rather than hiding a miss.
 */
export const rawRelativeImports = (source: string): number =>
  (source.match(/\b(?:from|import)\s*['"]\.\.?(?:\/|['"])/g) ?? []).length;
```

- [ ] **Step 5: Run the gate**

Commit first: the repo's guards read git-tracked files, as CI does, so a gate run over an untracked test sees nothing of it.

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`

Expected: every step passes; unit `Tests  3563 passed (3563)`.

- [ ] **Step 6: Mutation-verify**

Each row is applied alone at the branch head (stage T3, so later tasks' tests count), the whole unit suite is run, and the file is restored from the commit. Predictions were written before each run; "exact" means every failing test had to be predicted.

| ID    | Change                                                                                                                                              | Predicted red                                                                                                                                                                                                                                            | Result                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| M1.1  | `core-import-graph.ts`: `if (clause === undefined) return true;` → `if (clause === undefined) return false;`                                        | a side-effect import; in source order (exact)                                                                                                                                                                                                            | CAUGHT as predicted (2 failed \| 3595 passed (3597)).  |
| M1.2  | `core-import-graph.ts`: `clause.phaseModifier === ts.SyntaxKind.TypeKeyword` → `clause.phaseModifier === ts.SyntaxKind.DeferKeyword`                | import type with names; import type with a default; import type with a namespace; a deferred namespace import; in source order; counts a type-only declaration but draws no edge; finds no cycle through a type-only import; holds no value-import cycle | CAUGHT as predicted (8 failed \| 3589 passed (3597)).  |
| M1.3  | `core-import-graph.ts`: `if (clause.name !== undefined) return true;` → `if (clause.name !== undefined) return false;`                              | a default import; a default and a named import                                                                                                                                                                                                           | CAUGHT as predicted (2 failed \| 3595 passed (3597)).  |
| M1.4  | `core-import-graph.ts`: `if (bindings === undefined \|\| ts.isNamespaceImport(bindings)) return true;` → `if (bindings === undefined) return true;` | a namespace import; a deferred namespace import (exact)                                                                                                                                                                                                  | CAUGHT as predicted (2 failed \| 3595 passed (3597)).  |
| M1.5  | `core-import-graph.ts`: `bindings.elements.length === 0 \|\|` → `false \|\|`                                                                        | an empty import, which still loads the module (exact)                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M1.6  | `core-import-graph.ts`: `bindings.elements.some((element) => !element.isTypeOnly)` → `bindings.elements.every((element) => !element.isTypeOnly)`    | a named import with one type specifier                                                                                                                                                                                                                   | CAUGHT as predicted (2 failed \| 3595 passed (3597)).  |
| M1.7  | `core-import-graph.ts`: `  if (node.isTypeOnly) return false;` → (deleted)                                                                          | export type with names; export type star                                                                                                                                                                                                                 | CAUGHT as predicted (2 failed \| 3595 passed (3597)).  |
| M1.8  | `core-import-graph.ts`: `if (clause === undefined \|\| ts.isNamespaceExport(clause)) return true;` → `if (clause === undefined) return true;`       | a namespace re-export                                                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M1.9  | `core-import-graph.ts`: `clause.elements.length === 0 \|\|` → `false \|\|`                                                                          | an empty re-export, which still loads the module (exact)                                                                                                                                                                                                 | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M1.10 | `core-import-graph.ts`: `clause.elements.some((element) => !element.isTypeOnly)` → `clause.elements.every((element) => !element.isTypeOnly)`        | a re-export with one type specifier                                                                                                                                                                                                                      | CAUGHT as predicted (2 failed \| 3595 passed (3597)).  |
| M1.11 | `core-import-graph.ts`: `specifier.startsWith('../');` → `specifier.startsWith('../x');`                                                            | reads a parent-relative specifier as written; resolves a specifier into and out of a subdirectory; refuses a specifier reaching outside the modules read                                                                                                 | CAUGHT as predicted (3 failed \| 3594 passed (3597)).  |
| M1.12 | `core-import-graph.ts`: `specifier === '.' \|\|` → `false \|\|`                                                                                     | reads the current directory as a relative specifier; resolves the current directory to its index.ts (exact)                                                                                                                                              | CAUGHT as predicted (2 failed \| 3595 passed (3597)).  |
| M1.13 | `core-import-graph.ts`: `specifier === '..' \|\|` → `false \|\|`                                                                                    | reads the parent directory as a relative specifier; resolves the parent directory to its index.ts; refuses the parent directory of the modules read (exact)                                                                                              | CAUGHT as predicted (3 failed \| 3594 passed (3597)).  |
| M1.14 | `core-import-graph.ts`: `specifier.startsWith('./') \|\|` → `false \|\|`                                                                            | a named import; import type with names; judges every relative import and export declaration; reads each module’s relative imports as its raw text counts them                                                                                            | CAUGHT as predicted (39 failed \| 3558 passed (3597)). |
| M1.15 | `core-import-graph.ts`: `specifier === CORE_PACKAGE \|\|` → `specifier === 'x' \|\|`                                                                | core importing its own package by name (exact)                                                                                                                                                                                                           | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M1.16 | `core-import-graph.ts`: ``specifier.startsWith(`${CORE_PACKAGE}/`)`` → `false`                                                                      | core importing a subpath of its own package (exact)                                                                                                                                                                                                      | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M1.17 | `core-import-graph.ts`: `ts.isImportEqualsDeclaration(node) &&` → `false &&`                                                                        | an import-equals require (exact)                                                                                                                                                                                                                         | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M1.18 | `core-import-graph.ts`: `node.expression.kind === ts.SyntaxKind.ImportKeyword` → `node.expression.kind === ts.SyntaxKind.SuperKeyword`              | a dynamic import(); a dynamic import() of a package; names the line of a refusal deep inside a function; refuses every unplaceable form in a module; carries the reader’s own refusals from every module (exact)                                         | CAUGHT as predicted (5 failed \| 3592 passed (3597)).  |
| M1.19 | `core-import-graph.ts`: `node.expression.text === 'require'` → `node.expression.text === 'requires'`                                                | a require() call; refuses every unplaceable form in a module; carries the reader’s own refusals from every module (exact)                                                                                                                                | CAUGHT as predicted (3 failed \| 3594 passed (3597)).  |
| M1.20 | `core-import-graph.ts`: `      visit(child);` → `      if (node === sf) visit(child);`                                                              | a dynamic import(); a require() call; names the line of a refusal deep inside a function                                                                                                                                                                 | CAUGHT as predicted (6 failed \| 3591 passed (3597)).  |
| M1.21 | `core-import-graph.ts`: `String(line + 1)` → `String(line)`                                                                                         | a dynamic import(); a dynamic import() of a package; a require() call; an import-equals require; core importing its own package by name; core importing a subpath of its own package; names the line of a refusal deep inside a function (exact)         | CAUGHT as predicted (7 failed \| 3590 passed (3597)).  |
| M1.22 | `core-import-graph.ts`: `(?:from\|import)` → `(?:from)`                                                                                             | a side-effect import (exact)                                                                                                                                                                                                                             | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M1.23 | `core-import-graph.ts`: `['"]\.\.?(?:` → `['"]\.(?:`                                                                                                | a parent-relative specifier; a bare parent directory (exact)                                                                                                                                                                                             | CAUGHT as predicted (2 failed \| 3595 passed (3597)).  |
| M1.24 | `core-import-graph.ts`: `\s*['"]\.\.?` → `\s*[']\.\.?`                                                                                              | a double-quoted specifier (exact)                                                                                                                                                                                                                        | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M1.25 | `core-import-graph.ts`: `\.\.?(?:\/\|['"])/g` → `\.\.?/g`                                                                                           | a name that only starts with a dot (exact)                                                                                                                                                                                                               | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M1.26 | `core-import-graph.ts`: `\.\.?(?:\/\|['"])/g` → `\.\.?\//g`                                                                                         | a bare current directory; a bare parent directory (exact)                                                                                                                                                                                                | CAUGHT as predicted (2 failed \| 3595 passed (3597)).  |

- [ ] **Step 7: Commit**

`git commit -m "test(guards): read each core module's relative imports, value or type (Refs #92)"`

### Task 2: Build core's value-import graph and name each cycle

**Files:**

- Modify: `tests/unit/core-import-graph.ts`, `tests/unit/core-import-graph.test.ts`

**Interfaces:**

- Consumes: `scanModule`, `rawRelativeImports`.
- Produces: `importGraph(sources) → ImportGraph` (`modules`, `declarations`, `edges`, `unread`, `refused`), `cycles(edges) → string[]`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/core-import-graph.test.ts` (change):

```diff
diff --git a/tests/unit/core-import-graph.test.ts b/tests/unit/core-import-graph.test.ts
index 775c088..86d6936 100644
--- a/tests/unit/core-import-graph.test.ts
+++ b/tests/unit/core-import-graph.test.ts
@@ -1,5 +1,10 @@
 import { describe, expect, it } from 'vitest';
-import { rawRelativeImports, scanModule } from './core-import-graph';
+import {
+  cycles,
+  importGraph,
+  rawRelativeImports,
+  scanModule,
+} from './core-import-graph';

 /**
  * packages/core/src keeps an acyclic graph of value imports (#92).
@@ -193,3 +198,231 @@ describe('rawRelativeImports counts relative specifiers in the raw text', () =>
     expect(rawRelativeImports(source)).toBe(count);
   });
 });
+
+const graphOf = (modules: Record<string, string>) =>
+  importGraph(new Map(Object.entries(modules)));
+
+const edgesOf = (edges: Record<string, string[]>) =>
+  new Map(Object.entries(edges));
+
+describe('importGraph resolves each value import to a module read', () => {
+  it('resolves a sibling specifier to its .ts module', () => {
+    const graph = graphOf({ 'a.ts': "import { x } from './b';", 'b.ts': '' });
+    expect(graph.edges.get('a.ts')).toEqual(['b.ts']);
+  });
+
+  it('resolves an explicit .ts specifier', () => {
+    const graph = graphOf({
+      'a.ts': "import { x } from './b.ts';",
+      'b.ts': '',
+    });
+    expect(graph.edges.get('a.ts')).toEqual(['b.ts']);
+  });
+
+  it('resolves a directory specifier to its index.ts', () => {
+    const graph = graphOf({
+      'a.ts': "import { x } from './x';",
+      'x/index.ts': '',
+    });
+    expect(graph.edges.get('a.ts')).toEqual(['x/index.ts']);
+  });
+
+  it('resolves a specifier into and out of a subdirectory', () => {
+    const graph = graphOf({
+      'a.ts': "import { c } from './x/c';",
+      'x/c.ts': "import { b } from '../b';",
+      'b.ts': '',
+    });
+    expect(graph.edges.get('a.ts')).toEqual(['x/c.ts']);
+    expect(graph.edges.get('x/c.ts')).toEqual(['b.ts']);
+  });
+
+  it('resolves the current directory to its index.ts', () => {
+    const graph = graphOf({ 'a.ts': "import { x } from '.';", 'index.ts': '' });
+    expect(graph.edges.get('a.ts')).toEqual(['index.ts']);
+  });
+
+  it('resolves the parent directory to its index.ts', () => {
+    const graph = graphOf({
+      'x/c.ts': "import { x } from '..';",
+      'index.ts': '',
+    });
+    expect(graph.edges.get('x/c.ts')).toEqual(['index.ts']);
+  });
+
+  it('lists an edge once, however many declarations name the module', () => {
+    const graph = graphOf({
+      'a.ts': "import { x } from './b';\nexport { y } from './b';",
+      'b.ts': '',
+    });
+    expect(graph.edges.get('a.ts')).toEqual(['b.ts']);
+    expect(graph.declarations).toBe(2);
+  });
+
+  it('counts a type-only declaration but draws no edge for it', () => {
+    const graph = graphOf({
+      'a.ts': "import type { T } from './b';",
+      'b.ts': '',
+    });
+    expect(graph.declarations).toBe(1);
+    expect(graph.edges.get('a.ts')).toEqual([]);
+  });
+
+  it('lists every module read, sorted, with an entry in edges', () => {
+    const graph = graphOf({ 'b.ts': '', 'a.ts': '' });
+    expect(graph.modules).toEqual(['a.ts', 'b.ts']);
+    expect([...graph.edges.keys()]).toEqual(['a.ts', 'b.ts']);
+  });
+});
+
+describe('importGraph refuses what it cannot resolve, by name', () => {
+  it('refuses a specifier naming no module read', () => {
+    expect(graphOf({ 'a.ts': "import { x } from './nope';" }).refused).toEqual([
+      "a.ts: './nope' names no module read here",
+    ]);
+  });
+
+  it('refuses a specifier reaching outside the modules read', () => {
+    expect(graphOf({ 'a.ts': "import { x } from '../b';" }).refused).toEqual([
+      "a.ts: '../b' reaches outside the modules read",
+    ]);
+  });
+
+  it('refuses the parent directory of the modules read', () => {
+    expect(graphOf({ 'a.ts': "import { x } from '..';" }).refused).toEqual([
+      "a.ts: '..' reaches outside the modules read",
+    ]);
+  });
+
+  it('refuses a type-only specifier naming no module, too', () => {
+    expect(
+      graphOf({ 'a.ts': "import type { T } from './nope';" }).refused,
+    ).toEqual(["a.ts: './nope' names no module read here"]);
+  });
+
+  it('carries the reader’s own refusals from every module', () => {
+    const graph = graphOf({
+      'a.ts': "export const m = import('./b');",
+      'b.ts': "export const r = require('./a');",
+    });
+    expect(graph.refused).toHaveLength(2);
+  });
+});
+
+describe('importGraph cross-checks each module against its raw text', () => {
+  it('passes a module whose every relative specifier was judged', () => {
+    const graph = graphOf({
+      'a.ts': "import {\n  x,\n} from './b';\nexport * from './b';",
+      'b.ts': '',
+    });
+    expect(graph.unread).toEqual([]);
+  });
+
+  it('names a module whose raw text holds a specifier the reader did not judge', () => {
+    // A comment spelling out a clause is counted by the raw text alone, so it
+    // stands in here for a declaration form the reader is blind to.
+    const graph = graphOf({
+      'a.ts': "// see: import { y } from './b';\nimport { x } from './b';",
+      'b.ts': '',
+    });
+    expect(graph.unread).toEqual([
+      'a.ts: the raw text names 2 relative modules, the reader judged 1',
+    ]);
+  });
+});
+
+describe('cycles names each value-import cycle once', () => {
+  it('finds none in a chain', () => {
+    expect(
+      cycles(edgesOf({ 'a.ts': ['b.ts'], 'b.ts': ['c.ts'], 'c.ts': [] })),
+    ).toEqual([]);
+  });
+
+  it('finds none in a diamond, where two paths meet without returning', () => {
+    expect(
+      cycles(
+        edgesOf({
+          'a.ts': ['b.ts', 'c.ts'],
+          'b.ts': ['d.ts'],
+          'c.ts': ['d.ts'],
+          'd.ts': [],
+        }),
+      ),
+    ).toEqual([]);
+  });
+
+  it('names a two-module cycle', () => {
+    expect(cycles(edgesOf({ 'a.ts': ['b.ts'], 'b.ts': ['a.ts'] }))).toEqual([
+      'a.ts -> b.ts -> a.ts',
+    ]);
+  });
+
+  it('names a module that imports itself', () => {
+    expect(cycles(edgesOf({ 'a.ts': ['a.ts'] }))).toEqual(['a.ts -> a.ts']);
+  });
+
+  it('names a longer cycle once, from its first module in sorted order', () => {
+    expect(
+      cycles(edgesOf({ 'c.ts': ['a.ts'], 'b.ts': ['c.ts'], 'a.ts': ['b.ts'] })),
+    ).toEqual(['a.ts -> b.ts -> c.ts -> a.ts']);
+  });
+
+  it('names two cycles that share a module', () => {
+    expect(
+      cycles(
+        edgesOf({
+          'a.ts': ['b.ts'],
+          'b.ts': ['a.ts', 'c.ts'],
+          'c.ts': ['b.ts'],
+        }),
+      ),
+    ).toEqual(['a.ts -> b.ts -> a.ts', 'b.ts -> c.ts -> b.ts']);
+  });
+
+  it('names both of #32’s cycles through grammar and sim', () => {
+    expect(
+      cycles(
+        edgesOf({
+          'grammar.ts': ['sim.ts'],
+          'sim.ts': ['grammar.ts', 'production.ts'],
+          'production.ts': ['grammar.ts'],
+        }),
+      ),
+    ).toEqual([
+      'grammar.ts -> sim.ts -> grammar.ts',
+      'grammar.ts -> sim.ts -> production.ts -> grammar.ts',
+    ]);
+  });
+
+  it('lists the cycles in sorted order, whatever order they are found in', () => {
+    expect(
+      cycles(
+        edgesOf({
+          'a.ts': ['c.ts', 'b.ts'],
+          'b.ts': ['a.ts'],
+          'c.ts': ['a.ts'],
+        }),
+      ),
+    ).toEqual(['a.ts -> b.ts -> a.ts', 'a.ts -> c.ts -> a.ts']);
+  });
+
+  it('ignores an edge to a module outside the map', () => {
+    expect(cycles(edgesOf({ 'a.ts': ['zod'] }))).toEqual([]);
+  });
+
+  it('finds no cycle through a type-only import', () => {
+    const graph = graphOf({
+      'a.ts': "import type { T } from './b';",
+      'b.ts': "import { a } from './a';",
+    });
+    expect(cycles(graph.edges)).toEqual([]);
+  });
+
+  it('finds the cycle when the same import carries a value', () => {
+    const graph = graphOf({
+      'a.ts': "import { b } from './b';",
+      'b.ts': "import { a } from './a';",
+    });
+    expect(cycles(graph.edges)).toEqual(['a.ts -> b.ts -> a.ts']);
+  });
+});
```

- [ ] **Step 2: Write stubs**

The stub is Task 1's file with `posix` imported, the `ImportGraph` type declared, and the two new functions throwing:

`tests/unit/core-import-graph.ts` (stub):

```ts
import { posix } from 'node:path';
import ts from 'typescript';

/**
 * The value-import graph of packages/core/src, which must stay acyclic (#92).
 *
 * An ES module cycle that carries values can read a binding before the module
 * defining it has run, and in core it also means a leaf module (`grammar.ts`)
 * has grown a dependency on the simulation that uses it. #32's first build
 * shipped four such cycles through every gate step.
 *
 * The source is PARSED, not grepped, so a comment or a string naming an
 * import is never read as one. A type-only declaration (`import type`,
 * `export type`, or one whose every specifier is `type X`) carries no value,
 * so it is no edge. An empty `import {} from './x'` is one: it binds nothing
 * but still loads the module, and `verbatimModuleSyntax` keeps it.
 */

/** One relative import or export declaration. */
export interface RelativeImport {
  /** The specifier as written: `'./sim'`. */
  readonly specifier: string;
  /** False for a type-only declaration, which carries no value and is no edge. */
  readonly value: boolean;
}

/** What one module names, read from its source. */
export interface ModuleScan {
  /** Every relative import and export declaration, in source order. */
  readonly imports: readonly RelativeImport[];
  /** Forms the reader cannot place in the graph, each named with its line. */
  readonly refused: readonly string[];
}

const CORE_PACKAGE = '@wordfarer/core';

/** `.` and `..` name a directory's index.ts, so they are relative too. */
const isRelative = (specifier: string): boolean =>
  specifier === '.' ||
  specifier === '..' ||
  specifier.startsWith('./') ||
  specifier.startsWith('../');

/** Does the declaration bind or load a value, or is it types only? */
function carriesValue(
  node: ts.ImportDeclaration | ts.ExportDeclaration,
): boolean {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (clause === undefined) return true;
    if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return false;
    if (clause.name !== undefined) return true;
    const bindings = clause.namedBindings;
    if (bindings === undefined || ts.isNamespaceImport(bindings)) return true;
    return (
      bindings.elements.length === 0 ||
      bindings.elements.some((element) => !element.isTypeOnly)
    );
  }
  if (node.isTypeOnly) return false;
  const clause = node.exportClause;
  if (clause === undefined || ts.isNamespaceExport(clause)) return true;
  return (
    clause.elements.length === 0 ||
    clause.elements.some((element) => !element.isTypeOnly)
  );
}

export function scanModule(file: string, source: string): ModuleScan {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports: RelativeImport[] = [];
  const refused: string[] = [];
  const refuse = (node: ts.Node, problem: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    refused.push(`${file}:${String(line + 1)}: ${problem}`);
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      if (isRelative(specifier)) {
        imports.push({ specifier, value: carriesValue(node) });
      } else if (
        specifier === CORE_PACKAGE ||
        specifier.startsWith(`${CORE_PACKAGE}/`)
      ) {
        refuse(
          node,
          `'${specifier}' names core's own package, which loads index.ts behind the graph's back; import the module relatively`,
        );
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      refuse(
        node,
        'import = require() is CommonJS, which the graph does not read; import it statically',
      );
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        refuse(
          node,
          'dynamic import() names a module only when it runs, so the graph cannot hold it; import it statically',
        );
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require'
      ) {
        refuse(
          node,
          'require() is CommonJS, which the graph does not read; import it statically',
        );
      }
    }
    // A block body: forEachChild stops at the first callback that returns
    // something truthy, so the visitor must return nothing.
    ts.forEachChild(node, (child) => {
      visit(child);
    });
  };
  visit(sf);
  return { imports, refused };
}

/**
 * Relative specifiers in a module's RAW text, counted without the parser: a
 * `from` clause or a side-effect `import` naming `.`, `..` or a path under
 * either. The guard checks this against `scanModule`'s imports, so a reader
 * blind to one form of declaration goes red on the file holding it. A comment spelling out
 * such a clause counts too, which reddens the check rather than hiding a miss.
 */
export const rawRelativeImports = (source: string): number =>
  (source.match(/\b(?:from|import)\s*['"]\.\.?(?:\/|['"])/g) ?? []).length;

export interface ImportGraph {
  readonly modules: readonly string[];
  readonly declarations: number;
  readonly edges: ReadonlyMap<string, readonly string[]>;
  readonly unread: readonly string[];
  readonly refused: readonly string[];
}

export function importGraph(_sources: ReadonlyMap<string, string>): ImportGraph {
  void posix;
  throw new Error('not implemented: importGraph');
}

export function cycles(_edges: ReadonlyMap<string, readonly string[]>): string[] {
  throw new Error('not implemented: cycles');
}
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `npx vitest run tests/unit/core-import-graph.test.ts`

Expected: `Tests  27 failed | 52 passed (79)`. The 27 new tests meet `not implemented` from the `importGraph` (18) and `cycles` (9) stubs. The 52 that pass are Task 1's, which the stub file keeps whole.

- [ ] **Step 4: Implement**

`tests/unit/core-import-graph.ts` (change):

```diff
diff --git a/tests/unit/core-import-graph.ts b/tests/unit/core-import-graph.ts
index 02e57c7..ac1e7e2 100644
--- a/tests/unit/core-import-graph.ts
+++ b/tests/unit/core-import-graph.ts
@@ -1,3 +1,4 @@
+import { posix } from 'node:path';
 import ts from 'typescript';

 /**
@@ -135,3 +136,106 @@ export function scanModule(file: string, source: string): ModuleScan {
  */
 export const rawRelativeImports = (source: string): number =>
   (source.match(/\b(?:from|import)\s*['"]\.\.?(?:\/|['"])/g) ?? []).length;
+
+/** The value imports between a set of modules, judged together. */
+export interface ImportGraph {
+  /** Every module read, as its path from the root (`grammar.ts`), sorted. */
+  readonly modules: readonly string[];
+  /** Relative declarations judged across every module, type-only included. */
+  readonly declarations: number;
+  /** Each module's value imports, resolved to modules read, each listed once. */
+  readonly edges: ReadonlyMap<string, readonly string[]>;
+  /** Modules whose raw text names more or fewer relative modules than were judged. */
+  readonly unread: readonly string[];
+  /** Forms and specifiers that could not be placed in the graph, each named. */
+  readonly refused: readonly string[];
+}
+
+/**
+ * The module a relative specifier names, or why it names none. A specifier
+ * is resolved as TypeScript's bundler resolution would within the modules
+ * read: as written when it ends in `.ts`, else with `.ts` added, else as a
+ * directory's `index.ts`.
+ */
+function resolve(
+  from: string,
+  specifier: string,
+  modules: ReadonlySet<string>,
+): { module: string } | { problem: string } {
+  const path = posix.normalize(posix.join(posix.dirname(from), specifier));
+  if (path === '..' || path.startsWith('../')) {
+    return { problem: `'${specifier}' reaches outside the modules read` };
+  }
+  const candidates = path.endsWith('.ts')
+    ? [path]
+    : [`${path}.ts`, posix.join(path, 'index.ts')];
+  const module = candidates.find((candidate) => modules.has(candidate));
+  return module === undefined
+    ? { problem: `'${specifier}' names no module read here` }
+    : { module };
+}
+
+/** The graph of value imports between `sources`, keyed by path from the root. */
+export function importGraph(sources: ReadonlyMap<string, string>): ImportGraph {
+  const modules = [...sources.keys()].sort();
+  const known = new Set(modules);
+  const edges = new Map<string, readonly string[]>();
+  const unread: string[] = [];
+  const refused: string[] = [];
+  let declarations = 0;
+
+  for (const file of modules) {
+    const source = sources.get(file) ?? '';
+    const scan = scanModule(file, source);
+    declarations += scan.imports.length;
+    refused.push(...scan.refused);
+
+    const raw = rawRelativeImports(source);
+    if (raw !== scan.imports.length) {
+      unread.push(
+        `${file}: the raw text names ${String(raw)} relative modules, the reader judged ${String(scan.imports.length)}`,
+      );
+    }
+
+    const targets = new Set<string>();
+    for (const { specifier, value } of scan.imports) {
+      const resolved = resolve(file, specifier, known);
+      if ('problem' in resolved) {
+        refused.push(`${file}: ${resolved.problem}`);
+      } else if (value) {
+        targets.add(resolved.module);
+      }
+    }
+    edges.set(file, [...targets]);
+  }
+  return { modules, declarations, edges, unread, refused };
+}
+
+/**
+ * Every elementary cycle in `edges`, each written once as `a -> b -> a` from
+ * its first module in sorted order. For each start module the search follows
+ * only modules sorted after it, so a cycle is found from its smallest module
+ * and from no other. An edge to a module with no entry in `edges` leads
+ * nowhere.
+ */
+export function cycles(
+  edges: ReadonlyMap<string, readonly string[]>,
+): string[] {
+  const found: string[] = [];
+  for (const start of edges.keys()) {
+    const path = [start];
+    const walk = (at: string): void => {
+      for (const next of edges.get(at) ?? []) {
+        if (next === start) {
+          found.push([...path, start].join(' -> '));
+        } else if (next > start && !path.includes(next)) {
+          path.push(next);
+          walk(next);
+          path.pop();
+        }
+      }
+    };
+    walk(start);
+  }
+  return found.sort();
+}
```

- [ ] **Step 5: Run the gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`

Expected: every step passes; unit `Tests  3590 passed (3590)`.

- [ ] **Step 6: Mutation-verify**

| ID    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Predicted red                                                                                                                                                                                   | Result                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| M2.1  | `core-import-graph.ts`: `if (path === '..' \|\| path.startsWith('../')) {` → `if (path === '..') {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | refuses a specifier reaching outside the modules read (exact)                                                                                                                                   | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.2  | `core-import-graph.ts`: `if (path === '..' \|\| path.startsWith('../')) {` → `if (path.startsWith('../')) {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | refuses the parent directory of the modules read (exact)                                                                                                                                        | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.3  | `core-import-graph.ts`: `path.endsWith('.ts')⏎    ? [path]` → `false⏎    ? [path]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | resolves an explicit .ts specifier                                                                                                                                                              | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.4  | `core-import-graph.ts`: `posix.join(path, 'index.ts')` → `` `${path}/index.ts` ``                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | resolves the current directory to its index.ts; resolves the parent directory to its index.ts (exact)                                                                                           | CAUGHT as predicted (2 failed \| 3595 passed (3597)). |
| M2.5  | `core-import-graph.ts`: ``: [`${path}.ts`, posix.join(path, 'index.ts')];`` → ``: [`${path}.ts`];``                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | resolves a directory specifier to its index.ts; resolves the current directory to its index.ts; resolves the parent directory to its index.ts                                                   | CAUGHT as predicted (3 failed \| 3594 passed (3597)). |
| M2.6  | `core-import-graph.ts`: ``: [`${path}.ts`, posix.join(path, 'index.ts')];`` → `: [posix.join(path, 'index.ts')];`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | resolves a sibling specifier to its .ts module; refuses no import it cannot place in the graph                                                                                                  | CAUGHT as predicted (6 failed \| 3591 passed (3597)). |
| M2.7  | `core-import-graph.ts`: `for (const { specifier, value } of scan.imports) {` → `for (const { specifier, value } of scan.imports.filter((i) => i.value)) {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | refuses a type-only specifier naming no module, too (exact)                                                                                                                                     | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.8  | `core-import-graph.ts`: `} else if (value) {` → `} else {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | counts a type-only declaration but draws no edge; finds no cycle through a type-only import; holds no value-import cycle                                                                        | CAUGHT as predicted (3 failed \| 3594 passed (3597)). |
| M2.9  | `core-import-graph.ts`: ``const targets = new Set<string>();⏎    for (const { specifier, value } of scan.imports) {⏎      const resolved = resolve(file, specifier, known);⏎      if ('problem' in resolved) {⏎        refused.push(`${file}: ${resolved.problem}`);⏎      } else if (value) {⏎        targets.add(resolved.module);`` → ``const targets: string[] = [];⏎    for (const { specifier, value } of scan.imports) {⏎      const resolved = resolve(file, specifier, known);⏎      if ('problem' in resolved) {⏎        refused.push(`${file}: ${resolved.problem}`);⏎      } else if (value) {⏎        targets.push(resolved.module);`` | lists an edge once, however many declarations name the module                                                                                                                                   | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.10 | `core-import-graph.ts`: `declarations += scan.imports.length;` → `declarations += scan.imports.filter((i) => i.value).length;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | counts a type-only declaration but draws no edge; judges every relative import and export declaration (exact)                                                                                   | CAUGHT as predicted (2 failed \| 3595 passed (3597)). |
| M2.11 | `core-import-graph.ts`: `if (raw !== scan.imports.length) {` → `if (false) {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | names a module whose raw text holds a specifier the reader did not judge (exact)                                                                                                                | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.12 | `core-import-graph.ts`: `const modules = [...sources.keys()].sort();` → `const modules = [...sources.keys()];`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | lists every module read, sorted (exact)                                                                                                                                                         | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.13 | `core-import-graph.ts`: `refused.push(...scan.refused);` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | carries the reader’s own refusals from every module (exact)                                                                                                                                     | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.14 | `core-import-graph.ts`: `next > start && !path.includes(next)` → `next !== start && !path.includes(next)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | names a two-module cycle; names a longer cycle once; names two cycles that share a module; #32’s cycles; lists the cycles in sorted order; finds the cycle when the same import carries a value | CAUGHT as predicted (6 failed \| 3591 passed (3597)). |
| M2.15 | `core-import-graph.ts`: `next > start && !path.includes(next)` → `next > start`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | names two cycles that share a module                                                                                                                                                            | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.16 | `core-import-graph.ts`: `edges.get(at) ?? []` → `edges.get(at)!`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ignores an edge to a module outside the map (exact)                                                                                                                                             | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.17 | `core-import-graph.ts`: `return found.sort();` → `return found;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | lists the cycles in sorted order (exact)                                                                                                                                                        | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.18 | `core-import-graph.ts`: `if (next === start) {` → `if (next === start && path.length > 1) {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | names a module that imports itself (exact)                                                                                                                                                      | CAUGHT as predicted (1 failed \| 3596 passed (3597)). |
| M2.19 | `core-import-graph.ts`: `found.push([...path, start].join(' -> '));` → `found.push([...path].join(' -> '));`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | names a two-module cycle; names a longer cycle once                                                                                                                                             | CAUGHT as predicted (7 failed \| 3590 passed (3597)). |

- [ ] **Step 7: Commit**

`git commit -m "test(guards): build core's value-import graph and name each cycle (Refs #92)"`

### Task 3: The guard over packages/core/src

**Files:**

- Modify: `tests/unit/core-import-graph.test.ts`

**Interfaces:**

- Consumes: `importGraph`, `cycles`, `ImportGraph`, `trackedFiles` (`tests/unit/tracked-files.ts`).
- Produces: the guard; no new export.

- [ ] **Step 1: Write the failing tests**

`tests/unit/core-import-graph.test.ts` (change):

```diff
diff --git a/tests/unit/core-import-graph.test.ts b/tests/unit/core-import-graph.test.ts
index 86d6936..a2fa46e 100644
--- a/tests/unit/core-import-graph.test.ts
+++ b/tests/unit/core-import-graph.test.ts
@@ -1,10 +1,13 @@
+import { readFileSync } from 'node:fs';
 import { describe, expect, it } from 'vitest';
 import {
   cycles,
   importGraph,
+  type ImportGraph,
   rawRelativeImports,
   scanModule,
 } from './core-import-graph';
+import { trackedFiles } from './tracked-files';

 /**
  * packages/core/src keeps an acyclic graph of value imports (#92).
@@ -426,3 +429,52 @@ describe('cycles names each value-import cycle once', () => {
     expect(cycles(graph.edges)).toEqual(['a.ts -> b.ts -> a.ts']);
   });
 });
+
+describe('packages/core/src holds no value-import cycle', () => {
+  // Read inside each test, not in the describe body: a throw at collection
+  // time fails the file as "no tests" instead of naming the broken assertion.
+  const ROOT = 'packages/core/src/';
+  const corePaths = () =>
+    trackedFiles().filter((path) => path.startsWith(ROOT));
+  const coreGraph = () =>
+    importGraph(
+      new Map(
+        corePaths()
+          .filter((path) => path.endsWith('.ts'))
+          .map((path) => [path.slice(ROOT.length), readFileSync(path, 'utf8')]),
+      ),
+    );
+  const edgeCount = (graph: ImportGraph) =>
+    [...graph.edges.values()].reduce((n, targets) => n + targets.length, 0);
+
+  it('every file under packages/core/src is a .ts module the graph reads', () => {
+    expect(corePaths().filter((path) => !path.endsWith('.ts'))).toEqual([]);
+  });
+
+  it('reads every module (liveness)', () => {
+    // Measured 20 modules on develop d4b1f94's tree (#92). Lower it only in the commit that removes one.
+    expect(coreGraph().modules.length).toBeGreaterThan(19);
+  });
+
+  it('judges every relative import and export declaration (liveness)', () => {
+    // Measured 97 declarations on develop d4b1f94's tree (#92), type-only ones included.
+    expect(coreGraph().declarations).toBeGreaterThan(96);
+  });
+
+  it('draws an edge for every module a value is imported from (liveness)', () => {
+    // Measured 77 edges on develop d4b1f94's tree (#92): the population the cycle check judges.
+    expect(edgeCount(coreGraph())).toBeGreaterThan(76);
+  });
+
+  it('reads each module’s relative imports as its raw text counts them', () => {
+    expect(coreGraph().unread).toEqual([]);
+  });
+
+  it('refuses no import it cannot place in the graph', () => {
+    expect(coreGraph().refused).toEqual([]);
+  });
+
+  it('holds no value-import cycle', () => {
+    expect(cycles(coreGraph().edges)).toEqual([]);
+  });
+});
```

- [ ] **Step 2: Write stubs**

The Task 2 stub again (byte-identical), replacing `core-import-graph.ts` for the red run only.

- [ ] **Step 3: Run the tests and see them fail**

Run: `npx vitest run tests/unit/core-import-graph.test.ts`

Expected: `Tests  33 failed | 53 passed (86)`. Six of the seven new tests meet `not implemented`, with Task 2's 27. "every file under packages/core/src is a .ts module the graph reads" passes by design: it reads the tracked paths and calls no stubbed function, so M3.8 (the walk widened to `packages/core/`) is what proves it can fail.

- [ ] **Step 4: Implement**

Nothing: the guard is the tests, over the implementation Task 2 committed. Restore `core-import-graph.ts` from the commit and the seven new tests pass.

- [ ] **Step 5: Run the gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`

Expected: every step passes; unit `Tests  3597 passed (3597)`.

- [ ] **Step 6: Mutation-verify**

M3.1 to M3.4, M3.9 and M3.12 change a file in `packages/core/src`; the rest change the guard or its helpers.

| ID    | Change                                                                                                                                                                 | Predicted red                                                                                                                                                                                                                                                                                                                                                                                                  | Result                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| M3.1  | `grammar.ts`: `import type { GameState } from './state';` → `import type { GameState } from './state';⏎import { reanchor } from './sim';`                              | holds no value-import cycle                                                                                                                                                                                                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M3.2  | `grammar.ts`: `import type { GameState } from './state';` → `import type { GameState } from './state';⏎import {⏎  reanchor,⏎} from './sim';`                           | holds no value-import cycle                                                                                                                                                                                                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M3.3  | `grammar.ts`: `import type { GameState } from './state';` → `import type { GameState } from './state';⏎export { reanchor } from './sim';`                              | holds no value-import cycle                                                                                                                                                                                                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M3.4  | `grammar.ts`: `import type { GameState } from './state';` → `import type { GameState } from './state';⏎import { reanchor } from '.';`                                  | holds no value-import cycle                                                                                                                                                                                                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M3.5  | `core-import-graph.ts`: `if (isRelative(specifier)) {` → `if (isRelative(specifier) && !node.getText(sf).includes('\n')) {`                                            | a multi-line named import; a multi-line re-export; passes a module whose every relative specifier was judged; judges every relative import and export declaration; reads each module’s relative imports as its raw text counts them                                                                                                                                                                            | CAUGHT as predicted (6 failed \| 3591 passed (3597)).  |
| M3.6  | `core-import-graph.test.ts`: `.filter((path) => path.endsWith('.ts'))` → ``.filter((path) => path.endsWith('.ts') && path !== `${ROOT}sim.ts`)``                       | reads every module (liveness); judges every relative import and export declaration; draws an edge for every module a value is imported from; refuses no import it cannot place in the graph (exact)                                                                                                                                                                                                            | CAUGHT as predicted (4 failed \| 3593 passed (3597)).  |
| M3.7  | `core-import-graph.ts`: `imports.push({ specifier, value: carriesValue(node) });` → `imports.push({ specifier, value: true });`                                        | import type with names; import type with a default; import type with a namespace; an import whose one specifier is a type; an import whose every specifier is a type; export type with names; a re-export whose every specifier is a type; export type star; in source order; counts a type-only declaration but draws no edge; finds no cycle through a type-only import; holds no value-import cycle (exact) | CAUGHT as predicted (12 failed \| 3585 passed (3597)). |
| M3.8  | `core-import-graph.test.ts`: `const ROOT = 'packages/core/src/';` → `const ROOT = 'packages/core/';`                                                                   | every file under packages/core/src is a .ts module the graph reads                                                                                                                                                                                                                                                                                                                                             | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M3.9  | `sim.ts`: `import type { CourseData, Encounter } from './course';` → (deleted)                                                                                         | judges every relative import and export declaration (exact)                                                                                                                                                                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M3.10 | `core-import-graph.ts`: `edges.set(file, [...targets]);` → `edges.set(file, file === 'sim.ts' ? [...targets].slice(1) : [...targets]);`                                | draws an edge for every module a value is imported from (exact)                                                                                                                                                                                                                                                                                                                                                | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M3.11 | `core-import-graph.test.ts`: `.filter((path) => path.endsWith('.ts'))` → ``.filter((path) => path.endsWith('.ts') && path !== `${ROOT}index.ts`)``                     | reads every module (liveness); judges every relative import and export declaration; draws an edge for every module a value is imported from (exact)                                                                                                                                                                                                                                                            | CAUGHT as predicted (3 failed \| 3594 passed (3597)).  |
| M3.12 | `grammar.ts`: `import type { GameState } from './state';` → `import type { GameState } from './state';⏎export const later = () => import('./sim');`                    | refuses no import it cannot place in the graph (exact)                                                                                                                                                                                                                                                                                                                                                         | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |
| M3.13 | `core-import-graph.test.ts`: `    expect(coreGraph().refused).toEqual([]);` → `    for (const refusal of coreGraph().refused) {⏎      expect(refusal).toBe('');⏎    }` | loops no known population inside a test beyond the burn-down list (exact)                                                                                                                                                                                                                                                                                                                                      | CAUGHT as predicted (1 failed \| 3596 passed (3597)).  |

- [ ] **Step 7: Commit**

`git commit -m "test(guards): packages/core/src holds no value-import cycle (Refs #92)"`
