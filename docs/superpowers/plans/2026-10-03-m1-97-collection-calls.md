# M1 #97: No Workspace Code At Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A unit guard that reads every tracked test file and refuses, by file, scope and line, any call that Vitest evaluates while it collects the file (or in a `beforeAll`) and that can reach workspace code, so a core change that throws fails the tests that reach it by name and never drops a file from the count. The 12 sites found on the day are converted.

**Architecture:** One helper module, `tests/unit/collection-calls.ts`, beside the repo's other guard helpers. `scanCollection` parses one file with the TypeScript compiler API and walks the code that runs at collection: module scope, describe callbacks, `beforeAll` hooks, and the arguments of a registration (titles, `.each` tables, `.skipIf` conditions). It judges each call there by its root name, resolved through the file's scopes. An import of a relative path or an `@wordfarer/` package is refused, apart from the clock brands. A function declared in the file is followed into its body. Runtime globals, third-party packages and methods on local data are allowed. What it cannot follow is refused by name. It returns the describe callbacks read, the calls judged, the refusals and the unclassified forms. The guard in `collection-calls.test.ts` runs it over every tracked `*.test.ts` and `*.spec.ts`, with each population as its own assertion, a raw-text cross-check and a burn-down list that can only shrink. The burn-down difference moves to `tests/unit/burn-down.ts`, shared with the one-test-per-case guard.

**Tech Stack:** Node 24, npm workspaces, TypeScript 6.0 (the compiler API, already a dev dependency), Vitest 4.1. No new dependency.

**Spec:** Story #97. No spec changes: the rule is a test-suite rule, recorded on the story (comment of 2026-10-03, "Scope as built").

## Global Constraints

- Node `>=24`; npm workspaces. No new dependency.
- Zero warnings: lint `--max-warnings 0`, typecheck, Prettier, `npm ci` and `npm run build` (design spec §12).
- The guard reads git-tracked files (`trackedFiles`), as `one-test-per-case.test.ts` does, so it judges what CI judges and never an untracked scratch file.
- Every guard proves it saw what it judges, counted at the level it judges (#82). Files read, describe callbacks read and calls judged are separate assertions, each with a floor of the measured figure minus one. The raw count of describe calls is the independent cross-check. Anything the reader cannot follow is refused by name.
- One test per case: a population known before the run is generated as one test each; no loop inside a test body (#58). That guard's `BURN_DOWN` stays empty.
- Tests are written first and seen red, each failing on its own assertion. Every guard is mutation-verified, and each mutation's predicted failures are written before it runs.
- Commit messages and PR bodies say `Refs #97`; never put close/fix/resolve next to an issue number. Commits are authored as Shyden.

## Review Focus

1. **`beforeAll` measured, not assumed.** A throwaway file with a throwing `beforeAll` reported `Tests 2 failed | 2 skipped (4)`: its two tests were skipped. The two failures came from the `beforeEach` suite beside it. A setup in `beforeAll` therefore drops its tests from the failed count just as collection does. The guard judges `beforeAll` bodies, and conversions compute inside the test or in a `beforeEach` (M1.1).
2. **Wider than AC1's text, the same defect.** Module scope is collected like a describe body (`pemandu-perf.test.ts`'s `syntheticCourse(1)`). `.each` tables, titles and `skipIf` conditions are evaluated at collection (all three of `grammar.test.ts`'s sites were in an `it.each` table, which a walk of describe bodies alone missed). And every tracked test file is read, not only `packages/*/test`, since the rule is no different under `tests/` and `apps/`. Recorded on #97 before the PR.
3. **Reach, not a name list.** A call is refused because its root name resolves to workspace code, directly or through a function declared in the file. That keeps fixture rows such as `lockdown.test.ts`'s `basic(...)` and `pemandu-tick.test.ts`'s `shopWith(...)` legal, because they reach no workspace code, and refuses `stateAt(...)`, which calls `initialState`. The allowlist categories are named and justified in the module's doc comment.
4. **Two false positives found on the real tree, each now a test.** `String(MAX_TIMEOUT_MINUTES)` passes a workspace constant to a call that runs no function, and `createServer(handler)` runs its handler per request, during tests. A function passed by name is judged as called, and an inline one walked as running now, only when the callee is a builtin that runs it (`map`, `filter`, `Array.from`, …), except a fast-check arbitrary's (M1.6, M1.47, M1.57, M1.75).
5. **Fail-closed, three ways.** A callee with no root name (`(a ? f : g)(x)`, an IIFE), a direct call of a value (a parameter, a loop or catch variable, a call's result, a local class), and a describe form or `beforeAll` the reader cannot read are each refused by name, never skipped (M1.3, M1.52, M1.56, M1.62, M1.65).
6. **Each floor is tight.** 44 files, 153 describe callbacks, 270 calls judged and 43 files with a raw describe call, measured at the branch head. One file has none: `tests/engines/golden-vectors.spec.ts` uses only `test.beforeAll`. The judged floor moves down in each conversion, which moves calls out of collection. Each population goes red when blinded (M2.1 to M2.5).
7. **The conversions keep each test's meaning.** Tables carry data or getters instead of computed states. Thunks and getters are called inside the test. `pemandu-perf.test.ts`'s course getters memoise, so every test still reads the same course object the bucket memo is keyed by: the 72 h return still buys 1,683 units. One throwing-setup mutation per converted file fails tests by name with the total unchanged (M3.1, M4.1, M5.1, M6.1).

## Decisions this plan makes

- **Home:** `tests/unit/collection-calls.test.ts`, with its helper in `collection-calls.ts`, as `one-test-per-case.ts` and `core-import-graph.ts` are. `minus` moves to `tests/unit/burn-down.ts`, so the two burn-down lists share one difference.
- **Workspace code** is what a relative or `@wordfarer/` import names. A test module imported relatively (`./fsrs-reference`) counts too, since it may import core.
- **Allowed, by category:** runtime globals; third-party packages (pinned by the lockfile, never mutated); the clock brands `simMs`/`wallMs` from a clock module (each one integer check); a function declared in the file that reaches nothing refused; a method on local data. A value a third-party call returned (`Decimal.clone(…)`) is third-party code.
- **Refusal format:** `file :: scope :: call -> reaches`, where `reaches` names the path to workspace code (`stateAt -> initialState (../src/state)`).

## Acceptance criteria → tasks (#97)

| AC  | What                                                                                                                                                                                                                                                                                                                  | Task          | Proved by                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | a meta-guard in `tests/unit/` reads every tracked test file with the TypeScript compiler API and refuses, by file and line, any call evaluated at collection that can reach workspace code, outside tests, hooks other than `beforeAll`, and nested function bodies, with each allowlist category named and justified | 1, 2          | `collection-calls.test.ts` "the detector refuses a call that reaches workspace code", "the detector allows", "the suite"; M1.1 to M1.75, M2.7 |
| 2   | the verdict carries its population at the judged level: describe callbacks read and calls judged, each a separate assertion with a floor of the measured figure minus one and a comment naming the measurement                                                                                                        | 2             | `collection-calls.test.ts` "the detector counts what it read", "the suite"; M1.53, M1.72, M2.2, M2.3                                          |
| 3   | an independent cross-check: every file whose raw text holds a describe call is read as holding at least one describe callback                                                                                                                                                                                         | 2             | `collection-calls.test.ts` "the suite"; M2.4, M2.5                                                                                            |
| 4   | fail-closed reading: a describe whose callback the reader cannot classify, and any call it cannot follow, is refused by name, never skipped                                                                                                                                                                           | 1, 2          | `collection-calls.test.ts` "the detector refuses what it cannot read, by name", "the suite"; M1.3, M1.52, M1.56, M1.62, M1.65, M2.8           |
| 5   | planted positives red: a call in a describe body, in a nested describe, written over several lines, as `const x = f()` and as a bare expression statement; a call inside `it`, `beforeEach` and a helper function stays green                                                                                         | 1             | `collection-calls.test.ts` "the detector refuses a call that reaches workspace code", "the detector allows"; M1.44, M1.51                     |
| 6   | a `BURN_DOWN` list of today's sites that can only shrink; each site converted (computed inside the test or a hook), the test count unchanged, one mutation per converted file showing a throwing setup now fails tests by name                                                                                        | 2, 3, 4, 5, 6 | `collection-calls.test.ts` "the suite"; M2.6, M3.1, M4.1, M5.1, M6.1                                                                          |
| 7   | the one-test-per-case meta-guard passes over the new files                                                                                                                                                                                                                                                            | 1, 2          | `one-test-per-case.test.ts` "the suite"; M2.9                                                                                                 |

## How this plan was reviewed

| Pass | Date       | Checks run                                                                                                                                                                                                                                                                                                                                                                                                             | Found                                                                                                                                                                                                                                                                                                        | Fixed                                                                                                                                                                                                                                                                               |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 2026-10-03 | Mechanical: `verify_blocks.py` (16 generated code blocks equal their stage or stub byte for byte), `check_names.py` (every AC-table name and mutation id exists, with a real and a fake name as controls), no placeholders. Executed: each stage gated alone on a clean `npm ci` (T1 3,782 unit, T2 to T6 3,793), the six red runs as Step 3 states them, all 87 mutations at the head. Then a full read of the prose. | 4: (1) Review Focus 4 called the `createServer` false positive pinned, but no mutation made a non-runner's callback walk, so that test had never gone red; (2) the conversion red texts ended in an unclear clause; (3) Finishing pushed before committing the plan; (4) "one file has none" was unverified. | (1) M1.75 drops `runsCallbacks` from `runsNow`: caught as predicted, the server-handler test and the real tree's verify-dev handler red; (2) reworded; (3) reordered; (4) verified: `tests/engines/golden-vectors.spec.ts` is the only tracked test file with no raw describe call. |
| 2    | 2026-10-03 | Mechanical checks re-run on the rebuilt plan (16 blocks equal, names and ids present, no placeholders); the mutation tables read row by row in the formatted plan: 88 rows, all caught as predicted, M1.75 present, notes on their rows. A read of every section changed in pass 1.                                                                                                                                    | 1: the 13 notes began in lower case right after a full stop.                                                                                                                                                                                                                                                 | Capitalised in `mutations.py`; the tables regenerated.                                                                                                                                                                                                                              |
| 3    | 2026-10-03 | Mechanical checks re-run on the rebuilt plan (16 blocks equal, names and ids present, no placeholders); the review log read as rendered; a diff of the plan against pass 2's build (only the capitalised notes and pass 2's row changed).                                                                                                                                                                              | 0                                                                                                                                                                                                                                                                                                            | Nothing to fix: the review ends here and the plan is approved.                                                                                                                                                                                                                      |

---

### Task 1: A detector for calls that reach workspace code at collection

**Files:**

- Create: `tests/unit/collection-calls.ts`, `tests/unit/collection-calls.test.ts`

**Interfaces:**

- Consumes: the TypeScript compiler API (`typescript`).
- Produces: `scanCollection(source, fileName) → CollectionScan` (`describes`: describe callbacks read; `judged`: calls evaluated at collection or in a `beforeAll`; `refused`: `RefusedCall[]` of `{ scope, line, call, reaches }`; `unclassified`: each form it cannot follow, by line).

- [ ] **Step 1: Write the failing tests**

`tests/unit/collection-calls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  scanCollection,
  type CollectionScan,
  type RefusedCall,
} from './collection-calls';

/**
 * No workspace code at collection (Refs #97).
 *
 * Vitest runs a file's module scope and every `describe` callback while it
 * COLLECTS the file, before any test exists. When code evaluated there
 * throws, the whole file fails to collect and its tests vanish from the
 * total instead of failing one by one: #33's mutation M1.1 dropped six tests
 * that way, and its T4 red run lost all of `grammar.test.ts`. A setup computed
 * inside a test or a hook fails that test, by name.
 *
 * The question asked is whether a call evaluated at collection can REACH
 * workspace code. Workspace code enters a test file only through an import of
 * a relative path or an `@wordfarer/` package, so the detector resolves each
 * call's root name: such an import is refused, apart from the clock brands
 * `simMs` and `wallMs`; a function declared in the file is followed into its
 * body; a runtime global, a third-party package and a method on local data
 * are allowed. Each fixture below imports `integrate` and `simMs` on line 1.
 */
const IMPORTS =
  "import { integrate } from '../src/sim'; import { simMs } from '../src/clock';\n";

const read = (body: string): CollectionScan =>
  scanCollection(IMPORTS + body, 'fixture.test.ts');
const refused = (body: string): readonly RefusedCall[] => read(body).refused;

describe('the detector refuses a call that reaches workspace code', () => {
  it('in a describe body, with its scope, line, call and the import it reaches', () => {
    expect(
      refused(`describe('d', () => {
  const s = integrate(1);
  it('t', () => expect(s).toBe(1));
});`),
    ).toEqual([
      {
        scope: 'd',
        line: 3,
        call: 'integrate',
        reaches: 'integrate (../src/sim)',
      },
    ]);
  });

  const PLACES: readonly (readonly [string, string, string, number])[] = [
    [
      'in a nested describe',
      `describe('outer', () => {
  describe('inner', () => {
    const s = integrate(1);
  });
});`,
      'outer > inner',
      4,
    ],
    [
      'written over several lines',
      `describe('d', () => {
  const s =
    integrate(
      1,
    );
});`,
      'd',
      4,
    ],
    [
      'as a bare expression statement',
      `describe('d', () => {
  integrate(1);
});`,
      'd',
      3,
    ],
    ['at module scope', `const s = integrate(1);`, '(module)', 2],
    [
      'in an it.each table',
      `describe('d', () => {
  it.each([[integrate(1)]])('t %s', (s) => expect(s).toBe(1));
});`,
      'd',
      3,
    ],
    [
      'in a describe.each table',
      `describe.each([[integrate(1)]])('d %s', (s) => {});`,
      '(module)',
      2,
    ],
    [
      'in a test title',
      "describe('d', () => {\n  it(`t ${integrate(1)}`, () => {});\n});",
      'd',
      3,
    ],
    [
      'in a loop that generates one test per case',
      `describe('d', () => {
  for (const n of [1, 2]) {
    const s = integrate(n);
    it(\`t \${String(n)}\`, () => expect(s).toBe(1));
  }
});`,
      'd',
      4,
    ],
    [
      'inside a callback a call runs at collection',
      `describe('d', () => {
  const xs = [1, 2].map((n) => integrate(n));
});`,
      'd',
      3,
    ],
    [
      'in a Playwright test.describe body',
      `test.describe('d', () => {
  const s = integrate(1);
});`,
      'd',
      3,
    ],
    [
      'in a beforeAll hook, whose throw skips its tests instead of failing them',
      `describe('d', () => {
  beforeAll(() => {
    integrate(1);
  });
});`,
      'd > beforeAll',
      4,
    ],
    [
      'in a Playwright test.beforeAll hook',
      `test.beforeAll(async () => {
  await integrate(1);
});`,
      'beforeAll',
      3,
    ],
    [
      "in a tagged template's substitution",
      'const s = String.raw`x${integrate(1)}`;',
      '(module)',
      2,
    ],
    [
      'in a describe titled by a template',
      'describe(`d ${String(1)}`, () => {\n  integrate(1);\n});',
      'd ${String(1)}',
      3,
    ],
    [
      'in a describe.skipIf condition',
      `describe.skipIf(integrate(1))('d', () => {});`,
      '(module)',
      2,
    ],
  ];
  for (const [where, body, scope, line] of PLACES)
    it(where, () => {
      expect(refused(body)).toEqual([
        { scope, line, call: 'integrate', reaches: 'integrate (../src/sim)' },
      ]);
    });

  const FORMS: readonly (readonly [string, string, string, string])[] = [
    [
      'a namespace import',
      `import * as core from '../src/index';
const s = core.integrate(1);`,
      'core.integrate',
      'core (../src/index)',
    ],
    [
      'a default import',
      `import sim from '../src/sim';
const s = sim(1);`,
      'sim',
      'sim (../src/sim)',
    ],
    [
      'a renamed import',
      `import { integrate as go } from '../src/sim';
const s = go(1);`,
      'go',
      'go (../src/sim)',
    ],
    [
      'an import of the core package',
      `import { stateHash } from '@wordfarer/core';
const s = stateHash(1);`,
      'stateHash',
      'stateHash (@wordfarer/core)',
    ],
    [
      'a constructor from workspace code',
      `import { Ledger } from '../src/ledger';
const s = new Ledger();`,
      'Ledger',
      'Ledger (../src/ledger)',
    ],
    [
      'a method on a value from workspace code',
      `import { COURSE } from '../src/course';
const s = COURSE.regions.map((r) => r);`,
      'COURSE.regions.map',
      'COURSE (../src/course)',
    ],
    [
      'a workspace function passed to a call that may run it',
      `const s = [1, 2].map(integrate);`,
      '[1, 2].map',
      'integrate (../src/sim)',
    ],
    [
      'a local function that calls workspace code',
      `function stateAt(n: number) {
  return integrate(n);
}
const s = stateAt(1);`,
      'stateAt',
      'stateAt -> integrate (../src/sim)',
    ],
    [
      'a local arrow function that calls workspace code',
      `const stateAt = (n: number) => integrate(n);
const s = stateAt(1);`,
      'stateAt',
      'stateAt -> integrate (../src/sim)',
    ],
    [
      'a local function that reaches it through another',
      `function inner() {
  return integrate(1);
}
function outer() {
  return inner();
}
const s = outer();`,
      'outer',
      'outer -> inner -> integrate (../src/sim)',
    ],
    [
      'a local function that reaches it only in a nested callback',
      `function all() {
  return [1, 2].map((n) => integrate(n));
}
const s = all();`,
      'all',
      'all -> integrate (../src/sim)',
    ],
    [
      'a local function that calls itself and workspace code',
      `function down(n: number): number {
  return n > 0 ? down(n - 1) : integrate(0);
}
const s = down(3);`,
      'down',
      'down -> integrate (../src/sim)',
    ],
    [
      'two local functions that call each other, one reaching it',
      `function a(n: number): number {
  return n === 0 ? 0 : b(n - 1);
}
function b(n: number): number {
  return a(n) + integrate(n);
}
const s = a(3);`,
      'a',
      'a -> b -> integrate (../src/sim)',
    ],
    [
      'a local function passed to a call that may run it',
      `function stateAt(n: number) {
  return integrate(n);
}
const s = [1, 2].map(stateAt);`,
      '[1, 2].map',
      'stateAt -> integrate (../src/sim)',
    ],
    [
      'a clock brand through a local function that also calls workspace code',
      `function t(n: number) {
  return integrate(simMs(n));
}
const s = t(1);`,
      't',
      't -> integrate (../src/sim)',
    ],
    [
      'a clock brand name imported from a module that is not the clock',
      `import { wallMs } from '../src/sim';
const t = wallMs(1);`,
      'wallMs',
      'wallMs (../src/sim)',
    ],
    [
      'a function from the clock module that is not a brand',
      `import { reanchor } from '../src/clock';
const s = reanchor(1);`,
      'reanchor',
      'reanchor (../src/clock)',
    ],
    [
      'a workspace function cast with as',
      `const s = (integrate as (n: number) => number)(1);`,
      '(integrate as (n: number) => number)',
      'integrate (../src/sim)',
    ],
    [
      'a workspace function asserted non-null',
      `const s = integrate!(1);`,
      'integrate!',
      'integrate (../src/sim)',
    ],
    [
      'a workspace function checked with satisfies',
      `const s = (integrate satisfies unknown as typeof integrate)(1);`,
      '(integrate satisfies unknown as typeof integrate)',
      'integrate (../src/sim)',
    ],
    [
      'an element read on a workspace namespace',
      `import * as core from '../src/index';
const s = core['integrate'](1);`,
      "core['integrate']",
      'core (../src/index)',
    ],
    [
      'a callee written over several lines',
      `import * as core from '../src/index';
const s = core
  .integrate(1);`,
      'core .integrate',
      'core (../src/index)',
    ],
    [
      'an alias of a workspace function',
      `const go = integrate;
const s = go(1);`,
      'go',
      'integrate (../src/sim)',
    ],
    [
      'an alias of a local function that calls workspace code',
      `function stateAt(n: number) {
  return integrate(n);
}
const f = stateAt;
const s = f(1);`,
      'f',
      'stateAt -> integrate (../src/sim)',
    ],
    [
      'a name destructured from a workspace namespace',
      `import * as core from '../src/index';
const { integrate: go } = core;
const s = go(1);`,
      'go',
      'core (../src/index)',
    ],
    [
      'a method on a literal, passed a workspace function',
      `const s = [1].slice(0).map(integrate);`,
      '[1].slice(0).map',
      'integrate (../src/sim)',
    ],
    [
      'a shared suite function whose describe body calls workspace code',
      `function suite(n: number) {
  describe('s', () => {
    const x = integrate(n);
  });
}
suite(1);`,
      'suite',
      'suite -> integrate (../src/sim)',
    ],
  ];
  for (const [form, body, call, reaches] of FORMS)
    it(`through ${form}`, () => {
      expect(refused(body).map((r) => [r.call, r.reaches])).toEqual([
        [call, reaches],
      ]);
    });
});

describe('the detector allows', () => {
  const ALLOWED: readonly (readonly [string, string, number])[] = [
    [
      'a call inside a test',
      `describe('d', () => {
  it('t', () => expect(integrate(1)).toBe(1));
});`,
      0,
    ],
    [
      'a call inside a hook',
      `describe('d', () => {
  let s = 0;
  beforeEach(() => {
    s = integrate(1);
  });
  it('t', () => expect(s).toBe(1));
});`,
      0,
    ],
    [
      'a call inside a helper function the describe body only declares',
      `describe('d', () => {
  const make = () => integrate(1);
  function again() {
    return integrate(2);
  }
  it('t', () => expect(make()).toBe(again()));
});`,
      0,
    ],
    [
      'a call inside a test of a describe.each',
      `describe.each([[1]])('d %s', (n) => {
  it('t', () => expect(integrate(n)).toBe(1));
});`,
      0,
    ],
    ['a clock brand', `const t = simMs(1);`, 1],
    [
      'a clock brand imported from the core package',
      `import { wallMs } from '@wordfarer/core';
const t = wallMs(1);`,
      1,
    ],
    [
      'a clock brand imported under another name',
      `import { simMs as at } from '../src/clock';
const t = at(1);`,
      1,
    ],
    [
      'a third-party package',
      `import fc from 'fast-check';
const n = fc.integer({ min: 0 }).map((x) => x + 1);`,
      2,
    ],
    [
      'a fast-check arbitrary whose callback calls workspace code, which runs inside the property',
      `import fc from 'fast-check';
const s = fc.integer().map((x) => integrate(x));`,
      2,
    ],
    [
      'a function passed to a call that runs it later, such as a server handler',
      `import { createServer } from 'node:http';
const server = createServer(() => integrate(1));`,
      1,
    ],
    [
      'a runtime global',
      `const t = String(Object.keys({ a: 1 }).length) + btoa('x');`,
      3,
    ],
    [
      'a method on local data',
      `const IDS = ['a', 'b'];
const ks = IDS.slice(1).map((id) => id.toUpperCase());`,
      3,
    ],
    [
      'a value a third-party call returned',
      `import Decimal from 'decimal.js';
const D = Decimal.clone({ precision: 20 });
const x = new D('1.15');`,
      2,
    ],
    [
      'a method on a string, a template, a number, an array or an object literal',
      "const t = 'ab'.repeat(2) + `x${String(1)}`.trim() + (1).toFixed(0) + [1].join('') + ({}).toString();",
      6,
    ],
    [
      'a local fixture that calls only allowed code',
      `function region(r: number) {
  return { id: String(r), words: Array.from({ length: 3 }, (_, i) => i) };
}
const R = region(1);`,
      1,
    ],
    [
      'a local fixture passed to a call',
      `function region(r: number) {
  return { id: String(r) };
}
const RS = [1, 2].map(region);`,
      1,
    ],
    [
      'a name a describe body declares, shadowing an import',
      `describe('d', () => {
  const integrate = (n: number) => n;
  const s = integrate(1);
});`,
      1,
    ],
    [
      'a type-only import, which binds no value, so the global keeps its name',
      `import type { String } from '../src/strings';
const t = String(1);`,
      1,
    ],
    [
      'a type-only import specifier, which binds no value either',
      `import { type String } from '../src/strings';
const t = String(1);`,
      1,
    ],
    [
      'a workspace value passed to a call that runs no function argument',
      `import { LIMIT } from '../src/limits';
const t = String(LIMIT);`,
      1,
    ],
    [
      'a workspace value read but not called',
      `import { START } from '../src/clock';
const t = START;`,
      0,
    ],
  ];
  for (const [what, body, judged] of ALLOWED)
    it(what, () => {
      const scan = read(body);
      expect(scan.judged, 'the calls evaluated at collection were read').toBe(
        judged,
      );
      expect(scan.refused).toEqual([]);
      expect(scan.unclassified).toEqual([]);
    });
});

describe('the detector counts what it read', () => {
  it('counts each describe callback, nested ones included', () => {
    expect(
      read(`describe('a', () => {
  describe('b', () => {});
  describe.each([[1]])('c %s', () => {});
});
describe.skip('d', function () {});`).describes,
    ).toBe(4);
  });

  it('counts the calls evaluated at collection, refused or allowed', () => {
    expect(
      read(`const a = String(1);
describe('d', () => {
  const b = integrate(1);
  it('t', () => expect(integrate(2)).toBe(String(3)));
});`).judged,
    ).toBe(2);
  });

  it('reads test.describe.configure as no callback, refusing nothing', () => {
    const scan = read(`test.describe.configure({ mode: 'serial' });`);
    expect(scan.describes).toBe(0);
    expect(scan.unclassified).toEqual([]);
  });

  it('reads describe.todo as no callback, refusing nothing', () => {
    const scan = read(`describe.todo('later');`);
    expect(scan.describes).toBe(0);
    expect(scan.unclassified).toEqual([]);
  });
});

describe('the detector refuses what it cannot read, by name', () => {
  it('a describe whose callback is not written inline', () => {
    expect(
      read(`const body = () => {};
describe('named', body);`).unclassified,
    ).toEqual(["line 3: describe('named') has no inline callback to read"]);
  });

  it('a beforeAll whose callback is not written inline', () => {
    expect(
      read(`const setup = () => {};
beforeAll(setup);`).unclassified,
    ).toEqual(['line 3: beforeAll has no inline callback to read']);
  });

  it('a member of describe it does not know', () => {
    expect(read(`describe.sometimes('d', () => {});`).unclassified).toEqual([
      'line 2: describe.sometimes is not a known describe form',
    ]);
  });

  it('a member of test.describe it does not know', () => {
    expect(
      read(`test.describe.sometimes('d', () => {});`).unclassified,
    ).toEqual(['line 2: test.describe.sometimes is not a known describe form']);
  });

  it('a direct call of a value, which may be any function', () => {
    expect(
      read(`describe.each([[(n: number) => n]])('d', (f) => {
  const s = f(1);
});`).unclassified,
    ).toEqual([
      'line 3: f(1) calls a value, not a function the reader can follow',
    ]);
  });

  it('a direct call of a value a workspace call returned', () => {
    expect(
      read(`import { make } from '../src/make';
const f = make();
const s = f(1);`).unclassified,
    ).toEqual([
      'line 4: f(1) calls a value, not a function the reader can follow',
    ]);
  });

  const VALUES: readonly (readonly [string, string, string])[] = [
    [
      'a loop variable',
      `for (const f of [String]) {
  const s = f(1);
}`,
      'line 3: f(1) calls a value, not a function the reader can follow',
    ],
    [
      'a caught value',
      `try {
  String(1);
} catch (f) {
  f();
}`,
      'line 5: f() calls a value, not a function the reader can follow',
    ],
    [
      'a name in a cycle of aliases',
      `const a = b;
const b = a;
const s = a(1);`,
      'line 4: a(1) calls a value, not a function the reader can follow',
    ],
    [
      'a class declared in the file, which the reader does not follow',
      `class Ledger {}
const l = new Ledger();`,
      'line 3: new Ledger() calls a value, not a function the reader can follow',
    ],
  ];
  for (const [what, body, refusal] of VALUES)
    it(`a direct call of ${what}`, () => {
      expect(read(body).unclassified).toEqual([refusal]);
    });

  it('a call inside a local function that the reader cannot follow, through the call that runs it', () => {
    expect(
      read(`function f() {
  return (Math.random() > 1 ? integrate : String)(1);
}
const s = f();`).unclassified,
    ).toEqual([
      'line 5: f -> (Math.random() > 1 ? integrate : String)(1) has no root name to resolve',
    ]);
  });

  it('a describe with no arguments, by its empty title', () => {
    expect(read(`describe();`).unclassified).toEqual([
      "line 2: describe('') has no inline callback to read",
    ]);
  });

  it('a describe form it does not know, inside a function collection runs', () => {
    expect(
      read(`function suite() {
  describe.sometimes('s', () => {});
}
suite();`).unclassified,
    ).toEqual([
      'line 5: suite -> describe.sometimes is not a known describe form',
    ]);
  });

  it('a call whose callee has no name to resolve', () => {
    expect(
      read(`const s = (Math.random() > 1 ? integrate : String)(1);`)
        .unclassified,
    ).toEqual([
      'line 2: (Math.random() > 1 ? integrate : String)(1) has no root name to resolve',
    ]);
  });
});
```

- [ ] **Step 2: Write stubs**

`tests/unit/collection-calls.ts` (stub):

```ts
/** A call evaluated at collection, or in a `beforeAll`, that can reach workspace code. */
export interface RefusedCall {
  readonly scope: string;
  readonly line: number;
  readonly call: string;
  readonly reaches: string;
}

/** What the detector read in one file. */
export interface CollectionScan {
  readonly describes: number;
  readonly judged: number;
  readonly refused: readonly RefusedCall[];
  readonly unclassified: readonly string[];
}

export function scanCollection(
  _source: string,
  _fileName: string,
): CollectionScan {
  throw new Error('not implemented');
}
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `npx vitest run tests/unit/collection-calls.test.ts`

Expected: `Tests  82 failed (82)`: every test meets `Error: not implemented` from the stub, the counting and refusing tests alike, since each calls `scanCollection`.

- [ ] **Step 4: Implement**

`tests/unit/collection-calls.ts`:

```ts
import ts from 'typescript';

/**
 * Calls a test file evaluates while Vitest COLLECTS it (Refs #97).
 *
 * Module scope and every `describe` callback run at collection, before any
 * test exists, so a throw there fails the file and its tests vanish from the
 * total. A throw in a `beforeAll` hook fails no test either: Vitest marks the
 * suite's tests skipped (measured for #97: `2 skipped`, where a throwing
 * `beforeEach` gave `2 failed`). The detector walks that code: module scope,
 * describe callbacks, `beforeAll` hooks, and the arguments of a test or hook
 * registration (titles, `.each` tables, `.skipIf` conditions). It does not
 * enter a test, another hook, or a function that is only declared. It does
 * enter a function passed to a builtin that runs it now (`xs.map(f)`,
 * `Array.from(n, f)`), except a fast-check arbitrary's, which runs inside the
 * property, that is, inside a test. A function passed to anything else (a
 * server's request handler) runs later, if at all.
 *
 * Each call there is judged by its root name, resolved through the file's
 * scopes. Workspace code enters a test file only through an import, so:
 * - an import of a relative path or an `@wordfarer/` package is REFUSED,
 *   apart from the clock brands `simMs` and `wallMs` imported from a clock
 *   module, each one integer check that calls nothing else;
 * - a function declared in the file is followed into its body, under the same
 *   rules, and refused when anything it runs is;
 * - a name with no binding in the file is a runtime global (`String`,
 *   `Object`, `btoa`), and a third-party package is pinned by the lockfile
 *   and never mutated: both are allowed;
 * - a method on local data (`IDS.slice(1)`, `[1, 2].map`) is allowed, its
 *   function arguments judged as code that runs now, and a workspace or local
 *   function passed to it by name is judged as called.
 * What the reader cannot follow is refused by name, never skipped: a callee
 * with no root name, a direct call of a value (a parameter, a call's result),
 * and a describe form it does not know.
 */

/** A call evaluated at collection, or in a `beforeAll`, that can reach workspace code. */
export interface RefusedCall {
  /** The describe titles around the call, outermost first, joined by ` > `; `(module)` outside any. */
  readonly scope: string;
  /** 1-based line of the call, for a human to open. */
  readonly line: number;
  /** The callee as written, whitespace collapsed: `stateAt`, `core.integrate`. */
  readonly call: string;
  /** The path to workspace code: `stateAt -> integrate (../src/sim)`. */
  readonly reaches: string;
}

/**
 * What the detector read in one file. The verdict carries its own population,
 * so an empty `refused` can be told from a reader that saw nothing (Refs #82).
 */
export interface CollectionScan {
  /** Describe callbacks read, nested ones included. */
  readonly describes: number;
  /** Calls evaluated at collection or in a `beforeAll`, judged, refused or allowed. Test, hook and describe registrations are not judged. */
  readonly judged: number;
  /** Every judged call that can reach workspace code. */
  readonly refused: readonly RefusedCall[];
  /** Forms the reader cannot judge, by line: refused, never skipped. */
  readonly unclassified: readonly string[];
}

const MODULE_SCOPE = '(module)';

/** The calls that register a suite, a test or a hook rather than run code now. */
const REGISTRATIONS = new Set([
  'describe',
  'it',
  'test',
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
]);

/** What Playwright registers through `test.<name>`: a suite or a hook. */
const SUITES_AND_HOOKS = new Set([
  'describe',
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
]);

/** Members of Vitest's `describe` and Playwright's `test.describe`. Any other is refused by name. */
const DESCRIBE_MEMBERS = new Set([
  'only',
  'skip',
  'todo',
  'concurrent',
  'sequential',
  'shuffle',
  'each',
  'for',
  'skipIf',
  'runIf',
  'fixme',
  'serial',
  'parallel',
  'configure',
]);

/** Describe members that declare no suite: a placeholder, or Playwright's mode setting. */
const NO_CALLBACK = new Set(['todo', 'configure']);

/**
 * Builtins that run a function passed to them (`xs.map(f)`, `Array.from(n, f)`),
 * so a function written inline is walked as code that runs now, and a
 * workspace or local function passed by name is judged as called. Any other
 * callee receives a value it does not run now (`String(LIMIT)`), or runs it
 * later (`createServer(handler)`).
 */
const CALLBACK_RUNNERS = new Set([
  'map',
  'flatMap',
  'filter',
  'forEach',
  'some',
  'every',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'reduce',
  'reduceRight',
  'sort',
  'toSorted',
  'from',
  'replace',
  'replaceAll',
  'then',
  'catch',
  'finally',
]);

/** Brands from the clock module: each is one integer check and calls nothing else. */
const CLOCK_BRANDS = new Set(['simMs', 'wallMs']);

/** Packages whose function arguments run later, inside the property, never at collection. */
const LAZY_PACKAGES = new Set(['fast-check']);

const CORE_PACKAGE = '@wordfarer/core';

type Binding =
  | {
      readonly kind: 'import';
      readonly local: string;
      readonly imported: string;
      readonly specifier: string;
    }
  | { readonly kind: 'function'; readonly name: string; readonly body: ts.Node }
  | { readonly kind: 'alias'; readonly of: ts.Identifier }
  | { readonly kind: 'result'; readonly of: ts.Identifier }
  | { readonly kind: 'data' };

/** What a judged call does: reaches workspace code, cannot be read, or neither (null). */
type Verdict = {
  readonly kind: 'reaches' | 'unread';
  readonly text: string;
} | null;

type CallLike =
  ts.CallExpression | ts.NewExpression | ts.TaggedTemplateExpression;

const isCallLike = (node: ts.Node): node is CallLike =>
  ts.isCallExpression(node) ||
  ts.isNewExpression(node) ||
  ts.isTaggedTemplateExpression(node);

const calleeOf = (call: CallLike): ts.Expression =>
  ts.isTaggedTemplateExpression(call) ? call.tag : call.expression;

const argumentsOf = (call: CallLike): readonly ts.Expression[] =>
  ts.isTaggedTemplateExpression(call) ? [] : (call.arguments ?? []);

const isFunctionValue = (
  node: ts.Node,
): node is ts.ArrowFunction | ts.FunctionExpression =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node);

const isWorkspace = (specifier: string): boolean =>
  specifier.startsWith('.') || specifier.startsWith('@wordfarer/');

const isClockBrand = (binding: Binding | undefined): boolean =>
  binding?.kind === 'import' &&
  CLOCK_BRANDS.has(binding.imported) &&
  (binding.specifier.endsWith('/clock') || binding.specifier === CORE_PACKAGE);

/** The import a binding is, when it carries workspace code; else undefined. */
const workspaceImport = (
  binding: Binding | undefined,
): Extract<Binding, { kind: 'import' }> | undefined =>
  binding?.kind === 'import' &&
  isWorkspace(binding.specifier) &&
  !isClockBrand(binding)
    ? binding
    : undefined;

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Whether a call is a method whose name says it runs a function passed to it now. */
const runsCallbacks = (call: CallLike): boolean => {
  const callee = unwrap(calleeOf(call));
  return (
    ts.isPropertyAccessExpression(callee) &&
    CALLBACK_RUNNERS.has(callee.name.text)
  );
};

/** Skip the wrappers that change no value: parentheses, `!`, `as`, `satisfies`. */
const unwrap = (node: ts.Expression): ts.Expression => {
  let at = node;
  while (
    ts.isParenthesizedExpression(at) ||
    ts.isNonNullExpression(at) ||
    ts.isAsExpression(at) ||
    ts.isSatisfiesExpression(at)
  )
    at = at.expression;
  return at;
};

/** The expression a chain of property and element reads starts from: `core` for `core.a[0].b`. */
const readRoot = (node: ts.Expression): ts.Expression => {
  let at = unwrap(node);
  while (ts.isPropertyAccessExpression(at) || ts.isElementAccessExpression(at))
    at = unwrap(at.expression);
  return at;
};

/** The name a chain starts from, read through calls too: `fc` for `fc.integer().map`. */
const originName = (node: ts.Expression): ts.Identifier | null => {
  let at = readRoot(node);
  while (isCallLike(at)) at = readRoot(calleeOf(at));
  return ts.isIdentifier(at) ? at : null;
};

/** A value written in place: a string, number, regex or template, an array or an object. */
const isLiteral = (node: ts.Node): boolean =>
  ts.isLiteralExpression(node) ||
  ts.isTemplateExpression(node) ||
  ts.isArrayLiteralExpression(node) ||
  ts.isObjectLiteralExpression(node);

const bindingNames = (name: ts.BindingName): string[] =>
  ts.isIdentifier(name)
    ? [name.text]
    : name.elements.flatMap((element) =>
        ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
      );

function importBindings(node: ts.ImportDeclaration): [string, Binding][] {
  const clause = node.importClause;
  if (
    clause === undefined ||
    clause.phaseModifier === ts.SyntaxKind.TypeKeyword ||
    !ts.isStringLiteral(node.moduleSpecifier)
  )
    return [];
  const specifier = node.moduleSpecifier.text;
  const bind = (local: string, imported: string): [string, Binding] => [
    local,
    { kind: 'import', local, imported, specifier },
  ];
  const out: [string, Binding][] = [];
  if (clause.name) out.push(bind(clause.name.text, 'default'));
  const named = clause.namedBindings;
  if (named && ts.isNamespaceImport(named))
    out.push(bind(named.name.text, '*'));
  if (named && ts.isNamedImports(named))
    for (const element of named.elements)
      if (!element.isTypeOnly)
        out.push(
          bind(element.name.text, (element.propertyName ?? element.name).text),
        );
  return out;
}

/**
 * A variable is a function when its initializer is one, an alias when it
 * reads a name (`const go = integrate`, `const { a } = core`), the result of
 * a call when it holds one (`const D = Decimal.clone(…)`), and data otherwise.
 */
function variableBindings(node: ts.VariableDeclaration): [string, Binding][] {
  const init = node.initializer;
  if (init && ts.isIdentifier(node.name) && isFunctionValue(init))
    return [
      [
        node.name.text,
        { kind: 'function', name: node.name.text, body: init.body },
      ],
    ];
  const root = init ? readRoot(init) : undefined;
  const origin = root && isCallLike(root) ? originName(root) : null;
  const binding: Binding =
    root && ts.isIdentifier(root)
      ? { kind: 'alias', of: root }
      : origin
        ? { kind: 'result', of: origin }
        : { kind: 'data' };
  return bindingNames(node.name).map((name) => [name, binding]);
}

const DATA: Binding = { kind: 'data' };

function statementBindings(
  statements: readonly ts.Statement[],
): [string, Binding][] {
  return statements.flatMap((statement): [string, Binding][] => {
    if (ts.isImportDeclaration(statement)) return importBindings(statement);
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body)
      return [
        [
          statement.name.text,
          {
            kind: 'function',
            name: statement.name.text,
            body: statement.body,
          },
        ],
      ];
    // A class is not followed into its members: constructing one is a
    // direct call of a value, refused by name.
    if (ts.isClassDeclaration(statement) && statement.name)
      return [[statement.name.text, DATA]];
    if (ts.isVariableStatement(statement))
      return statement.declarationList.declarations.flatMap(variableBindings);
    return [];
  });
}

/** The names a node declares for the code inside it, or null when it opens no scope. */
function scopeBindings(node: ts.Node): ReadonlyMap<string, Binding> | null {
  if (ts.isSourceFile(node) || ts.isBlock(node))
    return new Map(statementBindings(node.statements));
  if (ts.isFunctionLike(node))
    return new Map(
      node.parameters.flatMap((parameter) =>
        bindingNames(parameter.name).map((name): [string, Binding] => [
          name,
          DATA,
        ]),
      ),
    );
  if (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node)
  ) {
    const init = node.initializer;
    return new Map(
      init && ts.isVariableDeclarationList(init)
        ? init.declarations.flatMap((declaration) =>
            bindingNames(declaration.name).map((name): [string, Binding] => [
              name,
              DATA,
            ]),
          )
        : [],
    );
  }
  if (ts.isCatchClause(node) && node.variableDeclaration)
    return new Map(
      bindingNames(node.variableDeclaration.name).map(
        (name): [string, Binding] => [name, DATA],
      ),
    );
  return null;
}

/**
 * A test, hook or describe registration: what it registers, its members after
 * that name, the inner calls of a table form, and its form as written.
 * Playwright's `test.describe` registers a describe, and its `test.beforeAll`
 * and siblings a hook.
 */
interface Registration {
  readonly name: string;
  readonly members: readonly string[];
  readonly inner: readonly ts.CallExpression[];
  readonly form: string;
}

function registrationOf(call: CallLike): Registration | null {
  if (!ts.isCallExpression(call)) return null;
  const members: string[] = [];
  const inner: ts.CallExpression[] = [];
  let at: ts.Expression = call.expression;
  for (;;) {
    if (ts.isPropertyAccessExpression(at)) {
      members.unshift(at.name.text);
      at = at.expression;
    } else if (ts.isCallExpression(at)) {
      inner.push(at);
      at = at.expression;
    } else break;
  }
  if (!ts.isIdentifier(at) || !REGISTRATIONS.has(at.text)) return null;
  const form = [at.text, ...members].join('.');
  const [first = ''] = members;
  const onTest = at.text === 'test' || at.text === 'it';
  return onTest && SUITES_AND_HOOKS.has(first)
    ? { name: first, members: members.slice(1), inner, form }
    : { name: at.text, members, inner, form };
}

/** A title as written: a template keeps its `${…}`, so an entry naming it is stable. */
const titleOf = (sf: ts.SourceFile, call: ts.CallExpression): string => {
  const first = call.arguments[0];
  if (!first) return '';
  if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))
    return first.text;
  return first.getText(sf).replace(/^`|`$/g, '');
};

/** Where the walk reports what it meets. */
interface Sink {
  judge(call: CallLike, scope: string): void;
  unread(node: ts.Node, text: string): void;
  describe(): void;
  stopped(): boolean;
}

export function scanCollection(
  source: string,
  fileName: string,
): CollectionScan {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const lineOf = (node: ts.Node): number =>
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  /** A node's source, whitespace collapsed, so a call written over lines reads as one. */
  const textOf = (node: ts.Node): string => collapse(node.getText(sf));

  const scopes = new Map<ts.Node, ReadonlyMap<string, Binding> | null>();
  const bindingsAt = (node: ts.Node): ReadonlyMap<string, Binding> | null => {
    if (!scopes.has(node)) scopes.set(node, scopeBindings(node));
    return scopes.get(node) ?? null;
  };

  /**
   * The binding `name` has where `from` sits, undefined for a global. An alias
   * is followed. A call's result is third-party code when the call's origin is
   * a third-party import, and data otherwise.
   */
  const resolve = (
    name: string,
    from: ts.Node,
    seen: Set<ts.Node> = new Set(),
  ): Binding | undefined => {
    for (let at: ts.Node = from; ; at = at.parent) {
      const binding = bindingsAt(at)?.get(name);
      if (binding !== undefined) {
        if (binding.kind !== 'alias' && binding.kind !== 'result')
          return binding;
        if (seen.has(binding.of)) return DATA;
        seen.add(binding.of);
        const target = resolve(binding.of.text, binding.of, seen);
        if (binding.kind === 'alias') return target;
        return target?.kind === 'import' && !isWorkspace(target.specifier)
          ? target
          : DATA;
      }
      if (ts.isSourceFile(at)) return undefined;
    }
  };

  const prefixed = (name: string, verdict: Verdict): Verdict =>
    verdict && { kind: verdict.kind, text: `${name} -> ${verdict.text}` };

  const walk = (node: ts.Node, scope: string, sink: Sink): void => {
    if (sink.stopped() || ts.isFunctionLike(node)) return;
    if (isCallLike(node)) {
      walkCall(node, scope, sink);
      return;
    }
    ts.forEachChild(node, (child) => {
      walk(child, scope, sink);
    });
  };

  const walkRegistration = (
    call: ts.CallExpression,
    registration: Registration,
    scope: string,
    sink: Sink,
  ): void => {
    for (const inner of registration.inner)
      for (const argument of inner.arguments) walk(argument, scope, sink);
    for (const argument of call.arguments)
      if (!isFunctionValue(argument)) walk(argument, scope, sink);
    const inner = (title: string): string =>
      scope === MODULE_SCOPE ? title : `${scope} > ${title}`;
    if (registration.name === 'beforeAll') {
      const hook = call.arguments.find(isFunctionValue);
      if (hook) walk(hook.body, inner('beforeAll'), sink);
      else
        sink.unread(
          call,
          `${registration.form} has no inline callback to read`,
        );
      return;
    }
    if (registration.name !== 'describe') return;
    const { form } = registration;
    if (!registration.members.every((member) => DESCRIBE_MEMBERS.has(member))) {
      sink.unread(call, `${form} is not a known describe form`);
      return;
    }
    if (registration.members.some((member) => NO_CALLBACK.has(member))) return;
    const title = titleOf(sf, call);
    const callback = call.arguments.find(isFunctionValue);
    if (!callback) {
      sink.unread(call, `${form}('${title}') has no inline callback to read`);
      return;
    }
    sink.describe();
    walk(callback.body, inner(title), sink);
  };

  const walkCall = (call: CallLike, scope: string, sink: Sink): void => {
    const registration = registrationOf(call);
    if (registration && ts.isCallExpression(call)) {
      walkRegistration(call, registration, scope, sink);
      return;
    }
    sink.judge(call, scope);
    walk(calleeOf(call), scope, sink);
    if (ts.isTaggedTemplateExpression(call)) walk(call.template, scope, sink);
    const origin = originName(calleeOf(call));
    const binding = origin ? resolve(origin.text, origin) : undefined;
    const runsNow =
      runsCallbacks(call) &&
      !(binding?.kind === 'import' && LAZY_PACKAGES.has(binding.specifier));
    for (const argument of argumentsOf(call)) {
      if (!isFunctionValue(argument)) walk(argument, scope, sink);
      else if (runsNow) walk(argument.body, scope, sink);
    }
  };

  /** The first verdict of the code a local function runs when called; `visited` breaks recursion. */
  const reach = (
    fn: Extract<Binding, { kind: 'function' }>,
    visited: Set<ts.Node>,
  ): Verdict => {
    if (visited.has(fn.body)) return null;
    visited.add(fn.body);
    let found: Verdict = null;
    walk(fn.body, MODULE_SCOPE, {
      judge: (call) => {
        found ??= judge(call, visited);
      },
      unread: (_node, text) => {
        found ??= { kind: 'unread', text };
      },
      describe: () => undefined,
      stopped: () => found !== null,
    });
    return found;
  };

  /** What a function passed by name to a builtin that runs it reaches. */
  const judgeArguments = (call: CallLike, visited: Set<ts.Node>): Verdict => {
    if (!runsCallbacks(call)) return null;
    for (const argument of argumentsOf(call)) {
      if (!ts.isIdentifier(argument)) continue;
      const binding = resolve(argument.text, argument);
      const imported = workspaceImport(binding);
      if (imported)
        return {
          kind: 'reaches',
          text: `${imported.local} (${imported.specifier})`,
        };
      if (binding?.kind === 'function') {
        const verdict = prefixed(binding.name, reach(binding, visited));
        if (verdict) return verdict;
      }
    }
    return null;
  };

  const judge = (call: CallLike, visited: Set<ts.Node>): Verdict => {
    const callee = calleeOf(call);
    const root = readRoot(callee);
    if (isCallLike(root) || isLiteral(root))
      return judgeArguments(call, visited);
    if (!ts.isIdentifier(root))
      return {
        kind: 'unread',
        text: `${textOf(call)} has no root name to resolve`,
      };
    const binding = resolve(root.text, root);
    const imported = workspaceImport(binding);
    if (imported)
      return {
        kind: 'reaches',
        text: `${imported.local} (${imported.specifier})`,
      };
    if (binding?.kind === 'function') {
      const verdict = prefixed(binding.name, reach(binding, visited));
      if (verdict) return verdict;
    }
    if (binding?.kind === 'data' && unwrap(callee) === root)
      return {
        kind: 'unread',
        text: `${textOf(call)} calls a value, not a function the reader can follow`,
      };
    return judgeArguments(call, visited);
  };

  let describes = 0;
  let judged = 0;
  const refused: RefusedCall[] = [];
  const unclassified: string[] = [];
  walk(sf, MODULE_SCOPE, {
    judge: (call, scope) => {
      judged += 1;
      const verdict = judge(call, new Set());
      if (verdict?.kind === 'reaches')
        refused.push({
          scope,
          line: lineOf(call),
          call: textOf(calleeOf(call)),
          reaches: verdict.text,
        });
      if (verdict?.kind === 'unread')
        unclassified.push(`line ${String(lineOf(call))}: ${verdict.text}`);
    },
    unread: (node, text) => {
      unclassified.push(`line ${String(lineOf(node))}: ${text}`);
    },
    describe: () => {
      describes += 1;
    },
    stopped: () => false,
  });
  return { describes, judged, refused, unclassified };
}
```

- [ ] **Step 5: Run the gate**

Commit first: the repo's guards read git-tracked files, as CI does, so a gate run over an untracked test sees nothing of it.

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`

Expected: every step passes; unit `Tests  3782 passed (3782)`.

- [ ] **Step 6: Mutation-verify**

Each row is applied alone at the branch head (stage T6, so later tasks' tests count), the whole unit suite is run, and the file is restored from the commit. Predictions were written before each run; "exact" means every failing test had to be predicted.

| ID    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Predicted red                                                                                                                                                                                                                                                                                 | Result                                                                                                                                                                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1.1  | `collection-calls.ts`: `if (registration.name === 'beforeAll') {` → `if (registration.name === 'afterAll') {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | in a beforeAll hook, whose throw skips its tests; in a Playwright test.beforeAll hook; a beforeAll whose callback is not written inline; judges the calls they evaluate at collection (exact)                                                                                                 | CAUGHT as predicted (4 failed \| 3789 passed (3793)). The first prediction missed the judged floor: the real tree's beforeAll calls (verify-dev) stop being counted.                                                                                                          |
| M1.2  | `collection-calls.ts`: `  return onTest && SUITES_AND_HOOKS.has(first)` → `  return false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | in a Playwright test.describe body; in a Playwright test.beforeAll hook; a member of test.describe it does not know; judges the calls they evaluate at collection                                                                                                                             | CAUGHT as predicted (4 failed \| 3789 passed (3793)). The first prediction named test.describe.configure, which unmapped is a plain test registration and still refuses nothing; the floor goes red instead (the spec's test.beforeAll calls go uncounted).                   |
| M1.3  | `collection-calls.ts`: `    if (!registration.members.every((member) => DESCRIBE_MEMBERS.has(member))) {` → `    if (false) {`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | a member of describe it does not know; a member of test.describe it does not know; a describe form it does not know, inside a function collection runs (exact)                                                                                                                                | CAUGHT as predicted (3 failed \| 3790 passed (3793)).                                                                                                                                                                                                                         |
| M1.4  | `collection-calls.ts`: `const NO_CALLBACK = new Set(['todo', 'configure']);` → `const NO_CALLBACK = new Set(['configure']);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | reads describe.todo as no callback (exact)                                                                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.5  | `collection-calls.ts`: `const NO_CALLBACK = new Set(['todo', 'configure']);` → `const NO_CALLBACK = new Set(['todo']);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | reads test.describe.configure as no callback (exact)                                                                                                                                                                                                                                          | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.6  | `collection-calls.ts`: `    CALLBACK_RUNNERS.has(callee.name.text)` → `    false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | inside a callback a call runs at collection; a local function that reaches it only in a nested callback; a workspace function passed to a call that may run it; a local function passed to a call that may run it; a method on a literal, passed a workspace function; a method on local data | CAUGHT as predicted (7 failed \| 3786 passed (3793)).                                                                                                                                                                                                                         |
| M1.7  | `collection-calls.ts`: `  CLOCK_BRANDS.has(binding.imported) &&` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | a function from the clock module that is not a brand; through an import of the core package (exact)                                                                                                                                                                                           | CAUGHT as predicted (2 failed \| 3791 passed (3793)). The first prediction missed that any import of the core package then passes as a brand.                                                                                                                                 |
| M1.8  | `collection-calls.ts`: `binding.specifier.endsWith('/clock')` → `binding.specifier.endsWith('')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | a clock brand name imported from a module that is not the clock (exact)                                                                                                                                                                                                                       | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.9  | `collection-calls.ts`: ` \|\| binding.specifier === CORE_PACKAGE` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | a clock brand imported from the core package (exact)                                                                                                                                                                                                                                          | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.10 | `collection-calls.ts`: `  specifier.startsWith('.') \|\| specifier.startsWith('@wordfarer/');` → `  specifier.startsWith('@wordfarer/');`                                                                                                                                                                                                                                                                                                                                                                                                                                                             | in a describe body, with its scope, line, call and the import it reaches; in a nested describe; through a local function that calls workspace code                                                                                                                                            | CAUGHT as predicted (43 failed \| 3750 passed (3793)).                                                                                                                                                                                                                        |
| M1.11 | `collection-calls.ts`: ` \|\| specifier.startsWith('@wordfarer/');` → `;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | through an import of the core package (exact)                                                                                                                                                                                                                                                 | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.12 | `collection-calls.ts`: `  isWorkspace(binding.specifier) &&⏎  !isClockBrand(binding)` → `  isWorkspace(binding.specifier)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | a clock brand; a clock brand imported from the core package; a clock brand imported under another name; reaches no workspace code at collection beyond the burn-down list                                                                                                                     | CAUGHT as predicted (4 failed \| 3789 passed (3793)).                                                                                                                                                                                                                         |
| M1.13 | `collection-calls.ts`: `    ts.isParenthesizedExpression(at) \|\|` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | a method on a string, a template, a number, an array or an object literal; through a workspace function cast with as; through a workspace function checked with satisfies                                                                                                                     | CAUGHT as predicted (3 failed \| 3790 passed (3793)).                                                                                                                                                                                                                         |
| M1.14 | `collection-calls.ts`: `    ts.isNonNullExpression(at) \|\|` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | through a workspace function asserted non-null (exact)                                                                                                                                                                                                                                        | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.15 | `collection-calls.ts`: `    ts.isAsExpression(at) \|\|` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | through a workspace function cast with as; through a workspace function checked with satisfies (exact)                                                                                                                                                                                        | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |
| M1.16 | `collection-calls.ts`: `    ts.isSatisfiesExpression(at)⏎  )` → `    false⏎  )`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | through a workspace function checked with satisfies (exact)                                                                                                                                                                                                                                   | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.17 | `collection-calls.ts`: `  while (ts.isPropertyAccessExpression(at) \|\| ts.isElementAccessExpression(at))` → `  while (ts.isPropertyAccessExpression(at))`                                                                                                                                                                                                                                                                                                                                                                                                                                            | through an element read on a workspace namespace (exact)                                                                                                                                                                                                                                      | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.18 | `collection-calls.ts`: `  while (isCallLike(at)) at = readRoot(calleeOf(at));` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | a fast-check arbitrary whose callback calls workspace code; a value a third-party call returned; classifies every call evaluated at collection                                                                                                                                                | CAUGHT as predicted (4 failed \| 3789 passed (3793)).                                                                                                                                                                                                                         |
| M1.19 | `collection-calls.ts`: `  ts.isLiteralExpression(node) \|\|` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | a method on a string, a template, a number, an array or an object literal                                                                                                                                                                                                                     | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |
| M1.20 | `collection-calls.ts`: `  ts.isTemplateExpression(node) \|\|` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | a method on a string, a template, a number, an array or an object literal                                                                                                                                                                                                                     | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.21 | `collection-calls.ts`: `  ts.isArrayLiteralExpression(node) \|\|` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | a method on a string, a template, a number, an array or an object literal; a workspace function passed to a call that may run it; a local fixture passed to a call; classifies every call evaluated at collection                                                                             | CAUGHT as predicted (6 failed \| 3787 passed (3793)). The first prediction named the inline-callback test, whose refusal survives: map's callback is walked whatever its receiver.                                                                                            |
| M1.22 | `collection-calls.ts`: `  ts.isArrayLiteralExpression(node) \|\|⏎  ts.isObjectLiteralExpression(node);` → `  ts.isArrayLiteralExpression(node);`                                                                                                                                                                                                                                                                                                                                                                                                                                                      | a method on a string, a template, a number, an array or an object literal                                                                                                                                                                                                                     | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.23 | `collection-calls.ts`: `  ts.isIdentifier(name)⏎    ? [name.text]⏎    : name.elements.flatMap(` → `  ts.isIdentifier(name)⏎    ? [name.text]⏎    : [].flatMap(`                                                                                                                                                                                                                                                                                                                                                                                                                                       | through a name destructured from a workspace namespace                                                                                                                                                                                                                                        | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.24 | `collection-calls.ts`: `    clause.phaseModifier === ts.SyntaxKind.TypeKeyword \|\|` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | a type-only import, which binds no value, so the global keeps its name (exact)                                                                                                                                                                                                                | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.25 | `collection-calls.ts`: `  if (clause.name) out.push(bind(clause.name.text, 'default'));` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | through a default import; a value a third-party call returned; a fast-check arbitrary whose callback calls workspace code                                                                                                                                                                     | CAUGHT as predicted (5 failed \| 3788 passed (3793)).                                                                                                                                                                                                                         |
| M1.26 | `collection-calls.ts`: `    out.push(bind(named.name.text, '*'));` → `    out.push();`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | through a namespace import; through a name destructured from a workspace namespace; through an element read on a workspace namespace; through a callee written over several lines                                                                                                             | CAUGHT as predicted (4 failed \| 3789 passed (3793)).                                                                                                                                                                                                                         |
| M1.27 | `collection-calls.ts`: `      if (!element.isTypeOnly)` → `      if (true)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a type-only import specifier, which binds no value either (exact)                                                                                                                                                                                                                             | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.28 | `collection-calls.ts`: `(element.propertyName ?? element.name).text` → `element.name.text`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | a clock brand imported under another name (exact)                                                                                                                                                                                                                                             | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.29 | `collection-calls.ts`: `  if (init && ts.isIdentifier(node.name) && isFunctionValue(init))` → `  if (init && ts.isIdentifier(node.name) && false)`                                                                                                                                                                                                                                                                                                                                                                                                                                                    | through a local arrow function that calls workspace code; a name a describe body declares, shadowing an import; classifies every call evaluated at collection                                                                                                                                 | CAUGHT as predicted (3 failed \| 3790 passed (3793)).                                                                                                                                                                                                                         |
| M1.30 | `collection-calls.ts`: `      ? { kind: 'alias', of: root }` → `      ? { kind: 'data' }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | through an alias of a workspace function; through an alias of a local function that calls workspace code; through a name destructured from a workspace namespace                                                                                                                              | CAUGHT as predicted (3 failed \| 3790 passed (3793)).                                                                                                                                                                                                                         |
| M1.31 | `collection-calls.ts`: `        ? { kind: 'result', of: origin }` → `        ? { kind: 'data' }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | a value a third-party call returned; classifies every call evaluated at collection                                                                                                                                                                                                            | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |
| M1.32 | `collection-calls.ts`: `    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body)` → `    if (false)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | through a local function that calls workspace code; through a local function that reaches it through another; through a shared suite function whose describe body calls workspace code                                                                                                        | CAUGHT as predicted (11 failed \| 3782 passed (3793)).                                                                                                                                                                                                                        |
| M1.33 | `collection-calls.ts`: `      return [[statement.name.text, DATA]];` → `      return [];`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | a direct call of a class declared in the file (exact)                                                                                                                                                                                                                                         | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.34 | `collection-calls.ts`: `      return statement.declarationList.declarations.flatMap(variableBindings);` → `      return [];`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | through a local arrow function that calls workspace code; through an alias of a workspace function; a name a describe body declares, shadowing an import                                                                                                                                      | CAUGHT as predicted (7 failed \| 3786 passed (3793)).                                                                                                                                                                                                                         |
| M1.35 | `collection-calls.ts`: `    if (ts.isImportDeclaration(statement)) return importBindings(statement);` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | in a describe body, with its scope, line, call and the import it reaches; through a namespace import                                                                                                                                                                                          | CAUGHT as predicted (46 failed \| 3747 passed (3793)).                                                                                                                                                                                                                        |
| M1.36 | `collection-calls.ts`: `  if (ts.isSourceFile(node) \|\| ts.isBlock(node))` → `  if (ts.isSourceFile(node))`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | a name a describe body declares, shadowing an import                                                                                                                                                                                                                                          | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.37 | `collection-calls.ts`: `  if (ts.isFunctionLike(node))⏎    return new Map(` → `  if (false)⏎    return new Map(`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | a direct call of a value, which may be any function                                                                                                                                                                                                                                           | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.38 | `collection-calls.ts`: `    ts.isForStatement(node) \|\|⏎    ts.isForOfStatement(node) \|\|⏎    ts.isForInStatement(node)⏎  ) {` → `    false⏎  ) {`                                                                                                                                                                                                                                                                                                                                                                                                                                                  | a direct call of a loop variable (exact)                                                                                                                                                                                                                                                      | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.39 | `collection-calls.ts`: `  if (ts.isCatchClause(node) && node.variableDeclaration)` → `  if (false)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | a direct call of a caught value (exact)                                                                                                                                                                                                                                                       | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.40 | `collection-calls.ts`: `    } else if (ts.isCallExpression(at)) {⏎      inner.push(at);⏎      at = at.expression;⏎    } else break;` → `    } else break;`                                                                                                                                                                                                                                                                                                                                                                                                                                            | a call inside a test of a describe.each; counts each describe callback; a direct call of a value, which may be any function                                                                                                                                                                   | CAUGHT as predicted (3 failed \| 3790 passed (3793)). The first prediction named the it.each table test, which still passes: the callee walk reaches the it.each registration.                                                                                                |
| M1.41 | `collection-calls.ts`: ``    return first.text;⏎  return first.getText(sf).replace(/^`\|`$/g, '');`` → ``    return first.getText(sf);⏎  return first.getText(sf).replace(/^`\|`$/g, '');``                                                                                                                                                                                                                                                                                                                                                                                                           | in a describe body, with its scope, line, call and the import it reaches; in a nested describe                                                                                                                                                                                                | CAUGHT as predicted (11 failed \| 3782 passed (3793)).                                                                                                                                                                                                                        |
| M1.42 | `collection-calls.ts`: ``  return first.getText(sf).replace(/^`\|`$/g, '');`` → `  return first.getText(sf);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | in a describe titled by a template (exact)                                                                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.43 | `collection-calls.ts`: `  if (!first) return '';` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | a describe with no arguments, by its empty title                                                                                                                                                                                                                                              | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.44 | `collection-calls.ts`: `    if (sink.stopped() \|\| ts.isFunctionLike(node)) return;` → `    if (sink.stopped()) return;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | a call inside a helper function the describe body only declares; through a local function that calls workspace code                                                                                                                                                                           | CAUGHT as predicted (17 failed \| 3776 passed (3793)).                                                                                                                                                                                                                        |
| M1.45 | `collection-calls.ts`: `    walk(calleeOf(call), scope, sink);⏎    if (ts.isTagged` → `    if (ts.isTagged`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a method on local data; a third-party package; judges the calls they evaluate at collection                                                                                                                                                                                                   | CAUGHT as predicted (5 failed \| 3788 passed (3793)). The first prediction named the literal-receiver test, whose refusal comes from the outer call's argument, not the inner call.                                                                                           |
| M1.46 | `collection-calls.ts`: `    if (ts.isTaggedTemplateExpression(call)) walk(call.template, scope, sink);` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | in a tagged template's substitution (exact)                                                                                                                                                                                                                                                   | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.47 | `collection-calls.ts`: `      !(binding?.kind === 'import' && LAZY_PACKAGES.has(binding.specifier));` → `      true;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | a fast-check arbitrary whose callback calls workspace code                                                                                                                                                                                                                                    | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |
| M1.48 | `collection-calls.ts`: `      if (!isFunctionValue(argument)) walk(argument, scope, sink);⏎      else if (runsNow)` → `      if (!isFunctionValue(argument)) continue;⏎      else if (runsNow)`                                                                                                                                                                                                                                                                                                                                                                                                       | a runtime global; judges the calls they evaluate at collection                                                                                                                                                                                                                                | CAUGHT as predicted (2 failed \| 3791 passed (3793)). The first prediction named the describe-body test, whose call is walked itself; only calls nested in arguments are lost.                                                                                                |
| M1.49 | `collection-calls.ts`: `      for (const argument of inner.arguments) walk(argument, scope, sink);` → `      continue;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | in an it.each table; in a describe.each table; in a describe.skipIf condition; judges the calls they evaluate at collection                                                                                                                                                                   | CAUGHT as predicted (4 failed \| 3789 passed (3793)).                                                                                                                                                                                                                         |
| M1.50 | `collection-calls.ts`: `      if (!isFunctionValue(argument)) walk(argument, scope, sink);⏎    const inner` → `      if (!isFunctionValue(argument)) continue;⏎    const inner`                                                                                                                                                                                                                                                                                                                                                                                                                       | in a test title; judges the calls they evaluate at collection                                                                                                                                                                                                                                 | CAUGHT as predicted (2 failed \| 3791 passed (3793)). The first prediction named the template-title describe, whose title holds no workspace call.                                                                                                                            |
| M1.51 | `collection-calls.ts`: `    if (registration.name !== 'describe') return;` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | a call inside a test; a call inside a hook                                                                                                                                                                                                                                                    | CAUGHT as predicted (7 failed \| 3786 passed (3793)).                                                                                                                                                                                                                         |
| M1.52 | `collection-calls.ts`: ``    if (!callback) {⏎      sink.unread(call, `${form}('${title}') has no inline callback to read`);⏎      return;⏎    }`` → `    if (!callback) return;`                                                                                                                                                                                                                                                                                                                                                                                                                     | a describe whose callback is not written inline; a describe with no arguments, by its empty title (exact)                                                                                                                                                                                     | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |
| M1.53 | `collection-calls.ts`: `    sink.describe();⏎    walk(callback.body` → `    walk(callback.body`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | counts each describe callback; reads the describe callbacks in them; reads a describe callback in every file whose text holds a describe call                                                                                                                                                 | CAUGHT as predicted (3 failed \| 3790 passed (3793)).                                                                                                                                                                                                                         |
| M1.54 | `collection-calls.ts`: ``      scope === MODULE_SCOPE ? title : `${scope} > ${title}`;`` → `      title;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | in a nested describe; in a beforeAll hook, whose throw skips its tests                                                                                                                                                                                                                        | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |
| M1.55 | `collection-calls.ts`: `    if (visited.has(fn.body)) return null;` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | through a local function that calls itself and workspace code; through two local functions that call each other, one reaching it                                                                                                                                                              | CAUGHT as predicted (9 failed \| 3784 passed (3793)). The first run went red only on the real tree (a stack overflow): both recursion fixtures reached integrate before recursing, so they never exercised the guard. They were reordered to recurse first, and go red alone. |
| M1.56 | `collection-calls.ts`: `        found ??= { kind: 'unread', text };` → `        void text;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a describe form it does not know, inside a function collection runs (exact)                                                                                                                                                                                                                   | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.57 | `collection-calls.ts`: `    if (!runsCallbacks(call)) return null;` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | a workspace value passed to a call that runs no function argument; reaches no workspace code at collection beyond the burn-down list (exact)                                                                                                                                                  | CAUGHT as predicted (2 failed \| 3791 passed (3793)). The first prediction missed the real tree's String(MAX_TIMEOUT_MINUTES).                                                                                                                                                |
| M1.58 | `collection-calls.ts`: ``      const imported = workspaceImport(binding);⏎      if (imported)⏎        return {⏎          kind: 'reaches',⏎          text: `${imported.local} (${imported.specifier})`,⏎        };⏎      if (binding?.kind === 'function') {⏎        const verdict = prefixed(binding.name, reach(binding, visited));⏎        if (verdict) return verdict;⏎      }⏎    }⏎    return null;`` → `      if (binding?.kind === 'function') {⏎        const verdict = prefixed(binding.name, reach(binding, visited));⏎        if (verdict) return verdict;⏎      }⏎    }⏎    return null;` | through a workspace function passed to a call that may run it; through a method on a literal, passed a workspace function (exact)                                                                                                                                                             | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |
| M1.59 | `collection-calls.ts`: `      if (binding?.kind === 'function') {⏎        const verdict = prefixed(binding.name, reach(binding, visited));⏎        if (verdict) return verdict;⏎      }⏎    }⏎    return null;` → `    }⏎    return null;`                                                                                                                                                                                                                                                                                                                                                            | through a local function passed to a call that may run it (exact)                                                                                                                                                                                                                             | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.60 | `collection-calls.ts`: `    if (isCallLike(root) \|\| isLiteral(root))⏎      return judgeArguments(call, visited);` → `    if (isCallLike(root) \|\| isLiteral(root))⏎      return null;`                                                                                                                                                                                                                                                                                                                                                                                                             | through a workspace function passed to a call that may run it; through a local function passed to a call that may run it; through a method on a literal, passed a workspace function (exact)                                                                                                  | CAUGHT as predicted (3 failed \| 3790 passed (3793)). The first prediction missed the local function passed to a literal's map.                                                                                                                                               |
| M1.61 | `collection-calls.ts`: `    if (isCallLike(root) \|\| isLiteral(root))` → `    if (isLiteral(root))`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | a method on local data; a third-party package; through a method on a literal, passed a workspace function                                                                                                                                                                                     | CAUGHT as predicted (5 failed \| 3788 passed (3793)).                                                                                                                                                                                                                         |
| M1.62 | `collection-calls.ts`: `    if (!ts.isIdentifier(root))⏎      return {⏎        kind: 'unread',` → `    if (!ts.isIdentifier(root))⏎      return null;⏎    if (false)⏎      return {⏎        kind: 'unread',`                                                                                                                                                                                                                                                                                                                                                                                          | a call whose callee has no name to resolve; a call inside a local function that the reader cannot follow (exact)                                                                                                                                                                              | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |
| M1.63 | `collection-calls.ts`: ``    const imported = workspaceImport(binding);⏎    if (imported)⏎      return {⏎        kind: 'reaches',⏎        text: `${imported.local} (${imported.specifier})`,⏎      };⏎    if (binding?.kind === 'function') {⏎      const verdict`` → `    if (binding?.kind === 'function') {⏎      const verdict`                                                                                                                                                                                                                                                                   | in a describe body, with its scope, line, call and the import it reaches; through a namespace import                                                                                                                                                                                          | CAUGHT as predicted (41 failed \| 3752 passed (3793)).                                                                                                                                                                                                                        |
| M1.64 | `collection-calls.ts`: `    if (binding?.kind === 'function') {⏎      const verdict = prefixed(binding.name, reach(binding, visited));⏎      if (verdict) return verdict;⏎    }⏎    if (binding?.kind === 'data'` → `    if (binding?.kind === 'data'`                                                                                                                                                                                                                                                                                                                                                | through a local function that calls workspace code; through a shared suite function                                                                                                                                                                                                           | CAUGHT as predicted (11 failed \| 3782 passed (3793)).                                                                                                                                                                                                                        |
| M1.65 | `collection-calls.ts`: `    if (binding?.kind === 'data' && unwrap(callee) === root)` → `    if (binding?.kind === 'data' && false)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | a direct call of a loop variable; a direct call of a caught value; a direct call of a name in a cycle of aliases; a direct call of a class declared in the file; a direct call of a value, which may be any function; a direct call of a value a workspace call returned (exact)              | CAUGHT as predicted (6 failed \| 3787 passed (3793)).                                                                                                                                                                                                                         |
| M1.66 | `collection-calls.ts`: `    if (binding?.kind === 'data' && unwrap(callee) === root)` → `    if (binding?.kind === 'data')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a method on local data; classifies every call evaluated at collection                                                                                                                                                                                                                         | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |
| M1.67 | `collection-calls.ts`: `        if (binding.kind === 'alias') return target;` → `        if (binding.kind === 'alias') return DATA;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | through an alias of a workspace function; through an alias of a local function that calls workspace code; through a name destructured from a workspace namespace                                                                                                                              | CAUGHT as predicted (3 failed \| 3790 passed (3793)).                                                                                                                                                                                                                         |
| M1.68 | `collection-calls.ts`: `        if (seen.has(binding.of)) return DATA;` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | a direct call of a name in a cycle of aliases (exact)                                                                                                                                                                                                                                         | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.69 | `collection-calls.ts`: `        return target?.kind === 'import' && !isWorkspace(target.specifier)⏎          ? target⏎          : DATA;` → `        return target;`                                                                                                                                                                                                                                                                                                                                                                                                                                   | a direct call of a value a workspace call returned                                                                                                                                                                                                                                            | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.70 | `collection-calls.ts`: ` && !isWorkspace(target.specifier)` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | a direct call of a value a workspace call returned (exact)                                                                                                                                                                                                                                    | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.71 | `collection-calls.ts`: `      if (ts.isSourceFile(at)) return undefined;` → `      if (ts.isSourceFile(at)) return DATA;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | a runtime global; classifies every call evaluated at collection                                                                                                                                                                                                                               | CAUGHT as predicted (9 failed \| 3784 passed (3793)).                                                                                                                                                                                                                         |
| M1.72 | `collection-calls.ts`: `      judged += 1;` → (deleted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | counts the calls evaluated at collection, refused or allowed; a clock brand; judges the calls they evaluate at collection                                                                                                                                                                     | CAUGHT as predicted (18 failed \| 3775 passed (3793)).                                                                                                                                                                                                                        |
| M1.73 | `collection-calls.ts`: `    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;` → `    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;`                                                                                                                                                                                                                                                                                                                                                                                                                                          | in a describe body, with its scope, line, call and the import it reaches; a describe whose callback is not written inline                                                                                                                                                                     | CAUGHT as predicted (30 failed \| 3763 passed (3793)).                                                                                                                                                                                                                        |
| M1.74 | `collection-calls.ts`: `  const textOf = (node: ts.Node): string => collapse(node.getText(sf));` → `  const textOf = (node: ts.Node): string => node.getText(sf);`                                                                                                                                                                                                                                                                                                                                                                                                                                    | through a callee written over several lines (exact)                                                                                                                                                                                                                                           | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                                                                                                         |
| M1.75 | `collection-calls.ts`: `      runsCallbacks(call) &&⏎      !(binding` → `      !(binding`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | a function passed to a call that runs it later, such as a server handler; reaches no workspace code at collection beyond the burn-down list                                                                                                                                                   | CAUGHT as predicted (2 failed \| 3791 passed (3793)).                                                                                                                                                                                                                         |

- [ ] **Step 7: Commit**

`git commit -m "test(guards): a detector for calls that reach workspace code at collection (Refs #97)"`

### Task 2: The guard over every tracked test file, with a burn-down list

**Files:**

- Create: `tests/unit/burn-down.ts`, `tests/unit/burn-down.test.ts`
- Modify: `tests/unit/collection-calls.test.ts` (the guard), `tests/unit/one-test-per-case.test.ts` (imports `minus`)

**Interfaces:**

- Consumes: `scanCollection` (Task 1), `trackedFiles` (`tests/unit/tracked-files.ts`).
- Produces: `minus(from, taken) → string[]`, one occurrence per match.

- [ ] **Step 1: Write the failing tests**

`tests/unit/burn-down.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { minus } from './burn-down';

describe('minus', () => {
  it('takes one occurrence per match, so two identical sites need two entries', () => {
    expect(minus(['a', 'a', 'b'], ['a'])).toEqual(['a', 'b']);
  });

  it('keeps every item no entry matches, in order', () => {
    expect(minus(['c', 'a', 'b'], ['x'])).toEqual(['c', 'a', 'b']);
  });

  it('leaves nothing when every item is matched', () => {
    expect(minus(['a', 'b', 'a'], ['a', 'b', 'a'])).toEqual([]);
  });

  it('ignores entries left over once their items are taken', () => {
    expect(minus(['a'], ['a', 'a', 'z'])).toEqual([]);
  });
});
```

`tests/unit/collection-calls.test.ts` (change):

```diff
diff --git a/tests/unit/collection-calls.test.ts b/tests/unit/collection-calls.test.ts
index 808fab2..fa8998c 100644
--- a/tests/unit/collection-calls.test.ts
+++ b/tests/unit/collection-calls.test.ts
@@ -1,9 +1,12 @@
 import { describe, expect, it } from 'vitest';
+import { readFileSync } from 'node:fs';
+import { minus } from './burn-down';
 import {
   scanCollection,
   type CollectionScan,
   type RefusedCall,
 } from './collection-calls';
+import { trackedFiles } from './tracked-files';

 /**
  * No workspace code at collection (Refs #97).
@@ -698,3 +701,99 @@ suite();`).unclassified,
     ]);
   });
 });
+
+/**
+ * Every call that reached workspace code at collection on the day #97's guard
+ * landed (12, in four files). `file :: scope :: call -> reaches`. The guard
+ * fails on a site missing from this list AND on an entry that no longer
+ * matches a site. Never add an entry: compute the value inside the test, or
+ * in a hook.
+ */
+const BURN_DOWN: readonly string[] = [
+  'packages/core/test/automation.test.ts :: rateGain (AC2) :: review -> review (../src/memory)',
+  'packages/core/test/automation.test.ts :: rateGain (AC2) :: newWordMemory -> newWordMemory (../src/memory)',
+  'packages/core/test/automation.test.ts :: rateGain (AC2) :: at -> at -> initialState (../src/state)',
+  'packages/core/test/grammar.test.ts :: buyGrammarNode (#32 AC1) :: stateAt -> stateAt -> initialState (../src/state)',
+  'packages/core/test/grammar.test.ts :: buyGrammarNode (#32 AC1) :: stateAt -> stateAt -> initialState (../src/state)',
+  'packages/core/test/grammar.test.ts :: buyGrammarNode (#32 AC1) :: stateAt -> stateAt -> initialState (../src/state)',
+  'packages/core/test/pemandu-perf.test.ts :: (module) :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
+  'packages/core/test/pemandu-perf.test.ts :: the bucket memo behind a fast return :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
+  'packages/core/test/sail.test.ts :: the preview (AC2, DN3) :: at -> at -> initialState (../src/state)',
+  'packages/core/test/sail.test.ts :: a sail resets only Encounters and Understanding (AC3, DN3) :: at -> at -> initialState (../src/state)',
+  'packages/core/test/sail.test.ts :: a sail resets only Encounters and Understanding (AC3, DN3) :: tuple -> tuple -> Num (../src/num)',
+  'packages/core/test/sail.test.ts :: a sail resets only Encounters and Understanding (AC3, DN3) :: startJourney -> startJourney (../src/journeys)',
+];
+
+const TEST_FILE = /\.(test|spec)\.ts$/;
+
+/** A describe call in raw text: `describe(`, `describe.each(`, `test.describe(`. */
+const RAW_DESCRIBE_CALL = /(^|[^\w.$])((it|test)\.)?describe(\.\w+)*\s*\(/m;
+
+/** Every tracked test file and what the detector read in it, scanned inside each test, never at collection. */
+const scan = () => {
+  const files = trackedFiles().filter((path) => TEST_FILE.test(path));
+  const read = files.map((file) => {
+    const source = readFileSync(file, 'utf8');
+    return { file, source, scan: scanCollection(source, file) };
+  });
+  const withDescribe = read.filter(({ source }) =>
+    RAW_DESCRIBE_CALL.test(source),
+  );
+  return {
+    files,
+    describes: read.reduce((n, { scan }) => n + scan.describes, 0),
+    judged: read.reduce((n, { scan }) => n + scan.judged, 0),
+    sites: read.flatMap(({ file, scan }) =>
+      scan.refused.map(
+        (site) => `${file} :: ${site.scope} :: ${site.call} -> ${site.reaches}`,
+      ),
+    ),
+    unclassified: read.flatMap(({ file, scan }) =>
+      scan.unclassified.map((what) => `${file} ${what}`),
+    ),
+    withDescribe: withDescribe.length,
+    unread: withDescribe
+      .filter(({ scan }) => scan.describes < 1)
+      .map(({ file }) => file),
+  };
+};
+
+describe('the suite', () => {
+  it('scans every tracked test file, this one included', () => {
+    const { files } = scan();
+    expect(files).toContain('tests/unit/collection-calls.test.ts');
+    expect(files).toContain('packages/core/test/grammar.test.ts');
+    expect(files).toContain('tests/engines/golden-vectors.spec.ts');
+    // Measured 44 at T2's head (#97). Lower it only in the commit that removes a test file.
+    expect(files.length).toBeGreaterThan(43);
+  });
+
+  it('reads the describe callbacks in them, counted as callbacks, not files', () => {
+    // Measured 153 at T2's head (#97). Lower it only in the commit that removes describes.
+    expect(scan().describes).toBeGreaterThan(152);
+  });
+
+  it('judges the calls they evaluate at collection, counted as calls', () => {
+    // Measured 288 at T2's head (#97). Lower it only in the commit that moves calls out of collection.
+    expect(scan().judged).toBeGreaterThan(287);
+  });
+
+  it('reads a describe callback in every file whose text holds a describe call', () => {
+    const { withDescribe, unread } = scan();
+    // Measured 43 at T2's head (#97).
+    expect(withDescribe).toBeGreaterThan(42);
+    expect(unread).toEqual([]);
+  });
+
+  it('classifies every call evaluated at collection, refusing by name what it cannot follow', () => {
+    expect(scan().unclassified).toEqual([]);
+  });
+
+  it('reaches no workspace code at collection beyond the burn-down list', () => {
+    expect(minus(scan().sites, BURN_DOWN)).toEqual([]);
+  });
+
+  it('keeps no burn-down entry that has already been converted', () => {
+    expect(minus(BURN_DOWN, scan().sites)).toEqual([]);
+  });
+});
```

`tests/unit/one-test-per-case.test.ts` (change):

```diff
diff --git a/tests/unit/one-test-per-case.test.ts b/tests/unit/one-test-per-case.test.ts
index 7347ce7..fbca295 100644
--- a/tests/unit/one-test-per-case.test.ts
+++ b/tests/unit/one-test-per-case.test.ts
@@ -1,6 +1,7 @@
 import { describe, expect, it } from 'vitest';
 import { readFileSync } from 'node:fs';
 import { scanTests, type LoopedCase, type TestScan } from './one-test-per-case';
+import { minus } from './burn-down';
 import { trackedFiles } from './tracked-files';

 /**
@@ -384,17 +385,6 @@ const scan = () => {
   };
 };

-/** `from` minus `taken`, one occurrence per match, so two identical sites need two entries. */
-const minus = (from: readonly string[], taken: readonly string[]): string[] => {
-  const left = [...taken];
-  return from.filter((item) => {
-    const at = left.indexOf(item);
-    if (at === -1) return true;
-    left.splice(at, 1);
-    return false;
-  });
-};
-
 describe('the suite', () => {
   it('scans every tracked test file, this one included', () => {
     const { files } = scan();
```

The floors are measured with the guard's own counters at this stage: 44 files, 153 describe callbacks, 288 calls judged, 43 files with a raw describe call. The 12 burn-down entries are what the detector refuses in today's tree.

- [ ] **Step 2: Write stubs**

`tests/unit/burn-down.ts` (stub):

```ts
export const minus = (
  _from: readonly string[],
  _taken: readonly string[],
): string[] => {
  throw new Error('not implemented');
};
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `npx vitest run tests/unit/burn-down.test.ts tests/unit/collection-calls.test.ts tests/unit/one-test-per-case.test.ts`

Expected: `Tests  8 failed | 155 passed (163)`. The eight that fail call `minus`: its four own tests, and the two burn-down tests of each guard ("loops no known population inside a test beyond the burn-down list" and "keeps no burn-down entry that has already been split" in `one-test-per-case.test.ts`; "reaches no workspace code at collection beyond the burn-down list" and "keeps no burn-down entry that has already been converted" here). The populations, the cross-check and the classification pass on Task 1's detector, as a guard over the real tree should; M2.1 to M2.5 show each can fail.

- [ ] **Step 4: Implement**

`tests/unit/burn-down.ts`:

```ts
/**
 * `from` minus `taken`, one occurrence per match, so two identical sites need
 * two entries. A guard's burn-down list compares both ways: sites missing from
 * the list, and entries that no longer match a site.
 */
export const minus = (
  from: readonly string[],
  taken: readonly string[],
): string[] => {
  const left = [...taken];
  return from.filter((item) => {
    const at = left.indexOf(item);
    if (at === -1) return true;
    left.splice(at, 1);
    return false;
  });
};
```

- [ ] **Step 5: Run the gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`

Expected: every step passes; unit `Tests  3793 passed (3793)`.

- [ ] **Step 6: Mutation-verify**

| ID   | Change                                                                                                                                                                                                                                              | Predicted red                                                                                                                                                        | Result                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2.1 | `collection-calls.test.ts`: `const TEST_FILE = /\.(test\|spec)\.ts$/;` → `const TEST_FILE = /\.test\.ts$/;`                                                                                                                                         | scans every tracked test file, this one included; judges the calls they evaluate at collection (exact)                                                               | CAUGHT as predicted (2 failed \| 3791 passed (3793)). The first prediction missed the judged floor: the spec file's beforeAll calls leave the count.                                              |
| M2.2 | `collection-calls.test.ts`: `    return { file, source, scan: scanCollection(source, file) };` → `    return { file, source, scan: scanCollection('', file) };`                                                                                     | reads the describe callbacks in them; judges the calls they evaluate at collection; reads a describe callback in every file whose text holds a describe call (exact) | CAUGHT as predicted (3 failed \| 3790 passed (3793)).                                                                                                                                             |
| M2.3 | `collection-calls.ts`: `    walk(callback.body, inner(title), sink);` → `    if (scope === MODULE_SCOPE) walk(callback.body, inner(title), sink);`                                                                                                  | judges the calls they evaluate at collection; in a nested describe                                                                                                   | CAUGHT as predicted (2 failed \| 3791 passed (3793)). The first prediction named the describe floor, but describes are counted before their bodies are walked; the judged floor goes red instead. |
| M2.4 | `collection-calls.ts`: `  if (!ts.isIdentifier(at) \|\| !REGISTRATIONS.has(at.text)) return null;` → `  if (!ts.isIdentifier(at) \|\| !REGISTRATIONS.has(at.text)) return null;⏎  if (at.text === 'describe' && members.length === 0) return null;` | reads a describe callback in every file whose text holds a describe call; reads the describe callbacks in them                                                       | CAUGHT as predicted (19 failed \| 3774 passed (3793)).                                                                                                                                            |
| M2.5 | `collection-calls.test.ts`: `const RAW_DESCRIBE_CALL = /(^\|[^\w.$])((it\|test)\.)?describe(\.\w+)*\s*\(/m;` → `const RAW_DESCRIBE_CALL = /(^\|[^\w.$])((it\|test)\.)?xdescribe(\.\w+)*\s*\(/m;`                                                    | reads a describe callback in every file whose text holds a describe call (exact)                                                                                     | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                             |
| M2.6 | `collection-calls.test.ts`: `const BURN_DOWN: readonly string[] = [];` → `const BURN_DOWN: readonly string[] = [⏎  'packages/core/test/grammar.test.ts :: gone :: stateAt -> x',⏎];`                                                                | keeps no burn-down entry that has already been converted (exact)                                                                                                     | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                             |
| M2.7 | `grammar.test.ts`: `function holding(grammar: readonly string[]): GameState {` → `const PLANTED = stateAt(4, 0);⏎function holding(grammar: readonly string[]): GameState {`                                                                         | reaches no workspace code at collection beyond the burn-down list (exact)                                                                                            | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                             |
| M2.8 | `grammar.test.ts`: `function holding(grammar: readonly string[]): GameState {` → `const PLANTED = ((n: number) => n)(1);⏎function holding(grammar: readonly string[]): GameState {`                                                                 | classifies every call evaluated at collection (exact)                                                                                                                | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                             |
| M2.9 | `collection-calls.test.ts`: `  it('counts each describe callback, nested ones included', () => {` → `  it('counts each describe callback, nested ones included', () => {⏎    for (const x of [1, 2]) expect(x).toBeGreaterThan(0);`                 | loops no known population inside a test beyond the burn-down list (exact)                                                                                            | CAUGHT as predicted (1 failed \| 3792 passed (3793)).                                                                                                                                             |

- [ ] **Step 7: Commit**

`git commit -m "test(guards): no workspace code at collection beyond a burn-down list (Refs #97)"`

### Task 3: grammar's rejection-order table builds its states inside the test

**Files:**

- Modify: `tests/unit/collection-calls.test.ts` (three entries out, the judged floor to 285), `packages/core/test/grammar.test.ts`

- [ ] **Step 1: Shorten the burn-down list**

`tests/unit/collection-calls.test.ts` (change):

```diff
diff --git a/tests/unit/collection-calls.test.ts b/tests/unit/collection-calls.test.ts
index fa8998c..38e0736 100644
--- a/tests/unit/collection-calls.test.ts
+++ b/tests/unit/collection-calls.test.ts
@@ -713,9 +713,6 @@ const BURN_DOWN: readonly string[] = [
   'packages/core/test/automation.test.ts :: rateGain (AC2) :: review -> review (../src/memory)',
   'packages/core/test/automation.test.ts :: rateGain (AC2) :: newWordMemory -> newWordMemory (../src/memory)',
   'packages/core/test/automation.test.ts :: rateGain (AC2) :: at -> at -> initialState (../src/state)',
-  'packages/core/test/grammar.test.ts :: buyGrammarNode (#32 AC1) :: stateAt -> stateAt -> initialState (../src/state)',
-  'packages/core/test/grammar.test.ts :: buyGrammarNode (#32 AC1) :: stateAt -> stateAt -> initialState (../src/state)',
-  'packages/core/test/grammar.test.ts :: buyGrammarNode (#32 AC1) :: stateAt -> stateAt -> initialState (../src/state)',
   'packages/core/test/pemandu-perf.test.ts :: (module) :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
   'packages/core/test/pemandu-perf.test.ts :: the bucket memo behind a fast return :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
   'packages/core/test/sail.test.ts :: the preview (AC2, DN3) :: at -> at -> initialState (../src/state)',
@@ -774,8 +771,8 @@ describe('the suite', () => {
   });

   it('judges the calls they evaluate at collection, counted as calls', () => {
-    // Measured 288 at T2's head (#97). Lower it only in the commit that moves calls out of collection.
-    expect(scan().judged).toBeGreaterThan(287);
+    // Measured 285 after #97 moved grammar.test.ts's table states into its tests. Lower it only in the commit that moves calls out of collection.
+    expect(scan().judged).toBeGreaterThan(284);
   });

   it('reads a describe callback in every file whose text holds a describe call', () => {
```

- [ ] **Step 2: Run the guard and see it fail**

Run: `npx vitest run tests/unit/collection-calls.test.ts`

Expected: `Tests  1 failed | 88 passed (89)`. Only "reaches no workspace code at collection beyond the burn-down list" fails, and its diff names the 3 sites in `grammar.test.ts` that this step took off the list: the three `stateAt -> initialState (../src/state)` rows of the `it.each` table. Every other test passes, the lowered judged floor among them: the parent stage still judges more calls than the new floor.

- [ ] **Step 3: Convert**

`packages/core/test/grammar.test.ts` (change):

```diff
diff --git a/packages/core/test/grammar.test.ts b/packages/core/test/grammar.test.ts
index b4fc8eb..d746262 100644
--- a/packages/core/test/grammar.test.ts
+++ b/packages/core/test/grammar.test.ts
@@ -280,22 +280,16 @@ describe('buyGrammarNode (#32 AC1)', () => {
     });
   });

-  it.each<[string, GameState, string, Rejection['kind']]>([
-    [
-      'owned before locked',
-      stateAt(3, 0, ['ber-']),
-      'ber-',
-      'grammarNodeOwned',
-    ],
-    [
-      'owned before unaffordable',
-      stateAt(4, 0, ['ber-']),
-      'ber-',
-      'grammarNodeOwned',
-    ],
-    ['locked before unaffordable', stateAt(3, 0), 'me-', 'grammarNodeLocked'],
-  ])('checks %s', (_, s, id, kind) => {
-    expect(rejected(buyGrammarNode(course, s, id)).kind).toBe(kind);
+  // Each row names its state's destination and grammar; the test builds it,
+  // so a throwing setup fails that test by name, never the file (#97).
+  it.each<[string, number, readonly string[], string, Rejection['kind']]>([
+    ['owned before locked', 3, ['ber-'], 'ber-', 'grammarNodeOwned'],
+    ['owned before unaffordable', 4, ['ber-'], 'ber-', 'grammarNodeOwned'],
+    ['locked before unaffordable', 3, [], 'me-', 'grammarNodeLocked'],
+  ])('checks %s', (_, at, grammar, id, kind) => {
+    expect(
+      rejected(buyGrammarNode(course, stateAt(at, 0, grammar), id)).kind,
+    ).toBe(kind);
   });
 });

```

- [ ] **Step 4: Run the gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`

Expected: every step passes; unit `Tests  3793 passed (3793)`, the same count as Task 2.

- [ ] **Step 5: Mutation-verify**

| ID   | Change                                                                                                                                                                                                   | Predicted red                                                                                   | Result                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| M3.1 | `grammar.test.ts`: `  const base = initialState(START, 1);⏎  return integrate(` → `  if (at >= 0) throw new Error('setup threw (#97 M3.1)');⏎  const base = initialState(START, 1);⏎  return integrate(` | checks owned before locked; checks owned before unaffordable; checks locked before unaffordable | CAUGHT as predicted (39 failed \| 3754 passed (3793)). |

- [ ] **Step 6: Commit**

`git commit -m "test(core): grammar's rejection-order table builds its states inside the test (Refs #97)"`

### Task 4: sail's preview and reset fixtures are built per test

**Files:**

- Modify: `tests/unit/collection-calls.test.ts` (four entries out, the judged floor to 278), `packages/core/test/sail.test.ts`

- [ ] **Step 1: Shorten the burn-down list**

`tests/unit/collection-calls.test.ts` (change):

```diff
diff --git a/tests/unit/collection-calls.test.ts b/tests/unit/collection-calls.test.ts
index 38e0736..e92d0b8 100644
--- a/tests/unit/collection-calls.test.ts
+++ b/tests/unit/collection-calls.test.ts
@@ -715,10 +715,6 @@ const BURN_DOWN: readonly string[] = [
   'packages/core/test/automation.test.ts :: rateGain (AC2) :: at -> at -> initialState (../src/state)',
   'packages/core/test/pemandu-perf.test.ts :: (module) :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
   'packages/core/test/pemandu-perf.test.ts :: the bucket memo behind a fast return :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
-  'packages/core/test/sail.test.ts :: the preview (AC2, DN3) :: at -> at -> initialState (../src/state)',
-  'packages/core/test/sail.test.ts :: a sail resets only Encounters and Understanding (AC3, DN3) :: at -> at -> initialState (../src/state)',
-  'packages/core/test/sail.test.ts :: a sail resets only Encounters and Understanding (AC3, DN3) :: tuple -> tuple -> Num (../src/num)',
-  'packages/core/test/sail.test.ts :: a sail resets only Encounters and Understanding (AC3, DN3) :: startJourney -> startJourney (../src/journeys)',
 ];

 const TEST_FILE = /\.(test|spec)\.ts$/;
@@ -771,8 +767,8 @@ describe('the suite', () => {
   });

   it('judges the calls they evaluate at collection, counted as calls', () => {
-    // Measured 285 after #97 moved grammar.test.ts's table states into its tests. Lower it only in the commit that moves calls out of collection.
-    expect(scan().judged).toBeGreaterThan(284);
+    // Measured 278 after #97 moved sail.test.ts's fixture states into its tests. Lower it only in the commit that moves calls out of collection.
+    expect(scan().judged).toBeGreaterThan(277);
   });

   it('reads a describe callback in every file whose text holds a describe call', () => {
```

- [ ] **Step 2: Run the guard and see it fail**

Run: `npx vitest run tests/unit/collection-calls.test.ts`

Expected: `Tests  1 failed | 88 passed (89)`. Only "reaches no workspace code at collection beyond the burn-down list" fails, and its diff names the 4 sites in `sail.test.ts` that this step took off the list: `at`, `tuple` and `startJourney` in the two describe bodies. Every other test passes, the lowered judged floor among them: the parent stage still judges more calls than the new floor.

- [ ] **Step 3: Convert**

`packages/core/test/sail.test.ts` (change):

```diff
diff --git a/packages/core/test/sail.test.ts b/packages/core/test/sail.test.ts
index 89b10bd..847f301 100644
--- a/packages/core/test/sail.test.ts
+++ b/packages/core/test/sail.test.ts
@@ -269,8 +269,9 @@ describe('the stamps a sail pays (AC2)', () => {

 describe('the preview (AC2, DN3)', () => {
   // Spent and held differ, and the levels add to more than the upgrades
-  // owned, so a preview reading the wrong one is caught.
-  const before = {
+  // owned, so a preview reading the wrong one is caught. Built per test, so
+  // a throwing setup fails each test by name, never the file (#97).
+  const before = (): GameState => ({
     ...at(2, { held: goalU(2) * 4, spent: 77 }),
     owned: { e0: 3 },
     stamps: 2,
@@ -278,10 +279,10 @@ describe('the preview (AC2, DN3)', () => {
     cards: ['c0'],
     upgrades: { startingUnderstanding: 2, journeySlot2: 1 },
     grammar: ['g0', 'g1'],
-  };
+  });
   // Computed per test, so a failing sail fails each test, not the file.
-  const preview = () => view(course, before, before.wall).sail;
-  const after = () => ok(setSail(course, before));
+  const preview = () => view(course, before(), before().wall).sail;
+  const after = () => ok(setSail(course, before()));

   it('names the destination and the next one', () => {
     expect(preview().destination).toBe('r0-d2');
@@ -293,7 +294,7 @@ describe('the preview (AC2, DN3)', () => {
     expect(n(preview().goal.understanding)).toBe(goalU(2));
     expect(preview().goal.words).toBe(goalWords(2));
     expect(n(preview().progress.understanding)).toBe(
-      n(runUnderstanding(course, before)),
+      n(runUnderstanding(course, before())),
     );
     expect(preview().progress.words).toBe(goalWords(2));
   });
@@ -301,7 +302,7 @@ describe('the preview (AC2, DN3)', () => {
   it('resets exactly the Encounters owned and the Understanding held', () => {
     expect(preview().resets.encounters).toEqual({ e0: 3 });
     expect(n(preview().resets.understanding)).toBe(
-      n(understandingNow(course, before)),
+      n(understandingNow(course, before())),
     );
     expect(after().owned).toEqual({});
   });
@@ -313,7 +314,7 @@ describe('the preview (AC2, DN3)', () => {

   it('pays exactly the stamps the sail adds', () => {
     expect(preview().gains.stamps).toBe(6);
-    expect(after().stampsEarned - before.stampsEarned).toBe(
+    expect(after().stampsEarned - before().stampsEarned).toBe(
       preview().gains.stamps,
     );
   });
@@ -367,7 +368,9 @@ describe('the preview (AC2, DN3)', () => {
 });

 describe('a sail resets only Encounters and Understanding (AC3, DN3)', () => {
-  const before: GameState = {
+  // Built per test, so a throwing setup fails each test by name, never the
+  // file (#97).
+  const before = (): GameState => ({
     ...at(2, { held: goalU(2) * 4, spent: 77 }),
     owned: { e0: 3 },
     insight: tuple(12),
@@ -377,10 +380,10 @@ describe('a sail resets only Encounters and Understanding (AC3, DN3)', () => {
     cards: ['c0'],
     tutorialJourneyUsed: true,
     grammar: ['g0'],
-  };
-  const out = ok(startJourney(course, before, 0, '2h'));
+  });
+  const out = () => ok(startJourney(course, before(), 0, '2h'));
   // Computed per test, so a failing sail fails each test, not the file.
-  const after = () => ok(setSail(course, out));
+  const after = () => ok(setSail(course, out()));

   /** The keys a sail is allowed to change: the reset, the gain and the position. */
   const CHANGED = [
@@ -395,17 +398,17 @@ describe('a sail resets only Encounters and Understanding (AC3, DN3)', () => {

   it('changes nothing else: every other key is deep-equal', () => {
     // Read from the state itself, so a key added later is covered.
-    const kept = Object.keys(out).filter((k) => !CHANGED.includes(k));
+    const kept = Object.keys(out()).filter((k) => !CHANGED.includes(k));
     expect(kept.length).toBeGreaterThan(12);
     expect(
       Object.fromEntries(kept.map((k) => [k, after()[k as keyof GameState]])),
     ).toEqual(
-      Object.fromEntries(kept.map((k) => [k, out[k as keyof GameState]])),
+      Object.fromEntries(kept.map((k) => [k, out()[k as keyof GameState]])),
     );
   });

   it('keeps the words, their ranks and their FSRS memory', () => {
-    expect(after().words).toEqual(out.words);
+    expect(after().words).toEqual(out().words);
     expect(Object.keys(after().words)).toHaveLength(goalWords(2));
   });

@@ -415,19 +418,22 @@ describe('a sail resets only Encounters and Understanding (AC3, DN3)', () => {

   it('keeps the cards, upgrades and Insight', () => {
     expect(after().cards).toEqual(['c0']);
-    expect(after().upgrades).toEqual(out.upgrades);
+    expect(after().upgrades).toEqual(out().upgrades);
     expect(after().insight).toEqual(tuple(12));
   });

   it('owns no Encounters and holds only the starting grant, with nothing spent', () => {
     expect(after().owned).toEqual({});
-    expect(after().anchor).toEqual({ sim: out.sim, understanding: tuple(200) });
+    expect(after().anchor).toEqual({
+      sim: out().sim,
+      understanding: tuple(200),
+    });
     expect(after().runSpent).toEqual([0, 0]);
   });

   it('keeps a Journey still out', () => {
-    expect(out.journeys[0]).not.toBeNull();
-    expect(after().journeys).toEqual(out.journeys);
+    expect(out().journeys[0]).not.toBeNull();
+    expect(after().journeys).toEqual(out().journeys);
   });

   it('a Journey out across a sail into the next region brings back the card it drew', () => {
```

- [ ] **Step 4: Run the gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`

Expected: every step passes; unit `Tests  3793 passed (3793)`, the same count as Task 2.

- [ ] **Step 5: Mutation-verify**

| ID   | Change                                                                                                                                                                               | Predicted red                                                                               | Result                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| M4.1 | `sail.test.ts`: `function at(i: number, opts: At = {}): GameState {` → `function at(i: number, opts: At = {}): GameState {⏎  if (i >= 0) throw new Error('setup threw (#97 M4.1)');` | names the destination and the next one; changes nothing else: every other key is deep-equal | CAUGHT as predicted (73 failed \| 3720 passed (3793)). |

- [ ] **Step 6: Commit**

`git commit -m "test(core): sail's preview and reset fixtures are built per test (Refs #97)"`

### Task 5: rateGain's reviewed-words state is built inside its test

**Files:**

- Modify: `tests/unit/collection-calls.test.ts` (three entries out, the judged floor to 272), `packages/core/test/automation.test.ts`

- [ ] **Step 1: Shorten the burn-down list**

`tests/unit/collection-calls.test.ts` (change):

```diff
diff --git a/tests/unit/collection-calls.test.ts b/tests/unit/collection-calls.test.ts
index e92d0b8..b7eb600 100644
--- a/tests/unit/collection-calls.test.ts
+++ b/tests/unit/collection-calls.test.ts
@@ -710,9 +710,6 @@ suite();`).unclassified,
  * in a hook.
  */
 const BURN_DOWN: readonly string[] = [
-  'packages/core/test/automation.test.ts :: rateGain (AC2) :: review -> review (../src/memory)',
-  'packages/core/test/automation.test.ts :: rateGain (AC2) :: newWordMemory -> newWordMemory (../src/memory)',
-  'packages/core/test/automation.test.ts :: rateGain (AC2) :: at -> at -> initialState (../src/state)',
   'packages/core/test/pemandu-perf.test.ts :: (module) :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
   'packages/core/test/pemandu-perf.test.ts :: the bucket memo behind a fast return :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
 ];
@@ -767,8 +764,8 @@ describe('the suite', () => {
   });

   it('judges the calls they evaluate at collection, counted as calls', () => {
-    // Measured 278 after #97 moved sail.test.ts's fixture states into its tests. Lower it only in the commit that moves calls out of collection.
-    expect(scan().judged).toBeGreaterThan(277);
+    // Measured 272 after #97 moved automation.test.ts's rateGain state into its test. Lower it only in the commit that moves calls out of collection.
+    expect(scan().judged).toBeGreaterThan(271);
   });

   it('reads a describe callback in every file whose text holds a describe call', () => {
```

- [ ] **Step 2: Run the guard and see it fail**

Run: `npx vitest run tests/unit/collection-calls.test.ts`

Expected: `Tests  1 failed | 88 passed (89)`. Only "reaches no workspace code at collection beyond the burn-down list" fails, and its diff names the 3 sites in `automation.test.ts` that this step took off the list: `review`, `newWordMemory` and `at` in the "rateGain (AC2)" describe body. Every other test passes, the lowered judged floor among them: the parent stage still judges more calls than the new floor.

- [ ] **Step 3: Convert**

`packages/core/test/automation.test.ts` (change):

```diff
diff --git a/packages/core/test/automation.test.ts b/packages/core/test/automation.test.ts
index 6e1fcba..2d0ef39 100644
--- a/packages/core/test/automation.test.ts
+++ b/packages/core/test/automation.test.ts
@@ -329,26 +329,31 @@ const twins: CourseData = {
 };

 describe('rateGain (AC2)', () => {
-  // Reviewed two days before the game, so each word's bonus depends on the
-  // hour bucket the gain is taken in.
-  const reviewedAt = wallMs(START - 2 * 86_400_000);
-  const words = Object.fromEntries(
-    ['r0-d0-w0', 'r0-d0-w1'].map((id) => [
-      id,
-      review(newWordMemory(reviewedAt), reviewedAt, true),
-    ]),
-  );
-  const s = at(4, {
-    owned: { tea: 9, inn: 3, ferry1: 1 },
-    upgrades: { 'phrasebook:food': 1 },
-    words,
-    simMs: 5 * 3_600_000 + 17,
-  });
+  /**
+   * Words reviewed two days before the game, so each word's bonus depends on
+   * the hour bucket the gain is taken in. Built per test, so a throwing setup
+   * fails each test by name, never the file (#97).
+   */
+  function gainState(): GameState {
+    const reviewedAt = wallMs(START - 2 * 86_400_000);
+    return at(4, {
+      owned: { tea: 9, inn: 3, ferry1: 1 },
+      upgrades: { 'phrasebook:food': 1 },
+      words: Object.fromEntries(
+        ['r0-d0-w0', 'r0-d0-w1'].map((id) => [
+          id,
+          review(newWordMemory(reviewedAt), reviewedAt, true),
+        ]),
+      ),
+      simMs: 5 * 3_600_000 + 17,
+    });
+  }
   const reachable = shop.regions.flatMap((r) => r.encounters);

   it.each(reachable.map((e) => [e.id, e] as const))(
     '%s: its rate with one more, less its rate now, bit for bit',
     (_id, encounter) => {
+      const s = gainState();
       const gain = rateGain(shop, s, s.sim)(encounter);
       const plus = {
         ...s,
```

- [ ] **Step 4: Run the gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`

Expected: every step passes; unit `Tests  3793 passed (3793)`, the same count as Task 2.

- [ ] **Step 5: Mutation-verify**

| ID   | Change                                                                                                                                                            | Predicted red                                                  | Result                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| M5.1 | `automation.test.ts`: `  function gainState(): GameState {` → `  function gainState(): GameState {⏎    if (START > 0) throw new Error('setup threw (#97 M5.1)');` | its rate with one more, less its rate now, bit for bit (exact) | CAUGHT as predicted (6 failed \| 3787 passed (3793)). |

- [ ] **Step 6: Commit**

`git commit -m "test(core): rateGain's reviewed-words state is built inside its test (Refs #97)"`

### Task 6: pemandu-perf builds its synthetic courses on first use in a test

**Files:**

- Modify: `tests/unit/collection-calls.test.ts` (the last two entries out, the list empty, the judged floor to 270), `packages/core/test/pemandu-perf.test.ts`

- [ ] **Step 1: Empty the burn-down list**

`tests/unit/collection-calls.test.ts` (change):

```diff
diff --git a/tests/unit/collection-calls.test.ts b/tests/unit/collection-calls.test.ts
index b7eb600..01ce6d4 100644
--- a/tests/unit/collection-calls.test.ts
+++ b/tests/unit/collection-calls.test.ts
@@ -704,15 +704,13 @@ suite();`).unclassified,

 /**
  * Every call that reached workspace code at collection on the day #97's guard
- * landed (12, in four files). `file :: scope :: call -> reaches`. The guard
- * fails on a site missing from this list AND on an entry that no longer
- * matches a site. Never add an entry: compute the value inside the test, or
- * in a hook.
+ * landed (12, in four files), converted by #97 and empty since.
+ * `file :: scope :: call -> reaches`. The guard fails on a site missing from
+ * this list AND on an entry that no longer matches a site. Never add an
+ * entry: compute the value inside the test, or in a `beforeEach` (a throwing
+ * `beforeAll` skips its tests instead of failing them).
  */
-const BURN_DOWN: readonly string[] = [
-  'packages/core/test/pemandu-perf.test.ts :: (module) :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
-  'packages/core/test/pemandu-perf.test.ts :: the bucket memo behind a fast return :: syntheticCourse -> syntheticCourse (../fixtures/synthetic-course)',
-];
+const BURN_DOWN: readonly string[] = [];

 const TEST_FILE = /\.(test|spec)\.ts$/;

@@ -764,8 +762,8 @@ describe('the suite', () => {
   });

   it('judges the calls they evaluate at collection, counted as calls', () => {
-    // Measured 272 after #97 moved automation.test.ts's rateGain state into its test. Lower it only in the commit that moves calls out of collection.
-    expect(scan().judged).toBeGreaterThan(271);
+    // Measured 270 at #97's head, its last site converted. Lower it only in the commit that moves calls out of collection.
+    expect(scan().judged).toBeGreaterThan(269);
   });

   it('reads a describe callback in every file whose text holds a describe call', () => {
```

- [ ] **Step 2: Run the guard and see it fail**

Run: `npx vitest run tests/unit/collection-calls.test.ts`

Expected: `Tests  1 failed | 88 passed (89)`. Only "reaches no workspace code at collection beyond the burn-down list" fails, and its diff names the 2 sites in `pemandu-perf.test.ts` that this step took off the list: `syntheticCourse` at module scope and in the bucket-memo describe body. Every other test passes, the lowered judged floor among them: the parent stage still judges more calls than the new floor.

- [ ] **Step 3: Convert**

`packages/core/test/pemandu-perf.test.ts` (change):

```diff
diff --git a/packages/core/test/pemandu-perf.test.ts b/packages/core/test/pemandu-perf.test.ts
index 4a6bb9e..2c48e80 100644
--- a/packages/core/test/pemandu-perf.test.ts
+++ b/packages/core/test/pemandu-perf.test.ts
@@ -40,13 +40,23 @@ declare const process: {
   };
 };

-const course = syntheticCourse(1);
+let builtCourse: CourseData | undefined;
+
+/**
+ * The synthetic course, built on first use inside a test and kept, so every
+ * test reads the same object (the bucket memo is keyed by it) and a throwing
+ * build fails each test that needs it by name, never the file (#97).
+ */
+function course(): CourseData {
+  builtCourse ??= syntheticCourse(1);
+  return builtCourse;
+}
 const START = wallMs(BOT_EPOCH_WALL_MS + 60 * DAY_MS);

 function heldWords(): Record<string, WordMemory> {
   const ids = [
-    ...(course.regions[0]?.destinations ?? []),
-    course.regions[1]?.destinations[0],
+    ...(course().regions[0]?.destinations ?? []),
+    course().regions[1]?.destinations[0],
   ].flatMap((d) => d?.lexicon.map((item) => item.id) ?? []);
   return Object.fromEntries(
     ids.map((id, k) => {
@@ -91,7 +101,7 @@ function returning(): GameState {
     destination: 4,
     reached: 4,
   };
-  const on = setAutomation(course, parked, true, 1_000);
+  const on = setAutomation(course(), parked, true, 1_000);
   if (!on.ok) throw new Error(`refused: ${JSON.stringify(on.rejection)}`);
   return on.state;
 }
@@ -106,7 +116,7 @@ describe('a 72 h return with Pemandu at 1 s (AC5)', () => {
     const wallStart = performance.now();
     const cpuStart = process.cpuUsage();
     const { state, summary } = advance(
-      course,
+      course(),
       s,
       wallMs(s.wall + 72 * HOUR_MS),
     );
@@ -132,14 +142,19 @@ describe('a 72 h return with Pemandu at 1 s (AC5)', () => {
  * the breakdown a cold memo gives.
  */
 describe('the bucket memo behind a fast return', () => {
-  const node = course.regions[0]?.grammarNodes[0]?.id ?? '';
-  const other = syntheticCourse(2);
+  const node = (): string => course().regions[0]?.grammarNodes[0]?.id ?? '';
+  let builtOther: CourseData | undefined;
+  /** A second course with the same word ids, built on first use like course(). */
+  function other(): CourseData {
+    builtOther ??= syntheticCourse(2);
+    return builtOther;
+  }
   // Each change is a function of the state, so no core code runs while the
   // file is collected: a core change that throws then fails these tests by
   // name rather than dropping them from the count.
   type Change = (s: GameState) => Partial<GameState>;

-  it.each<readonly [string, CourseData, Change, number]>([
+  it.each<readonly [string, () => CourseData, Change, number]>([
     [
       'memorySince moves, as a review moves it',
       course,
@@ -152,17 +167,18 @@ describe('the bucket memo behind a fast return', () => {
       (s) => ({ wall: wallMs(s.wall + DAY_MS) }),
       0,
     ],
-    ['a grammar node is owned', course, () => ({ grammar: [node] }), 0],
+    ['a grammar node is owned', course, () => ({ grammar: [node()] }), 0],
     ['the next hour', course, () => ({}), HOUR_MS],
     ['another course with the same word ids', other, () => ({}), 0],
-  ])('%s', (_label, c, change, later) => {
+  ])('%s', (_label, courseOf, change, later) => {
+    const c = courseOf();
     const s0 = returning();
     const t0 = simMs(s0.sim + 1_234);
     const t = simMs(t0 + later);
-    rateBreakdown(course, s0, t0);
+    rateBreakdown(course(), s0, t0);
     const s1: GameState = { ...s0, ...change(s0) };
     const cold = rateBreakdown(c, { ...s1, words: { ...s1.words } }, t);
     expect(rateBreakdown(c, s1, t)).toEqual(cold);
-    expect(cold).not.toEqual(rateBreakdown(course, s0, t0));
+    expect(cold).not.toEqual(rateBreakdown(course(), s0, t0));
   });
 });
```

- [ ] **Step 4: Run the gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm run test:unit && npm run test:worker && npm run build`

Expected: every step passes; unit `Tests  3793 passed (3793)`, the same count as Task 2. The 72 h return prints its CPU and wall time and still buys 1,683 units.

- [ ] **Step 5: Mutation-verify**

| ID   | Change                                                                                                                                                     | Predicted red                                                                                                           | Result                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| M6.1 | `pemandu-perf.test.ts`: `function course(): CourseData {` → `function course(): CourseData {⏎  if (DAY_MS > 0) throw new Error('setup threw (#97 M6.1)');` | is credited in full and buys on the way; memorySince moves, as a review moves it; another course with the same word ids | CAUGHT as predicted (6 failed \| 3787 passed (3793)). |

- [ ] **Step 6: Commit**

`git commit -m "test(core): pemandu-perf builds its synthetic courses on first use in a test (Refs #97)"`

## Finishing

1. Commit this plan as the branch's last commit (`docs(plan): the #97 plan, generated from its stage commits and reviewed to zero (Refs #97)`), after the stage gates, the red runs and the mutations, which it reports.
2. Push the branch through the agent credential, open the PR into `develop` with `Refs #97`, and wait for CI with `~/.claude/scripts/wait-run.sh`, reading each step by name at the PR's head SHA.
