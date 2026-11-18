# Mutation runner (#527) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One tracked mutation runner (`npm run mutate -- <file>`) and one tracked mutation-file format, which predict the whole-repo floors a guards mutation moves, for the `mutations` check (#619) to run.

**Architecture:** `scripts/mutation-file.ts` holds the format and its shape checks. `scripts/mutate-reporter.ts` is a vitest reporter writing each run's total, files, whole failure texts and timeouts (vitest's JSON cuts messages short; spec §4a). `scripts/mutate.ts` holds pure functions (report reading, planting, suite choice, corpus prediction, judging), `runFile` driven through an injected `Io`, and a thin `main` wiring the real `Io`. `SUITES` in `scripts/record-floors.ts` gains `mutate` configs, so the suite list stays in one place.

**Tech Stack:** TypeScript run by Node 26's own type stripping, vitest 5.0.3 (reporter API, `related`), git.

**Spec:** `docs/superpowers/specs/2026-10-17-mutation-runner-design.md` (reviewed to zero, self-approved, commit `fecc8e6`).

## Global Constraints

- Node 26 runs scripts directly: a script's own imports carry `.ts` (`./record-floors.ts`); tests import without the extension.
- Unit tests start no process, open no socket and read no tree (`tests/unit/setup.ts`); each stays under 1 s and 0.1 s of its own thread CPU. One test per case.
- The laptop runs the unit suite, typecheck, lint and Prettier only; the guards, integration and other suites run in CI.
- Every new test is run red against a throwing stub first (each failure must be the stub's throw), then green.
- Floors are recorded in CI only: label the pull request `record-floors`, `npm run floors:fetch <run-id>`, fold into the single commit.
- No retries, no raised limits, `Refs #527` (never a closing keyword).

## Review Focus

- A file that fails to load (syntax error from a mutation) reports no tests: named `<file> › (the file)`, and the total check catches the dropped tests (Task 2, `reportOf` and `judge` tests; probed on vitest 5.0.3).
- A failure's reason sits past vitest's 30-character cut or inside an object: judged from the reporter's whole error text (Task 2, `reportOf` keeps message, diff, actual, expected).
- A test whose source quotes "Test timed out": not a timeout (Task 2, `reportOf` anchors on the error's own message).
- Terminal colour codes in vitest messages: stripped from the printed line (Task 2, the colour test).
- A runner stopped by a signal while a file is planted: `main` restores every guarded file (Task 3, `realIo().restoreAll`), and `runFile` restores in `finally` (Task 2 test "puts the file back when the run throws").
- An inherited `FLOORS_RECORD` in the caller's environment would make every judged run pass its floors: `runEnv` drops it (Task 3 test).
- A guard that imports the mutated file: its moved floor is never predicted for the author (Task 2 guards tests, Task 4 integration case c).

---

### Task 1: The mutation file format

**Files:**

- Create: `scripts/mutation-file.ts`
- Test: `tests/unit/mutation-file.test.ts`

**Interfaces:**

- Produces: `FILE_SEPARATOR = ' › '`; `interface Mutation { name, file, anchor, replacement, red: Readonly<Record<string, string>> }`; `interface MutationFile { targets: readonly string[]; mutations: readonly Mutation[] }`; `mutationFileProblems(file): string[]`; `mutationFile(file): MutationFile` (throws); `asMutationFile(value: unknown): MutationFile` (throws).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  asMutationFile,
  mutationFile,
  mutationFileProblems,
  type Mutation,
  type MutationFile,
} from '../../scripts/mutation-file';
import { floorBreach } from '../floors';
import { againstControl, searched } from '../searched';
import { watched } from '../watched';

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
  // The check is handed watched mutations, so the search names the
  // mutations it read, not the fixture's size.
  it('finds none in a well-formed file', () => {
    const { items, read } = watched(
      [MUTATION, { ...MUTATION, name: 'first-sail-blind-again' }],
      'name',
    );
    expect(
      searched(mutationFileProblems({ ...FILE, mutations: items }), {
        of: read,
        what: 'mutations the check read',
      }),
    ).toEqual([]);
    expect(
      floorBreach('mutation-file/well-formed', read.length),
    ).toBeUndefined();
  });

  it('accepts a mutation predicted green', () => {
    expect(
      againstControl(
        (red: Readonly<Record<string, string>>) =>
          mutationFileProblems({ ...FILE, mutations: [{ ...MUTATION, red }] }),
        { input: {}, control: { 'a describe > a title': 'x' } },
      ),
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
```

- [ ] **Step 2: Plant a throwing stub and run red**

Write `scripts/mutation-file.ts` with the types and constant above and each function body `throw new Error('stub');`. Run: `npx vitest run tests/unit/mutation-file.test.ts --reporter=default`. Expected: 22 failed, each on `stub` (measured: 15 failed before `asMutationFile`'s 7 were added, then 82 of 82 across Tasks 1–2).

- [ ] **Step 3: Write the implementation**

```ts
/**
 * A tracked mutation file (#527, spec `docs/superpowers/specs/
 * 2026-10-17-mutation-runner-design.md` §3): the mutations that prove the
 * tests in `targets` can fail, each with its prediction written before it
 * runs. One module per set, in `tests/mutations/`, default-exporting
 * `mutationFile({...})`, which checks the shape as the module loads.
 *
 * `scripts/mutate.ts` runs them. The `mutations` check (#619) matches a pull
 * request's changed non-unit tests against `targets`.
 */

/** Between a test's file and its describe-and-title path. */
export const FILE_SEPARATOR = ' › ';

export interface Mutation {
  /** Unique in its file; names the run's log files. */
  readonly name: string;
  /** The tracked file the anchor is replaced in, repository-relative. */
  readonly file: string;
  /** Text that must occur exactly once in `file`. */
  readonly anchor: string;
  readonly replacement: string;
  /**
   * Each test predicted to fail, written `<file> › <describe> > … > <title>`
   * as vitest reports it, to text its failure must contain (a floor id, or
   * the finding). The text is matched against the whole error the runner's
   * reporter saw: message, diff, actual and expected. A function expected to
   * throw that throws nothing fails with vitest's bare "to throw an error".
   * Empty: the mutation is predicted to stay green.
   */
  readonly red: Readonly<Record<string, string>>;
}

export interface MutationFile {
  /** The test files this set proves, all in one suite. */
  readonly targets: readonly string[];
  readonly mutations: readonly Mutation[];
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Each reason the runner could not judge `file`, in reading order. */
export function mutationFileProblems(file: MutationFile): string[] {
  const problems: string[] = [];
  if (file.targets.length === 0) problems.push('names no targets');
  const targets = new Set<string>();
  for (const target of file.targets) {
    if (target === '') problems.push('has an empty target');
    else if (targets.has(target))
      problems.push(`names ${target} twice in targets`);
    targets.add(target);
  }
  if (file.mutations.length === 0) problems.push('holds no mutations');
  const names = new Set<string>();
  for (const m of file.mutations) {
    if (names.has(m.name)) {
      problems.push(`names ${m.name} twice`);
      continue;
    }
    names.add(m.name);
    if (!NAME.test(m.name))
      problems.push(
        `${m.name}: a name is letters, digits, dots, dashes and underscores, starting with a letter or digit`,
      );
    if (m.file === '') problems.push(`${m.name}: names no file`);
    if (m.anchor === '') problems.push(`${m.name}: has an empty anchor`);
    else if (m.replacement === m.anchor)
      problems.push(`${m.name}: its replacement is its anchor`);
    for (const [test, text] of Object.entries(m.red)) {
      if (!test.includes(FILE_SEPARATOR))
        problems.push(
          `${m.name}: red test "${test}" is not written <file>${FILE_SEPARATOR}<describe> > … > <title>`,
        );
      else if (text === '')
        problems.push(
          `${m.name}: red test "${test}" names no text its failure must show`,
        );
    }
  }
  return problems;
}

/** `file`, unchanged, or a throw naming every problem it has. */
export function mutationFile(file: MutationFile): MutationFile {
  const problems = mutationFileProblems(file);
  if (problems.length > 0)
    throw new Error(`mutation file refused:\n  ${problems.join('\n  ')}`);
  return file;
}

const isText = (x: unknown): x is string => typeof x === 'string';

const isTextList = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every(isText);

function isMutation(x: unknown): x is Mutation {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const m = x as Record<string, unknown>;
  const red = m.red;
  return (
    isText(m.name) &&
    isText(m.file) &&
    isText(m.anchor) &&
    isText(m.replacement) &&
    typeof red === 'object' &&
    red !== null &&
    !Array.isArray(red) &&
    Object.values(red).every(isText)
  );
}

/**
 * A loaded module's default export, typed, or a throw: the runner imports
 * mutation files by path, so it checks what it got before judging it.
 */
export function asMutationFile(value: unknown): MutationFile {
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    isTextList((value as Record<string, unknown>).targets) &&
    Array.isArray((value as Record<string, unknown>).mutations) &&
    ((value as Record<string, unknown>).mutations as unknown[]).every(
      isMutation,
    )
  )
    return value as MutationFile;
  throw new Error(
    'does not default-export mutationFile({ targets, mutations })',
  );
}
```

- [ ] **Step 4: Run green**

Run: `npx vitest run tests/unit/mutation-file.test.ts --reporter=default`. Expected: 22 passed.

### Task 2: The runner's logic and `runFile`

**Files:**

- Create: `scripts/mutate-reporter.ts`
- Create: `scripts/mutate.ts` (the pure functions and `runFile`; Task 3 appends the rest)
- Test: `tests/unit/mutate-reporter.test.ts`, `tests/unit/mutate.test.ts`, `tests/unit/mutate-run.test.ts`

**Interfaces:**

- Consumes: Task 1's types; `Observation` from `scripts/record-floors.ts`.
- Produces: `REPORT_ENV = 'MUTATE_REPORT'`, `Written { total; files; failing: Record<string, string>; timedOut }`, `reportOf(modules, root)` and the default-export reporter class; `Report { total; files; failing: ReadonlyMap<string, string>; timedOut }`, `readReport(json)`, `plant(text, anchor, replacement)`, `suiteOf(targets, listings)`, `laptopRefusal(suite, ci)`, `CorpusPrediction`, `corpusPredictions(observations, floors, excluded)`, `judge(mutation, corpus, report, baselineTotal)`, `MutableSuite { name; config: string | undefined }`, `RunRequest { suite; json; log; recordTo?; related? }`, `RunOutcome { json: unknown; log; ceilingHit }`, `Io`, `CEILING_SECONDS = 600`, `runFile(io, path, file, suites): Promise<{ matched; rows }>`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  reportOf,
  type ErrorView,
  type ModuleView,
  type Written,
} from '../../scripts/mutate-reporter';

/**
 * The mutation runner's own vitest reporter (#527, spec §4a): what it writes
 * from the test modules of a run. Vitest's JSON keeps only a failure's
 * headline, cut at about 30 characters; the error objects a reporter
 * receives carry the whole diff, and say when a test timed out.
 */

const ROOT = '/repo';
const FILE = 'tests/guards/reader.test.ts';

function testCase(fullName: string, state: string, errors: ErrorView[] = []) {
  return { fullName, result: () => ({ state, errors }) };
}

function module(
  tests: ReturnType<typeof testCase>[],
  errors: ErrorView[] = [],
  moduleId = `${ROOT}/${FILE}`,
): ModuleView {
  return {
    moduleId,
    errors: () => errors,
    children: { allTests: () => tests },
  };
}

describe('reportOf', () => {
  it('counts every test, skipped ones too, and names every file', () => {
    expect(
      reportOf(
        [module([testCase('a > b', 'passed'), testCase('a > c', 'skipped')])],
        ROOT,
      ),
    ).toEqual<Written>({ total: 2, files: [FILE], failing: {}, timedOut: [] });
  });

  it('keeps a failure’s whole text: message, diff, actual and expected', () => {
    expect(
      reportOf(
        [
          module([
            testCase('reader > reads every item', 'failed', [
              {
                message: 'expected [ { …(3) } ] to deeply equal []',
                diff: '- []\n+ [ { "id": "reader/items" } ]',
                actual: '[ { "id": "reader/items" } ]',
                expected: '[]',
              },
            ]),
          ]),
        ],
        ROOT,
      ).failing,
    ).toEqual({
      [`${FILE} › reader > reads every item`]:
        'expected [ { …(3) } ] to deeply equal []\n- []\n+ [ { "id": "reader/items" } ]\n[ { "id": "reader/items" } ]\n[]',
    });
  });

  it('joins each error of a test that failed more than once', () => {
    expect(
      reportOf(
        [
          module([
            testCase('a', 'failed', [{ message: 'one' }, { message: 'two' }]),
          ]),
        ],
        ROOT,
      ).failing,
    ).toEqual({ [`${FILE} › a`]: 'one\ntwo' });
  });

  it('names a test that timed out', () => {
    expect(
      reportOf(
        [
          module([
            testCase('slow', 'failed', [
              {
                message:
                  'Test timed out in 1000ms.\nIf this is a long-running test, …',
              },
            ]),
          ]),
        ],
        ROOT,
      ).timedOut,
    ).toEqual([`${FILE} › slow`]);
  });

  it('does not take a failure that only mentions a timeout for one', () => {
    expect(
      reportOf(
        [
          module([
            testCase('quotes', 'failed', [
              {
                message: "expected 'Error: Test timed out in 1000ms.' to be ''",
              },
            ]),
            testCase('slow', 'failed', [
              { message: 'Test timed out in 1000ms.' },
            ]),
          ]),
        ],
        ROOT,
      ).timedOut,
    ).toEqual([`${FILE} › slow`]);
  });

  it('names a file that failed outside any test', () => {
    expect(
      reportOf(
        [module([], [{ message: '[PARSE_ERROR] Unexpected token' }])],
        ROOT,
      ).failing,
    ).toEqual({ [`${FILE} › (the file)`]: '[PARSE_ERROR] Unexpected token' });
  });

  it('refuses a file outside the root', () => {
    expect(() =>
      reportOf([module([], [], '/elsewhere/a.test.ts')], ROOT),
    ).toThrow('/elsewhere/a.test.ts is outside /repo');
  });
});
```

```ts
import { describe, expect, it } from 'vitest';
import type { Mutation } from '../../scripts/mutation-file';
import { floorBreach } from '../floors';
import { againstControl, searched } from '../searched';
import { watched } from '../watched';
import {
  corpusPredictions,
  judge,
  laptopRefusal,
  plant,
  readReport,
  suiteOf,
  type CorpusPrediction,
  type Report,
} from '../../scripts/mutate';

/**
 * The mutation runner's pure parts (#527, spec §4–§6): what its reporter's
 * file says, where an anchor lands, which suite a set runs in, which
 * whole-repo floors a planted mutation moves, and whether a run matched its
 * prediction. `main` wires them to real processes; the integration suite
 * runs it.
 */

const T = 'tests/guards/reader.test.ts';
const RED = `${T} › reader > reads every item`;

describe('readReport', () => {
  it('reads the total, the files, each failure’s text and the timed-out tests', () => {
    expect(
      readReport({
        total: 2,
        files: [T],
        failing: { [RED]: 'reader/items: read 3, recorded 4' },
        timedOut: [RED],
      }),
    ).toEqual<Report>({
      total: 2,
      files: [T],
      failing: [{ name: RED, text: 'reader/items: read 3, recorded 4' }],
      timedOut: [RED],
    });
  });

  it.each<[string, unknown, string]>([
    ['a report that is not an object', null, 'is not an object'],
    ['a list', [], 'is not an object'],
    [
      'a total that is not a count',
      { total: -1, files: [], failing: {}, timedOut: [] },
      'total is not a count',
    ],
    [
      'files that are not text',
      { total: 0, files: [1], failing: {}, timedOut: [] },
      'files is not a list of paths',
    ],
    [
      'a failure whose text is not text',
      { total: 1, files: [T], failing: { [RED]: 3 }, timedOut: [] },
      'failing is not a map of tests to text',
    ],
    [
      'timed-out tests that are not text',
      { total: 1, files: [T], failing: {}, timedOut: {} },
      'timedOut is not a list of tests',
    ],
  ])('refuses %s', (_case, json, refusal) => {
    expect(() => readReport(json)).toThrow(
      `the runner's report is not readable: ${refusal}`,
    );
  });
});

describe('plant', () => {
  it('replaces an anchor that occurs exactly once', () => {
    expect(plant('a\nb\nc\n', 'b\n', 'B\n')).toEqual({ text: 'a\nB\nc\n' });
  });

  it.each<[string, string, number]>([
    ['an anchor that is missing', 'a\nc\n', 0],
    ['an anchor that occurs twice', 'b\nb\n', 2],
  ])('refuses %s, with its count', (_case, text, matches) => {
    expect(plant(text, 'b\n', 'B\n')).toEqual({ matches });
  });

  it('keeps a replacement holding $ patterns as written', () => {
    expect(plant('x = 1;', '1', "'$&$1'")).toEqual({ text: "x = '$&$1';" });
  });
});

describe('suiteOf', () => {
  const listings = new Map<string, readonly string[]>([
    ['unit suite', ['tests/unit/a.test.ts']],
    ['guards suite', [T, 'tests/guards/b.test.ts']],
  ]);

  it('finds the one suite that lists every target', () => {
    expect(suiteOf([T, 'tests/guards/b.test.ts'], listings)).toEqual({
      suite: 'guards suite',
    });
  });

  it('refuses a target no suite lists', () => {
    expect(suiteOf(['apps/web/test/game.test.ts'], listings)).toEqual({
      refusal:
        'apps/web/test/game.test.ts is in no suite the runner can run (the harness and Playwright suites wait on #649)',
    });
  });

  it('refuses a target two suites list', () => {
    const both = new Map([...listings, ['pacing suite', [T]]]);
    expect(suiteOf([T], both)).toEqual({
      refusal: `${T} is listed by guards suite and pacing suite`,
    });
  });

  it('refuses targets in different suites', () => {
    expect(suiteOf([T, 'tests/unit/a.test.ts'], listings)).toEqual({
      refusal: `the targets are in more than one suite: ${T} in guards suite, tests/unit/a.test.ts in unit suite`,
    });
  });
});

describe('laptopRefusal', () => {
  it('lets the unit suite run on the laptop', () => {
    expect(laptopRefusal('unit suite', false)).toBeUndefined();
  });

  it('refuses any other suite on the laptop', () => {
    expect(laptopRefusal('pacing suite', false)).toBe(
      'pacing suite: the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it',
    );
  });

  it('lets any suite run in CI', () => {
    expect(laptopRefusal('pacing suite', true)).toBeUndefined();
  });
});

describe('corpusPredictions', () => {
  const floors = { 'line-of/accesses': 100, 'reader/items': 4 };
  const NONE = new Set<string>();

  it('predicts a whole-repo floor that grew, with both figures', () => {
    expect(
      corpusPredictions(
        [
          {
            id: 'line-of/accesses',
            actual: 102,
            site: 'tests/guards/line-of.test.ts:39',
          },
        ],
        floors,
        NONE,
      ),
    ).toEqual<CorpusPrediction[]>([
      {
        file: 'tests/guards/line-of.test.ts',
        id: 'line-of/accesses',
        actual: 102,
        recorded: 100,
        text: 'line-of/accesses: read 102, recorded 100',
      },
    ]);
  });

  it('predicts a whole-repo floor that fell', () => {
    expect(
      corpusPredictions(
        [
          {
            id: 'line-of/accesses',
            actual: 97,
            site: 'tests/guards/line-of.test.ts:39',
          },
        ],
        floors,
        NONE,
      ).map((p) => p.text),
    ).toEqual(['line-of/accesses: read 97, recorded 100']);
  });

  it('predicts nothing for a floor at its recorded figure, beside one that moved', () => {
    expect(
      corpusPredictions(
        [
          {
            id: 'line-of/accesses',
            actual: 100,
            site: 'tests/guards/line-of.test.ts:39',
          },
          { id: 'reader/items', actual: 3, site: `${T}:12` },
        ],
        floors,
        NONE,
      ).map((p) => p.id),
    ).toEqual(['reader/items']);
  });

  it('predicts an id no floor file records', () => {
    expect(
      corpusPredictions(
        [{ id: 'new/thing', actual: 3, site: 'tests/guards/new.test.ts:9' }],
        floors,
        NONE,
      ).map((p) => p.text),
    ).toEqual(['new/thing is not recorded']);
  });

  it('leaves out a floor checked in an excluded file (a target or an importer)', () => {
    expect(
      corpusPredictions(
        [
          { id: 'reader/items', actual: 3, site: `${T}:12` },
          {
            id: 'line-of/accesses',
            actual: 102,
            site: 'tests/guards/line-of.test.ts:39',
          },
        ],
        floors,
        new Set([T]),
      ).map((p) => p.id),
    ).toEqual(['line-of/accesses']);
  });

  it('predicts one moved floor once, however often it was checked', () => {
    const seen = {
      id: 'line-of/accesses',
      actual: 102,
      site: 'tests/guards/line-of.test.ts:39',
    };
    expect(corpusPredictions([seen, seen], floors, NONE)).toHaveLength(1);
  });

  it('refuses a site it cannot read a file from', () => {
    expect(() =>
      corpusPredictions(
        [{ id: 'line-of/accesses', actual: 1, site: 'nowhere' }],
        floors,
        NONE,
      ),
    ).toThrow(
      'cannot read a file:line from the site "nowhere" of line-of/accesses',
    );
  });
});

describe('judge', () => {
  const MUTATION: Mutation = {
    name: 'reader-blind',
    file: 'src/reader.ts',
    anchor: 'xs',
    replacement: 'xs.slice(1)',
    red: { [RED]: 'reader/items' },
  };
  const CORPUS: CorpusPrediction = {
    file: 'tests/guards/count.test.ts',
    id: 'count/reads',
    actual: 6,
    recorded: 5,
    text: 'count/reads: read 6, recorded 5',
  };
  const COUNTED = 'tests/guards/count.test.ts › counts every read';
  const run = (
    failing: [string, string][],
    total = 9,
    timedOut: string[] = [],
  ): Report => ({
    total,
    files: [T],
    failing: failing.map(([name, text]) => ({ name, text })),
    timedOut,
  });
  const OTHER_RED = `${T} › reader > reads nothing twice`;

  // The judge is handed watched failing tests, so each search names the
  // failing tests it actually read (#368's watched), not the fixture's size.
  it('matches a run that failed exactly as predicted', () => {
    const { items, read } = watched(
      run([
        [RED, 'reader/items: read 3, recorded 4'],
        [OTHER_RED, 'reader/twice: read 2, recorded 1'],
      ]).failing,
      'name',
    );
    const both = {
      ...MUTATION,
      red: { [RED]: 'reader/items', [OTHER_RED]: 'reader/twice' },
    };
    expect(
      searched(judge(both, [], { ...run([]), failing: items }, 9), {
        of: read,
        what: 'failing tests the judge read',
      }),
    ).toEqual([]);
    expect(
      floorBreach('mutate-judge/exact-match', read.length),
    ).toBeUndefined();
  });

  it('matches a whole-repo floor the corpus prediction accounts for', () => {
    const { items, read } = watched(
      run([
        [RED, 'reader/items: read 3, recorded 4'],
        [COUNTED, 'count/reads: read 6, recorded 5. The population grew by 1'],
      ]).failing,
      'name',
    );
    expect(
      searched(judge(MUTATION, [CORPUS], { ...run([]), failing: items }, 9), {
        of: read,
        what: 'failing tests the judge read',
      }),
    ).toEqual([]);
    expect(
      floorBreach('mutate-judge/corpus-match', read.length),
    ).toBeUndefined();
  });

  it('misses that same run without the corpus prediction', () => {
    expect(
      judge(
        MUTATION,
        [],
        run([
          [RED, 'reader/items: read 3, recorded 4'],
          [
            COUNTED,
            'count/reads: read 6, recorded 5. The population grew by 1',
          ],
        ]),
        9,
      ),
    ).toEqual([
      `unpredicted red: ${COUNTED}: count/reads: read 6, recorded 5. The population grew by 1`,
    ]);
  });

  it('misses a corpus prediction no failing test shows', () => {
    expect(
      judge(
        MUTATION,
        [CORPUS],
        run([[RED, 'reader/items: read 3, recorded 4']]),
        9,
      ),
    ).toEqual([
      'whole-repo floor stayed green: count/reads 5 → 6 in tests/guards/count.test.ts',
    ]);
  });

  it('does not let a corpus prediction account for a failure in another file', () => {
    const other = 'tests/guards/other.test.ts › also';
    expect(
      judge(
        MUTATION,
        [CORPUS],
        run([
          [RED, 'reader/items: read 3, recorded 4'],
          [COUNTED, 'count/reads: read 6, recorded 5'],
          [other, 'count/reads: read 6, recorded 5'],
        ]),
        9,
      ),
    ).toEqual([`unpredicted red: ${other}: count/reads: read 6, recorded 5`]);
  });

  it('misses a predicted test that stayed green', () => {
    expect(judge(MUTATION, [], run([]), 9)).toEqual([
      `predicted red, stayed green: ${RED}`,
    ]);
  });

  it('misses a predicted test red for another reason, with its first line', () => {
    expect(
      judge(
        MUTATION,
        [],
        run([[RED, '\nTypeError: x is undefined\n  at y']]),
        9,
      ),
    ).toEqual([
      `red for another reason: ${RED} (wanted "reader/items"): TypeError: x is undefined`,
    ]);
  });

  it('prints the first line of a failure without its terminal colours', () => {
    const coloured = `${String.fromCharCode(27)}[31m[PARSE_ERROR] ${String.fromCharCode(27)}[0mUnexpected token`;
    expect(
      judge({ ...MUTATION, red: {} }, [], run([[RED, coloured]]), 9),
    ).toEqual([`unpredicted red: ${RED}: [PARSE_ERROR] Unexpected token`]);
  });

  it('matches a mutation predicted green that stayed green', () => {
    expect(
      againstControl(
        (failing: [string, string][]) =>
          judge({ ...MUTATION, red: {} }, [], run(failing), 9),
        { input: [], control: [[RED, 'reader/items: read 3, recorded 4']] },
      ),
    ).toEqual([]);
  });

  it('misses a moved total', () => {
    expect(
      judge(
        MUTATION,
        [],
        run([[RED, 'reader/items: read 3, recorded 4']], 8),
        9,
      ),
    ).toEqual(['the total moved: 8 tests, not 9']);
  });

  it('misses a timed-out test', () => {
    expect(
      judge(
        MUTATION,
        [],
        run([[RED, 'reader/items: read 3, recorded 4']], 9, [RED]),
        9,
      ),
    ).toEqual([`1 test timed out: ${RED}`]);
  });

  it('misses a run that wrote no report', () => {
    expect(judge(MUTATION, [], undefined, 9)).toEqual([
      'no report: the run ended before the reporter wrote one',
    ]);
  });
});
```

```ts
import { describe, expect, it } from 'vitest';
import type { Mutation, MutationFile } from '../../scripts/mutation-file';
import {
  runFile,
  type Io,
  type MutableSuite,
  type RunOutcome,
  type RunRequest,
} from '../../scripts/mutate';
import type { Written } from '../../scripts/mutate-reporter';
import type { Observation } from '../../scripts/record-floors';

/**
 * `runFile` (#527, spec §4): one mutation file from load to verdict, driven
 * here through a stand-in `Io` that holds files in memory and answers each
 * suite run from a script. No process starts and no tree is read; the
 * integration suite runs the real thing.
 */

const UNIT: MutableSuite = { name: 'unit suite', config: undefined };
const GUARDS: MutableSuite = {
  name: 'guards suite',
  config: 'vitest.guards.config.ts',
};
const SUITES = [UNIT, GUARDS];

const SRC = 'src/reader.ts';
const TARGET = 'tests/unit/reader.test.ts';
const GUARD = 'tests/guards/reader.test.ts';
const RED = `${TARGET} › reader > reads every item`;
const ORIGINAL = 'export const readAll = (xs) => xs;\n';

const MUTATION: Mutation = {
  name: 'reader-blind',
  file: SRC,
  anchor: '=> xs;',
  replacement: '=> xs.slice(1);',
  red: { [RED]: 'reader/items' },
};

const FILE: MutationFile = { targets: [TARGET], mutations: [MUTATION] };

interface Answer {
  readonly failing?: readonly [string, string][];
  readonly total?: number;
  readonly files?: readonly string[];
  readonly timedOut?: readonly string[];
  readonly ceilingHit?: boolean;
  readonly noReport?: boolean;
  readonly observations?: readonly Observation[];
}

/** What the runner's reporter would write for `answer`. */
function written(answer: Answer): Written {
  return {
    total: answer.total ?? 9,
    files: [...(answer.files ?? [])],
    failing: Object.fromEntries(answer.failing ?? []),
    timedOut: [...(answer.timedOut ?? [])],
  };
}

interface Stand {
  readonly io: Io;
  readonly runs: RunRequest[];
  readonly printed: string[];
  readonly files: Map<string, string>;
  /** The text of the mutated file each run saw. */
  readonly seen: string[];
  readonly guarded: string[];
}

function stand(
  answers: readonly Answer[],
  options: {
    ci?: boolean;
    listings?: ReadonlyMap<string, readonly string[]>;
    untracked?: readonly string[];
    dirty?: readonly string[];
    floors?: Readonly<Record<string, number>>;
    restoreFails?: boolean;
    /** Report the mutated file changed against HEAD once every run is done. */
    dirtyAtEnd?: boolean;
  } = {},
): Stand {
  const files = new Map([[SRC, ORIGINAL]]);
  const runs: RunRequest[] = [];
  const printed: string[] = [];
  const seen: string[] = [];
  const guarded: string[] = [];
  const observed = new Map<string, readonly Observation[]>();
  const listings =
    options.listings ??
    new Map([
      ['unit suite', [TARGET]],
      ['guards suite', [GUARD]],
    ]);
  let next = 0;
  let writes = 0;
  const io: Io = {
    ci: options.ci ?? false,
    root: '/repo',
    read: (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`no file ${path}`);
      return new TextEncoder().encode(text);
    },
    write: (path, bytes) => {
      writes += 1;
      if (options.restoreFails === true && writes === 2) return;
      files.set(path, new TextDecoder().decode(bytes));
    },
    tracked: (path) => !(options.untracked ?? []).includes(path),
    clean: (path) =>
      !(options.dirty ?? []).includes(path) &&
      !(options.dirtyAtEnd === true && next === answers.length) &&
      (path !== SRC || files.get(SRC) === ORIGINAL),
    list: (suite) => listings.get(suite.name) ?? [],
    run: (request) => {
      runs.push(request);
      seen.push(files.get(SRC) ?? '');
      const answer = answers[next];
      next += 1;
      if (answer === undefined)
        // So a test scripting no runs proves, by its exact refusal, that
        // nothing ran before the refusal: a run would throw this instead.
        throw new Error(`no answer scripted for run ${String(next)}`);
      if (request.recordTo !== undefined)
        observed.set(request.recordTo, answer.observations ?? []);
      const outcome: RunOutcome = {
        json: answer.noReport === true ? undefined : written(answer),
        log: '',
        ceilingHit: answer.ceilingHit ?? false,
      };
      return Promise.resolve(outcome);
    },
    observations: (path) => observed.get(path) ?? [],
    floors: () => options.floors ?? {},
    guard: (path) => guarded.push(`guard ${path}`),
    release: (path) => guarded.push(`release ${path}`),
    print: (line) => printed.push(line),
  };
  return { io, runs, printed, files, seen, guarded };
}

const GREEN: Answer = { files: [TARGET] };
const BLIND: Answer = {
  files: [TARGET],
  failing: [[RED, 'reader/items: read 3, recorded 4']],
};

describe('runFile', () => {
  it('runs the baseline, then the mutation planted, and matches its prediction', async () => {
    const s = stand([GREEN, BLIND]);
    expect(await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES)).toEqual({
      matched: 1,
      rows: 1,
    });
    expect(s.seen).toEqual([
      ORIGINAL,
      'export const readAll = (xs) => xs.slice(1);\n',
    ]);
    expect(s.files.get(SRC)).toBe(ORIGINAL);
    expect(s.printed.at(-2)).toBe('ok   reader-blind');
    expect(s.printed.at(-1)).toBe('tests/mutations/x.ts: 1 of 1 matched');
  });

  it('writes each run’s report and log under .mutations/<file stem>/', async () => {
    const s = stand([GREEN, BLIND]);
    await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES);
    expect(s.runs.map((r) => [r.suite.name, r.json, r.log])).toEqual([
      ['unit suite', '.mutations/x/baseline.json', '.mutations/x/baseline.log'],
      [
        'unit suite',
        '.mutations/x/reader-blind.json',
        '.mutations/x/reader-blind.log',
      ],
    ]);
  });

  it('guards the planted file while it differs from HEAD, and releases it', async () => {
    const s = stand([GREEN, BLIND]);
    await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES);
    expect(s.guarded).toEqual([`guard ${SRC}`, `release ${SRC}`]);
  });

  it('prints each way a row missed, and counts it unmatched', async () => {
    const s = stand([GREEN, GREEN]);
    expect(await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES)).toEqual({
      matched: 0,
      rows: 1,
    });
    expect(s.printed.slice(-3)).toEqual([
      'MISS reader-blind',
      `  predicted red, stayed green: ${RED}`,
      'tests/mutations/x.ts: 0 of 1 matched',
    ]);
  });

  it('misses a row whose anchor does not occur once, and runs nothing for it', async () => {
    const s = stand([GREEN]);
    const file: MutationFile = {
      ...FILE,
      mutations: [{ ...MUTATION, anchor: 'nowhere' }],
    };
    expect(await runFile(s.io, 'tests/mutations/x.ts', file, SUITES)).toEqual({
      matched: 0,
      rows: 1,
    });
    expect(s.runs).toHaveLength(1);
    expect(s.printed).toContain(`ANCHOR reader-blind: 0 matches in ${SRC}`);
  });

  it('misses a run stopped at the ceiling, naming the suite', async () => {
    const s = stand([GREEN, { ...BLIND, ceilingHit: true }]);
    await runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES);
    expect(s.printed).toContain(
      '  unit suite ran past the 600 s ceiling and was stopped',
    );
    expect(s.files.get(SRC)).toBe(ORIGINAL);
  });

  it('puts the file back when the run throws', async () => {
    const s = stand([GREEN]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow('no answer scripted for run 2');
    expect(s.files.get(SRC)).toBe(ORIGINAL);
    expect(s.guarded).toEqual([`guard ${SRC}`, `release ${SRC}`]);
  });

  it('stops when the file does not read back as it was', async () => {
    const s = stand([GREEN, BLIND], { restoreFails: true });
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(`${SRC} did not read back as it was before reader-blind`);
  });

  it('refuses at the end a mutated file that differs from HEAD', async () => {
    const s = stand([GREEN, BLIND], { dirtyAtEnd: true });
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      `tests/mutations/x.ts: ${SRC} differs from HEAD after every mutation was put back`,
    );
  });

  it.each<[string, Parameters<typeof stand>[1], string]>([
    [
      'an untracked target',
      { untracked: [TARGET] },
      `${TARGET} is not tracked`,
    ],
    [
      'a mutated file with changes against HEAD',
      { dirty: [SRC] },
      `${SRC} differs from HEAD: commit or restore it first`,
    ],
    [
      'targets in no suite it can run',
      { listings: new Map() },
      `${TARGET} is in no suite the runner can run (the harness and Playwright suites wait on #649)`,
    ],
  ])('refuses %s before running anything', async (_case, options, refusal) => {
    const s = stand([], options);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(`tests/mutations/x.ts: ${refusal}`);
  });

  it('refuses a malformed file before running anything', async () => {
    const s = stand([]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', { ...FILE, targets: [] }, SUITES),
    ).rejects.toThrow('tests/mutations/x.ts: names no targets');
  });

  it('refuses a non-unit suite on the laptop before running anything', async () => {
    const s = stand([], {
      listings: new Map([['guards suite', [TARGET]]]),
    });
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      'tests/mutations/x.ts: guards suite: the laptop runs the unit suite only',
    );
  });

  it('refuses a red baseline, naming each failure, and plants nothing', async () => {
    const s = stand([{ files: [TARGET], failing: [[RED, 'boom']] }]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      `tests/mutations/x.ts: the unit suite is red before any mutation:\n  ${RED}: boom`,
    );
    expect(s.runs).toHaveLength(1);
  });

  it('refuses a baseline with a timed-out test', async () => {
    const s = stand([
      {
        ...GREEN,
        failing: [[RED, 'Test timed out in 1000ms.']],
        timedOut: [RED],
      },
    ]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      `the unit suite is red before any mutation:\n  ${RED}: Test timed out in 1000ms.\n  1 test timed out: ${RED}`,
    );
  });

  it('refuses a baseline that wrote no report', async () => {
    const s = stand([{ noReport: true }]);
    await expect(
      runFile(s.io, 'tests/mutations/x.ts', FILE, SUITES),
    ).rejects.toThrow(
      'the unit suite is red before any mutation:\n  no report: the run ended before the reporter wrote one',
    );
  });
});

describe('runFile in the guards suite (CI)', () => {
  const COUNT = 'tests/guards/count.test.ts';
  const OTHER = 'tests/guards/helper.test.ts';
  const GUARD_RED = `${GUARD} › reader > reads every item`;
  // The helper guard imports the mutated file, so its moved floor is the
  // author's to predict: no corpus prediction accounts for it.
  const PREDICTED = {
    [GUARD_RED]: 'reader/items',
    [`${OTHER} › helps`]: 'helper/items',
  };
  const GUARD_FILE: MutationFile = {
    targets: [GUARD],
    mutations: [
      { ...MUTATION, red: PREDICTED },
      { ...MUTATION, name: 'reader-blind-again', red: PREDICTED },
    ],
  };
  const observations: Observation[] = [
    { id: 'count/reads', actual: 6, site: `${COUNT}:12` },
    { id: 'reader/items', actual: 3, site: `${GUARD}:20` },
    { id: 'helper/items', actual: 1, site: `${OTHER}:8` },
  ];
  const floors = { 'count/reads': 5, 'reader/items': 4, 'helper/items': 2 };
  const judged: Answer = {
    files: [GUARD],
    failing: [
      [GUARD_RED, 'reader/items: read 3, recorded 4'],
      [`${COUNT} › counts every read`, 'count/reads: read 6, recorded 5'],
      [`${OTHER} › helps`, 'helper/items: read 1, recorded 2'],
    ],
  };
  const related: Answer = { files: [GUARD, OTHER] };

  it('lists the importers once, records, and predicts only floors outside targets and importers', async () => {
    const s = stand(
      [GREEN, related, { observations }, judged, { observations }, judged],
      { ci: true, floors, listings: new Map([['guards suite', [GUARD]]]) },
    );
    expect(
      await runFile(s.io, 'tests/mutations/g.ts', GUARD_FILE, SUITES),
    ).toEqual({
      matched: 2,
      rows: 2,
    });
    expect(
      s.runs.map((r) => [r.json, r.related ?? null, r.recordTo ?? null]),
    ).toEqual([
      ['.mutations/g/baseline.json', null, null],
      ['.mutations/g/importers-1.json', SRC, null],
      [
        '.mutations/g/reader-blind.record.json',
        null,
        '.mutations/g/reader-blind.observations.jsonl',
      ],
      ['.mutations/g/reader-blind.json', null, null],
      [
        '.mutations/g/reader-blind-again.record.json',
        null,
        '.mutations/g/reader-blind-again.observations.jsonl',
      ],
      ['.mutations/g/reader-blind-again.json', null, null],
    ]);
    expect(
      s.printed.filter((line) => line.includes('whole-repo floor')),
    ).toEqual([
      '  whole-repo floor: count/reads 5 → 6, tests/guards/count.test.ts',
      '  whole-repo floor: count/reads 5 → 6, tests/guards/count.test.ts',
    ]);
  });

  it('lists importers on the unmutated tree and records on the mutated one', async () => {
    const s = stand(
      [GREEN, related, { observations }, judged, { observations }, judged],
      { ci: true, floors, listings: new Map([['guards suite', [GUARD]]]) },
    );
    await runFile(s.io, 'tests/mutations/g.ts', GUARD_FILE, SUITES);
    expect(s.seen.slice(1, 4)).toEqual([
      ORIGINAL,
      'export const readAll = (xs) => xs.slice(1);\n',
      'export const readAll = (xs) => xs.slice(1);\n',
    ]);
  });
});
```

- [ ] **Step 2: Plant a throwing stub and run red**

Generate the stub from the implementation with every exported function's body replaced by `throw new Error('stub');` (`.superpowers/sdd/527/make-stub.py`). Run the three files. Expected: every test red on `stub`, none passing (measured on v2 with Task 3's file: 77 failed, 0 passed, every printed error the stub's).

- [ ] **Step 3: Write the implementation.** The reporter:

```ts
/**
 * The mutation runner's own vitest reporter (#527, spec §4a). Vitest's JSON
 * reporter keeps only a failure's headline, cutting strings at about 30
 * characters and printing objects as `[ …(n) ]`, so a prediction could never
 * name a floor id past the cut or a guard's finding. The error objects a
 * reporter receives carry the whole diff, and a timed-out test's message
 * says so, where the log's own words can be quoted by a code frame.
 *
 * `scripts/mutate.ts` runs every suite with `--reporter=<this file>` and
 * `MUTATE_REPORT=<path>`; at the end of the run this writes `Written` there.
 */
import { writeFileSync } from 'node:fs';
import { posix, relative, sep } from 'node:path';
import type { Reporter, TestModule, Vitest } from 'vitest/node';

/** The environment variable naming the file the report is written to. */
export const REPORT_ENV = 'MUTATE_REPORT';

/** What the reporter writes: the run as the runner judges it. */
export interface Written {
  /** Every test the run collected, skipped ones too. */
  readonly total: number;
  /** Every test file the run reported, repository-relative. */
  readonly files: readonly string[];
  /** Each failing test, `<file> › <describe> > … > <title>`, to its whole error text. */
  readonly failing: Readonly<Record<string, string>>;
  /** The failing tests that timed out. */
  readonly timedOut: readonly string[];
}

/** As much of vitest's `TestError` as the report reads. */
export interface ErrorView {
  readonly message: string;
  readonly diff?: string;
  readonly actual?: string;
  readonly expected?: string;
}

/** As much of vitest's `TestModule` as the report reads. */
export interface ModuleView {
  readonly moduleId: string;
  errors(): readonly ErrorView[];
  readonly children: {
    allTests(): Iterable<{
      readonly fullName: string;
      result(): {
        readonly state: string;
        readonly errors?: readonly ErrorView[];
      };
    }>;
  };
}

/** How vitest begins a timed-out test's error. */
const TIMED_OUT = 'Test timed out in ';

const textOf = (errors: readonly ErrorView[]): string =>
  errors
    .flatMap((e) => [e.message, e.diff, e.actual, e.expected])
    .filter((part): part is string => part !== undefined && part !== '')
    .join('\n');

/** The report of a run's modules, file names relative to `root`. */
export function reportOf(
  modules: readonly ModuleView[],
  root: string,
): Written {
  let total = 0;
  const files: string[] = [];
  const failing: Record<string, string> = {};
  const timedOut: string[] = [];
  for (const m of modules) {
    const file = relative(root, m.moduleId).split(sep).join(posix.sep);
    if (file.startsWith('..') || file === '')
      throw new Error(`${m.moduleId} is outside ${root}`);
    files.push(file);
    for (const testCase of m.children.allTests()) {
      total += 1;
      const result = testCase.result();
      if (result.state !== 'failed') continue;
      const errors = result.errors ?? [];
      const name = `${file} › ${testCase.fullName}`;
      failing[name] = textOf(errors);
      if (errors.some((e) => e.message.startsWith(TIMED_OUT)))
        timedOut.push(name);
    }
    const loadErrors = m.errors();
    if (loadErrors.length > 0)
      failing[`${file} › (the file)`] = textOf(loadErrors);
  }
  return { total, files, failing, timedOut };
}

/** Writes the run's report to the file `MUTATE_REPORT` names. */
export default class MutateReporter implements Reporter {
  private root = '';

  onInit(vitest: Vitest): void {
    this.root = vitest.config.root;
  }

  onTestRunEnd(testModules: readonly TestModule[]): void {
    const path = process.env[REPORT_ENV];
    if (path === undefined || path === '')
      throw new Error(`${REPORT_ENV} names no file for the mutation report`);
    writeFileSync(path, JSON.stringify(reportOf(testModules, this.root)));
  }
}
```

and `scripts/mutate.ts` down to the end of `runFile` (Task 3's block below shows the complete file).

- [ ] **Step 4: Run green.** Expected: every test in the three files passes.

### Task 3: Suites, the real `Io`, `main`, and the wiring

**Files:**

- Modify: `scripts/record-floors.ts` (`Suite.mutate`, and a `mutate` config on the unit, guards, integration, properties, logs and pacing suites)
- Modify: `scripts/mutate.ts` (append `mutableSuites`, `vitestArgs`, `runEnv`, `readObservations`, `realIo`)
- Create: `scripts/mutate-cli.ts` (`main`: it imports each mutation file by a run-time path, so it lives where no test loads it)
- Modify: `package.json` (`"mutate": "node scripts/mutate.ts"`), `.gitignore` (`.mutations/`), `tests/integration/script-loads.test.ts` (`'scripts/mutate.ts'`), `CLAUDE.md` (the Flow bullet)
- Test: `tests/unit/mutate-suites.test.ts`

**Interfaces:**

- Produces: `mutableSuites(suites: readonly Suite[]): MutableSuite[]`; `vitestArgs(request, reporter)`; `runEnv(base, request, root)`; `readObservations(text, path)`; `realIo({ root, ci, suites, floorsDir }): Io & { restoreAll }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  mutableSuites,
  readObservations,
  runEnv,
  vitestArgs,
  type MutableSuite,
  type RunRequest,
} from '../../scripts/mutate';
import { RECORD_ENV, SUITES, type Suite } from '../../scripts/record-floors';
import { REPORT_ENV } from '../../scripts/mutate-reporter';

/**
 * The suites the mutation runner can run (#527, spec §5), and how it runs
 * them: the six vitest suites run from the root, each under its own config,
 * with both reporters, recording floors only when asked. The harness and
 * Playwright suites wait on #649.
 */

const SUITE: Suite = {
  name: 'guards suite',
  cwd: '.',
  list: ['npx', 'vitest', 'list'],
  files: () => [],
  run: ['npm', 'run', 'test:guards'],
};

describe('mutableSuites', () => {
  it('keeps a suite with a mutate config, under its name', () => {
    expect(
      mutableSuites([
        { ...SUITE, mutate: { config: 'vitest.guards.config.ts' } },
      ]),
    ).toEqual([{ name: 'guards suite', config: 'vitest.guards.config.ts' }]);
  });

  it('keeps a suite run under vitest’s default config', () => {
    expect(
      mutableSuites([{ ...SUITE, name: 'unit suite', mutate: {} }]),
    ).toEqual([{ name: 'unit suite', config: undefined }]);
  });

  it('leaves out a suite with no mutate command', () => {
    expect(
      mutableSuites([SUITE, { ...SUITE, name: 'unit suite', mutate: {} }]),
    ).toEqual([{ name: 'unit suite', config: undefined }]);
  });

  it('refuses a mutable suite that does not run from the root', () => {
    expect(() =>
      mutableSuites([{ ...SUITE, cwd: 'apps/web', mutate: {} }]),
    ).toThrow(
      'guards suite runs from apps/web: the runner runs suites from the root only (#649)',
    );
  });

  it('can run exactly the six root vitest suites, under their own configs', () => {
    expect(mutableSuites(SUITES)).toEqual([
      { name: 'unit suite', config: undefined },
      { name: 'guards suite', config: 'vitest.guards.config.ts' },
      { name: 'integration suite', config: 'vitest.integration.config.ts' },
      { name: 'properties suite', config: 'vitest.properties.config.ts' },
      { name: 'logs suite', config: 'vitest.logs.config.ts' },
      { name: 'pacing suite', config: 'vitest.pacing.config.ts' },
    ]);
  });
});

const GUARDS: MutableSuite = {
  name: 'guards suite',
  config: 'vitest.guards.config.ts',
};
const RUN: RunRequest = {
  suite: GUARDS,
  json: '.mutations/x/blind.json',
  log: '.mutations/x/blind.log',
};

const REPORTER = '/runner/scripts/mutate-reporter.ts';

describe('vitestArgs', () => {
  it('runs the whole suite under its config, with the default and the runner’s reporters', () => {
    expect(vitestArgs(RUN, REPORTER)).toEqual([
      'vitest',
      'run',
      '-c',
      'vitest.guards.config.ts',
      '--reporter=default',
      `--reporter=${REPORTER}`,
    ]);
  });

  it('names no config for a suite under vitest’s default', () => {
    expect(
      vitestArgs(
        { ...RUN, suite: { name: 'unit suite', config: undefined } },
        REPORTER,
      ),
    ).toEqual([
      'vitest',
      'run',
      '--reporter=default',
      `--reporter=${REPORTER}`,
    ]);
  });

  it('lists the files importing a file, matching no test name', () => {
    expect(
      vitestArgs({ ...RUN, related: 'src/reader.ts' }, REPORTER).slice(0, 6),
    ).toEqual(['vitest', 'related', 'src/reader.ts', '--run', '-t', '^$']);
  });
});

describe('runEnv', () => {
  it('names the report file for the runner’s reporter', () => {
    expect(runEnv({ PATH: '/bin' }, RUN, '/repo')).toEqual({
      PATH: '/bin',
      [REPORT_ENV]: '/repo/.mutations/x/blind.json',
    });
  });

  it('records floors to the requested file', () => {
    expect(
      runEnv(
        { PATH: '/bin' },
        { ...RUN, recordTo: '.mutations/x/o.jsonl' },
        '/repo',
      ),
    ).toEqual({
      PATH: '/bin',
      [REPORT_ENV]: '/repo/.mutations/x/blind.json',
      [RECORD_ENV]: '/repo/.mutations/x/o.jsonl',
    });
  });

  it('drops a recording the caller inherited, so a judged run fails on floors', () => {
    expect(
      runEnv({ PATH: '/bin', [RECORD_ENV]: '/tmp/x' }, RUN, '/repo'),
    ).toEqual({ PATH: '/bin', [REPORT_ENV]: '/repo/.mutations/x/blind.json' });
  });
});

describe('readObservations', () => {
  it('reads one floor check a line', () => {
    expect(
      readObservations(
        '{"id":"a/b","actual":3,"site":"tests/guards/a.test.ts:9"}\n{"id":"c","actual":0,"site":"x.ts:1"}\n',
        'o.jsonl',
      ),
    ).toEqual([
      { id: 'a/b', actual: 3, site: 'tests/guards/a.test.ts:9' },
      { id: 'c', actual: 0, site: 'x.ts:1' },
    ]);
  });

  it('refuses a record that holds nothing', () => {
    expect(() => readObservations('', 'o.jsonl')).toThrow(
      'no floor check was recorded to o.jsonl',
    );
  });

  it('refuses a line that is not a floor check', () => {
    expect(() =>
      readObservations('{"id":"a","actual":-1,"site":"x.ts:1"}\n', 'o.jsonl'),
    ).toThrow(
      'o.jsonl holds a line that is not a floor check: {"id":"a","actual":-1,"site":"x.ts:1"}',
    );
  });
});
```

- [ ] **Step 2: Run red** against throwing stubs of the four pure functions. Expected: every test red on `stub` (measured in the v2 red run above: 77 of 77 across the four runner test files).

- [ ] **Step 3: Write the implementation.** The complete `scripts/mutate.ts`:

```ts
/**
 * The mutation runner (#527, spec `docs/superpowers/specs/
 * 2026-10-17-mutation-runner-design.md`): `npm run mutate -- <file>...`
 * plants each mutation of each tracked mutation file (`tests/mutations/`,
 * shaped by `scripts/mutation-file.ts`), runs the whole suite its targets
 * belong to, puts the file back, and judges the run against the prediction
 * written before it. Any row not as predicted fails the run; nothing is
 * retried.
 *
 * The functions here are pure, and the unit suite proves them; `main`
 * wires them to processes and files, and the integration suite runs it.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FILE_SEPARATOR,
  mutationFileProblems,
  type Mutation,
  type MutationFile,
} from './mutation-file.ts';
import {
  readFloorsDir,
  RECORD_ENV,
  type Observation,
  type Suite,
} from './record-floors.ts';
import { REPORT_ENV } from './mutate-reporter.ts';

/** The runner's reporter, by absolute path: a fixture repository runs it too. */
const REPORTER = fileURLToPath(
  new URL('./mutate-reporter.ts', import.meta.url),
);

/** A failing test: `<file> › <describe> > … > <title>`, and its whole error text. */
export interface FailedTest {
  readonly name: string;
  readonly text: string;
}

/** What one run reported, as far as a judge reads it (from `Written`). */
export interface Report {
  readonly total: number;
  /** Every test file the run reported, repository-relative. */
  readonly files: readonly string[];
  /** Each failing test, by full name, with its whole error text. */
  readonly failing: readonly FailedTest[];
  /** The failing tests that timed out. */
  readonly timedOut: readonly string[];
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const isCount = (x: unknown): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= 0;

const isTextList = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((each) => typeof each === 'string');

/**
 * Reads what the runner's reporter wrote (`scripts/mutate-reporter.ts`),
 * refusing any shape it does not know rather than reading it as a clean run.
 */
export function readReport(json: unknown): Report {
  const refuse = (why: string): never => {
    throw new Error(`the runner's report is not readable: ${why}`);
  };
  if (!isRecord(json)) return refuse('is not an object');
  if (!isCount(json.total)) return refuse('total is not a count');
  if (!isTextList(json.files)) return refuse('files is not a list of paths');
  const failing = json.failing;
  if (
    !isRecord(failing) ||
    !Object.values(failing).every((text) => typeof text === 'string')
  )
    return refuse('failing is not a map of tests to text');
  if (!isTextList(json.timedOut))
    return refuse('timedOut is not a list of tests');
  return {
    total: json.total,
    files: json.files,
    failing: Object.entries(failing as Record<string, string>).map(
      ([name, text]) => ({ name, text }),
    ),
    timedOut: json.timedOut,
  };
}

/** `n test(s) timed out: <names>`, or nothing. */
const timedOutLine = (timedOut: readonly string[]): string[] =>
  timedOut.length === 0
    ? []
    : [
        `${String(timedOut.length)} test${timedOut.length === 1 ? '' : 's'} timed out: ${timedOut.join(', ')}`,
      ];

export type Planted = { readonly text: string } | { readonly matches: number };

/** `text` with `anchor` replaced, or how often it occurs when that is not once. */
export function plant(
  text: string,
  anchor: string,
  replacement: string,
): Planted {
  const parts = text.split(anchor);
  if (parts.length !== 2) return { matches: parts.length - 1 };
  return { text: parts.join(replacement) };
}

export type SuiteChoice =
  { readonly suite: string } | { readonly refusal: string };

/** The one suite, of `listings` (suite name to the files it lists), that runs every target. */
export function suiteOf(
  targets: readonly string[],
  listings: ReadonlyMap<string, readonly string[]>,
): SuiteChoice {
  const found: [string, string][] = [];
  for (const target of targets) {
    const suites = [...listings]
      .filter(([, files]) => files.includes(target))
      .map(([name]) => name);
    if (suites.length === 0)
      return {
        refusal: `${target} is in no suite the runner can run (the harness and Playwright suites wait on #649)`,
      };
    if (suites.length > 1)
      return { refusal: `${target} is listed by ${suites.join(' and ')}` };
    found.push([target, suites[0] as string]);
  }
  const suites = new Set(found.map(([, suite]) => suite));
  if (suites.size > 1)
    return {
      refusal: `the targets are in more than one suite: ${found.map(([t, s]) => `${t} in ${s}`).join(', ')}`,
    };
  return { suite: found[0]?.[1] as string };
}

export const UNIT_SUITE = 'unit suite';

/** Why `suite` may not run here: the laptop runs the unit suite only. */
export function laptopRefusal(suite: string, ci: boolean): string | undefined {
  if (ci || suite === UNIT_SUITE) return undefined;
  return `${suite}: the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it`;
}

/** A whole-repo floor the planted text moves, and the text its failure shows. */
export interface CorpusPrediction {
  /** The file whose test checks the floor. */
  readonly file: string;
  readonly id: string;
  readonly actual: number;
  readonly recorded: number | undefined;
  /** What `floorBreach` says of it (`tests/floors.ts`). */
  readonly text: string;
}

/**
 * The floors a record-mode run of the guards suite saw away from their
 * recorded figures (spec §6), except those checked in `excluded`: the
 * targets, and every guard that imports the mutated file, whose moves are
 * the author's to predict.
 */
export function corpusPredictions(
  observations: readonly Observation[],
  floors: Readonly<Record<string, number>>,
  excluded: ReadonlySet<string>,
): CorpusPrediction[] {
  const predictions = new Map<string, CorpusPrediction>();
  for (const { id, actual, site } of observations) {
    const at = /^(.+):\d+$/.exec(site);
    if (at?.[1] === undefined)
      throw new Error(
        `cannot read a file:line from the site "${site}" of ${id}`,
      );
    const file = at[1];
    const recorded = floors[id];
    if (actual === recorded || excluded.has(file)) continue;
    const text =
      recorded === undefined
        ? `${id} is not recorded`
        : `${id}: read ${String(actual)}, recorded ${String(recorded)}`;
    predictions.set(`${file}\n${text}`, { file, id, actual, recorded, text });
  }
  return [...predictions.values()];
}

/** Terminal colour codes, which vitest leaves in some messages. */
const COLOURS = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

const firstLine = (message: string): string =>
  (
    message
      .replace(COLOURS, '')
      .split('\n')
      .find((line) => line.trim() !== '') ?? ''
  )
    .trim()
    .slice(0, 300);

const NO_REPORT = 'no report: the run ended before the reporter wrote one';

/**
 * Each way the run differs from the prediction; none means it matched. The
 * failing tests must be exactly the predicted ones, each red for its stated
 * reason, plus those a corpus prediction accounts for in its own file.
 */
export function judge(
  mutation: Mutation,
  corpus: readonly CorpusPrediction[],
  report: Report | undefined,
  baselineTotal: number,
): string[] {
  if (report === undefined) return [NO_REPORT];
  const problems: string[] = [...timedOutLine(report.timedOut)];
  if (report.total !== baselineTotal)
    problems.push(
      `the total moved: ${String(report.total)} tests, not ${String(baselineTotal)}`,
    );
  for (const [test, text] of Object.entries(mutation.red)) {
    const failed = report.failing.find((f) => f.name === test);
    if (failed === undefined)
      problems.push(`predicted red, stayed green: ${test}`);
    else if (!failed.text.includes(text))
      problems.push(
        `red for another reason: ${test} (wanted "${text}"): ${firstLine(failed.text)}`,
      );
  }
  const accounts = (p: CorpusPrediction, f: FailedTest) =>
    f.name.startsWith(`${p.file}${FILE_SEPARATOR}`) && f.text.includes(p.text);
  for (const p of corpus) {
    if (!report.failing.some((f) => accounts(p, f)))
      problems.push(
        `whole-repo floor stayed green: ${p.id} ${String(p.recorded)} → ${String(p.actual)} in ${p.file}`,
      );
  }
  for (const f of report.failing) {
    if (f.name in mutation.red) continue;
    if (corpus.some((p) => accounts(p, f))) continue;
    problems.push(`unpredicted red: ${f.name}: ${firstLine(f.text)}`);
  }
  return problems;
}

/** A suite the runner can run: its name in `SUITES`, and its vitest config (none: the default). */
export interface MutableSuite {
  readonly name: string;
  readonly config: string | undefined;
}

/** One vitest run of a whole suite. Paths are repository-relative. */
export interface RunRequest {
  readonly suite: MutableSuite;
  readonly json: string;
  readonly log: string;
  /** Record every floor check to this file (`FLOORS_RECORD`), failing none. */
  readonly recordTo?: string;
  /** List the suite's files that import this file, running no test. */
  readonly related?: string;
}

export interface RunOutcome {
  /** The parsed report the runner's reporter wrote; undefined when it wrote none. */
  readonly json: unknown;
  /** The default reporter's output. */
  readonly log: string;
  /** Whether the run passed the ceiling and was stopped. */
  readonly ceilingHit: boolean;
}

/** Everything `runFile` does outside its own logic, so a stand-in can drive it. */
export interface Io {
  /** Whether this is CI (`CI=true`), where every suite may run. */
  readonly ci: boolean;
  /** The repository root, as vitest names files (real path). */
  readonly root: string;
  read(path: string): Uint8Array;
  write(path: string, bytes: Uint8Array): void;
  tracked(path: string): boolean;
  /** Whether `path` is as HEAD has it. */
  clean(path: string): boolean;
  /** The suite's test files, repository-relative. */
  list(suite: MutableSuite): readonly string[];
  run(request: RunRequest): Promise<RunOutcome>;
  observations(path: string): readonly Observation[];
  floors(): Readonly<Record<string, number>>;
  /** Restore `path` to these bytes if the process is stopped while it is planted. */
  guard(path: string, bytes: Uint8Array): void;
  release(path: string): void;
  print(line: string): void;
}

export const CEILING_SECONDS = 600;
export const GUARDS_SUITE = 'guards suite';
export const LOG_DIR = '.mutations';

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

/** The problems of one suite run that is meant to be clean. */
function redBaseline(outcome: RunOutcome, suite: string): string[] {
  if (outcome.ceilingHit)
    return [
      `${suite} ran past the ${String(CEILING_SECONDS)} s ceiling and was stopped`,
    ];
  if (outcome.json === undefined) return [NO_REPORT];
  const report = readReport(outcome.json);
  return [
    ...report.failing.map((f) => `${f.name}: ${firstLine(f.text)}`),
    ...timedOutLine(report.timedOut),
  ];
}

/**
 * Runs one mutation file (spec §4): checks it, finds its suite, runs the
 * suite clean, then plants each mutation in turn, runs the whole suite, puts
 * the file back and judges the run. Refusals throw before anything is
 * planted; each row's verdict is printed, and the counts returned.
 */
export async function runFile(
  io: Io,
  path: string,
  file: MutationFile,
  suites: readonly MutableSuite[],
): Promise<{ readonly matched: number; readonly rows: number }> {
  const refuse = (why: string): never => {
    throw new Error(`${path}: ${why}`);
  };
  const problems = mutationFileProblems(file);
  if (problems.length > 0) refuse(problems.join('\n  '));
  const touched = [
    ...new Set([...file.targets, ...file.mutations.map((m) => m.file)]),
  ];
  for (const each of touched) {
    if (!io.tracked(each)) refuse(`${each} is not tracked`);
    if (!io.clean(each))
      refuse(`${each} differs from HEAD: commit or restore it first`);
  }
  const choice = suiteOf(
    file.targets,
    new Map(suites.map((s) => [s.name, io.list(s)])),
  );
  if ('refusal' in choice) return refuse(choice.refusal);
  const suite = suites.find((s) => s.name === choice.suite) as MutableSuite;
  const laptop = laptopRefusal(suite.name, io.ci);
  if (laptop !== undefined) refuse(laptop);

  const dir = `${LOG_DIR}/${posix.basename(path).replace(/\.[^.]*$/, '')}`;
  const at = (name: string, ext: string) => `${dir}/${name}.${ext}`;
  const baseline = await io.run({
    suite,
    json: at('baseline', 'json'),
    log: at('baseline', 'log'),
  });
  const red = redBaseline(baseline, suite.name);
  if (red.length > 0)
    refuse(
      `the ${suite.name} is red before any mutation:\n  ${red.join('\n  ')}`,
    );
  const baselineTotal = readReport(baseline.json).total;

  const importers = new Map<string, ReadonlySet<string>>();
  const importersOf = async (target: string): Promise<ReadonlySet<string>> => {
    const known = importers.get(target);
    if (known !== undefined) return known;
    const name = `importers-${String(importers.size + 1)}`;
    const listed = await io.run({
      suite,
      json: at(name, 'json'),
      log: at(name, 'log'),
      related: target,
    });
    if (listed.ceilingHit || listed.json === undefined)
      refuse(`could not list the guards that import ${target}`);
    const found = new Set(readReport(listed.json).files);
    importers.set(target, found);
    return found;
  };

  let matched = 0;
  for (const mutation of file.mutations) {
    const original = io.read(mutation.file);
    const planted = plant(
      new TextDecoder('utf-8', { fatal: true }).decode(original),
      mutation.anchor,
      mutation.replacement,
    );
    if ('matches' in planted) {
      io.print(
        `ANCHOR ${mutation.name}: ${String(planted.matches)} matches in ${mutation.file}`,
      );
      continue;
    }
    const guards = suite.name === GUARDS_SUITE;
    const excluded = guards
      ? new Set([...file.targets, ...(await importersOf(mutation.file))])
      : new Set<string>();
    let corpus: CorpusPrediction[] = [];
    let outcome: RunOutcome;
    io.guard(mutation.file, original);
    try {
      io.write(mutation.file, new TextEncoder().encode(planted.text));
      if (guards) {
        const recordTo = at(mutation.name, 'observations.jsonl');
        await io.run({
          suite,
          json: at(mutation.name, 'record.json'),
          log: at(mutation.name, 'record.log'),
          recordTo,
        });
        corpus = corpusPredictions(
          io.observations(recordTo),
          io.floors(),
          excluded,
        );
      }
      outcome = await io.run({
        suite,
        json: at(mutation.name, 'json'),
        log: at(mutation.name, 'log'),
      });
    } finally {
      io.write(mutation.file, original);
      io.release(mutation.file);
    }
    if (!sameBytes(io.read(mutation.file), original))
      throw new Error(
        `${mutation.file} did not read back as it was before ${mutation.name}`,
      );
    const found = outcome.ceilingHit
      ? [
          `${suite.name} ran past the ${String(CEILING_SECONDS)} s ceiling and was stopped`,
        ]
      : judge(
          mutation,
          corpus,
          outcome.json === undefined ? undefined : readReport(outcome.json),
          baselineTotal,
        );
    if (found.length === 0) matched += 1;
    io.print(
      found.length === 0 ? `ok   ${mutation.name}` : `MISS ${mutation.name}`,
    );
    for (const p of corpus)
      io.print(
        `  whole-repo floor: ${p.id} ${String(p.recorded)} → ${String(p.actual)}, ${p.file}`,
      );
    for (const problem of found) io.print(`  ${problem}`);
  }
  for (const each of new Set(file.mutations.map((m) => m.file)))
    if (!io.clean(each))
      refuse(`${each} differs from HEAD after every mutation was put back`);
  io.print(
    `${path}: ${String(matched)} of ${String(file.mutations.length)} matched`,
  );
  return { matched, rows: file.mutations.length };
}

/** The suites in `suites` the runner can run: those with a `mutate` config, all run from the root. */
export function mutableSuites(suites: readonly Suite[]): MutableSuite[] {
  return suites.flatMap((suite) => {
    if (suite.mutate === undefined) return [];
    if (suite.cwd !== '.')
      throw new Error(
        `${suite.name} runs from ${suite.cwd}: the runner runs suites from the root only (#649)`,
      );
    return [{ name: suite.name, config: suite.mutate.config }];
  });
}

/** A test-name pattern no test matches: `related` then lists files and runs nothing. */
const NO_TEST = '^$';

/** The vitest arguments for one request: the default reporter for people, `reporter` for the runner. */
export function vitestArgs(request: RunRequest, reporter: string): string[] {
  return [
    'vitest',
    ...(request.related === undefined
      ? ['run']
      : ['related', request.related, '--run', '-t', NO_TEST]),
    ...(request.suite.config === undefined ? [] : ['-c', request.suite.config]),
    '--reporter=default',
    `--reporter=${reporter}`,
  ];
}

/** The environment a run gets: the caller's, the report file named, floors recorded only when asked. */
export function runEnv(
  base: Readonly<Record<string, string | undefined>>,
  request: RunRequest,
  root: string,
): Record<string, string | undefined> {
  const env = Object.fromEntries(
    Object.entries(base).filter(([key]) => key !== RECORD_ENV),
  );
  env[REPORT_ENV] = join(root, request.json);
  if (request.recordTo !== undefined)
    env[RECORD_ENV] = join(root, request.recordTo);
  return env;
}

/** The floor checks a record-mode run wrote, one JSON object a line. */
export function readObservations(text: string, path: string): Observation[] {
  const lines = text.split('\n').filter((line) => line !== '');
  if (lines.length === 0)
    throw new Error(`no floor check was recorded to ${path}`);
  return lines.map((line) => {
    const o = JSON.parse(line) as unknown;
    if (
      !isRecord(o) ||
      typeof o.id !== 'string' ||
      !isCount(o.actual) ||
      typeof o.site !== 'string'
    )
      throw new Error(
        `${path} holds a line that is not a floor check: ${line}`,
      );
    return { id: o.id, actual: o.actual, site: o.site };
  });
}

/** Runs `command` under the ceiling, killing its whole process group past it. */
function spawnBounded(
  command: string,
  args: readonly string[],
  options: { cwd: string; env: Record<string, string | undefined> },
): Promise<{ log: string; ceilingHit: boolean }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, detached: true });
    let log = '';
    let ceilingHit = false;
    child.stdout.on('data', (chunk: Buffer) => (log += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (log += chunk.toString()));
    const timer = setTimeout(() => {
      ceilingHit = true;
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
    }, CEILING_SECONDS * 1_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolvePromise({ log, ceilingHit });
    });
  });
}

/** The real `Io`: files and git under `root`, suites run with npx. */
export function realIo(options: {
  readonly root: string;
  readonly ci: boolean;
  readonly suites: readonly Suite[];
  readonly floorsDir: string;
}): Io & { readonly restoreAll: () => void } {
  const { root } = options;
  const at = (path: string) => join(root, path);
  const guarded = new Map<string, Uint8Array>();
  return {
    ci: options.ci,
    root,
    read: (path) => readFileSync(at(path)),
    write: (path, bytes) => {
      writeFileSync(at(path), bytes);
    },
    // Committed at HEAD: the restore is checked against HEAD's bytes.
    tracked: (path) =>
      spawnSync('git', ['cat-file', '-e', `HEAD:${path}`], { cwd: root })
        .status === 0,
    clean: (path) =>
      spawnSync('git', ['diff', '--quiet', 'HEAD', '--', path], { cwd: root })
        .status === 0,
    list: (mutable) => {
      const entry = options.suites.find((s) => s.name === mutable.name);
      if (entry === undefined)
        throw new Error(`no entry named ${mutable.name}`);
      const [command, ...args] = entry.list;
      if (command === undefined)
        throw new Error(`${entry.name} has no list command`);
      const listed = spawnSync(command, args, {
        cwd: at(entry.cwd),
        encoding: 'utf8',
      });
      if (listed.status !== 0)
        throw new Error(
          `${entry.list.join(' ')} failed: ${listed.stderr.trim()}`,
        );
      return entry.files(listed.stdout);
    },
    run: async (request) => {
      mkdirSync(dirname(at(request.json)), { recursive: true });
      rmSync(at(request.json), { force: true });
      if (request.recordTo !== undefined)
        rmSync(at(request.recordTo), { force: true });
      const { log, ceilingHit } = await spawnBounded(
        'npx',
        vitestArgs(request, REPORTER),
        {
          cwd: root,
          env: runEnv(process.env, request, root),
        },
      );
      writeFileSync(at(request.log), log);
      const json = existsSync(at(request.json))
        ? (JSON.parse(readFileSync(at(request.json), 'utf8')) as unknown)
        : undefined;
      return { json, log, ceilingHit };
    },
    observations: (path) =>
      readObservations(
        existsSync(at(path)) ? readFileSync(at(path), 'utf8') : '',
        path,
      ),
    floors: () => readFloorsDir(at(options.floorsDir)),
    guard: (path, bytes) => guarded.set(path, bytes),
    release: (path) => guarded.delete(path),
    print: (line) => {
      console.log(line);
    },
    restoreAll: () => {
      for (const [path, bytes] of guarded) writeFileSync(at(path), bytes);
      guarded.clear();
    },
  };
}
```

In `scripts/record-floors.ts`, add to `Suite`:

```ts
  /**
   * How the mutation runner (`scripts/mutate.ts`, #527) runs the whole suite
   * with vitest: under `config`, or vitest's default when it names none.
   * Absent: the runner cannot run this suite yet (#649).
   */
  readonly mutate?: { readonly config?: string };
```

The entry, `scripts/mutate-cli.ts`:

```ts
/**
 * `npm run mutate -- tests/mutations/<file>.ts ...` (#527): loads each
 * mutation file and runs it with `scripts/mutate.ts`. The entry lives apart
 * because it imports each mutation file by a path known only at run time,
 * and the whole-repo guards follow every import of the files the suites
 * load, refusing one they cannot read; no test loads this file.
 */
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { asMutationFile } from './mutation-file.ts';
import { mutableSuites, realIo, runFile } from './mutate.ts';
import { FLOORS_DIR, SUITES } from './record-floors.ts';

async function main(): Promise<void> {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error(
      'name a mutation file: npm run mutate -- tests/mutations/<file>.ts',
    );
    process.exitCode = 2;
    return;
  }
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  });
  if (top.status !== 0) throw new Error('run it inside the repository');
  const root = realpathSync(top.stdout.trim());
  const io = realIo({
    root,
    ci: process.env.CI === 'true',
    suites: SUITES,
    floorsDir: FLOORS_DIR,
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      io.restoreAll();
      process.exit(130);
    });
  let matched = 0;
  let rows = 0;
  for (const path of paths) {
    const loaded = (await import(pathToFileURL(resolve(root, path)).href)) as {
      readonly default?: unknown;
    };
    const file = asMutationFile(loaded.default);
    const counts = await runFile(io, path, file, mutableSuites(SUITES));
    matched += counts.matched;
    rows += counts.rows;
  }
  console.log(`mutate: ${String(matched)} of ${String(rows)} matched`);
  process.exitCode = matched === rows ? 0 : 1;
}

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
```

In `scripts/record-floors.ts`, `mutate: {}` on the unit suite, `mutate: { config: 'vitest.<name>.config.ts' }` on the guards, integration, properties, logs and pacing suites. Apply the four wiring edits with `.superpowers/sdd/527/wire.py` (each asserted to apply once).

- [ ] **Step 4: Run green**, then `npm run typecheck`, `npx eslint --max-warnings 0` over every new and changed file, Prettier, and the whole unit suite (`npx vitest run`).

- [ ] **Step 5: Commit** (the scratch stage commit; the pull request is one commit, Task 6).

### Task 4: The integration test over a fixture repository

**Files:**

- Test: `tests/integration/mutate.test.ts`

The fixture is written from strings into a temp folder (no fixture test file in the tree for a suite or a guard to collect), with `node_modules` linked to the repository's, committed with its own git identity. One run of four mutations is shared by the tests through a memoised promise (#97: no `beforeAll`).

```ts
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
    mutate: { config: 'vitest.guards.config.ts' },
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
```

- [ ] **Step 1:** CI only (laptop rule), so it has not been run red on the laptop, and its first run is the pull request's. Two of its cases are misses by design (b and c), so a runner blind to targets or importers turns them into matches and the test red. Its own mutations join a tracked file once #619's check can run the integration suite. Expected in CI: 6 passed; the integration step stays inside its 1-minute limit (measure the step and state it in the pull request; if it does not fit, cut the test, never the limit).

### Task 5: The tracked mutation files, run through the runner

**Files:**

- Create: `tests/mutations/369-bots-run-player-streams.ts` (converted by `.superpowers/sdd/527/convert-369.py`, no prediction edited)
- Create: `tests/mutations/527-mutation-runner.ts` (the runner's own controls, predictions written before the first run)

```ts
import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The mutation runner's own controls (#527, spec §9), each predicted before
 * its first run: an anchor found other than once, a moved total, a file
 * that does not read back, a timeout missed or invented, a floor in a target
 * or in a guard importing the mutated file, a non-unit suite on the laptop,
 * and a report that cannot be read. Unit-suite mutations: they run on the
 * laptop too.
 *
 * Written for the runner as it reads its own reporter (spec §4a). The first
 * set, run on 2026-10-17 against vitest's JSON (`dab0bf0`), matched 2 of 7:
 * every predicted test went red and no other, but 5 reasons sat where the
 * JSON cut its messages short, and one row counted a timeout from a code
 * frame. Those findings are recorded in the spec; these rows are new
 * predictions, not the old ones edited. Their first run (`9b0a949`)
 * matched 8 of 9; the miss is corrected below and marked so.
 */

const UNIT = 'tests/unit/mutate.test.ts';
const RUN = 'tests/unit/mutate-run.test.ts';
const REPORTER = 'tests/unit/mutate-reporter.test.ts';
const FORMAT = 'tests/unit/mutation-file.test.ts';
const PROBLEMS = `${FORMAT} › mutationFileProblems >`;
const GUARDS_RUN = `${RUN} › runFile in the guards suite (CI) > lists the importers once, records, and predicts only floors outside targets and importers`;

export default mutationFile({
  targets: [UNIT, RUN, REPORTER, FORMAT],
  mutations: [
    {
      name: 'anchor-twice-planted',
      file: 'scripts/mutate.ts',
      anchor: '  if (parts.length !== 2) return { matches: parts.length - 1 };',
      replacement:
        '  if (parts.length < 2) return { matches: parts.length - 1 };',
      red: {
        [`${UNIT} › plant > refuses an anchor that occurs twice, with its count`]:
          'matches: 2',
      },
    },
    {
      name: 'moved-total-unseen',
      file: 'scripts/mutate.ts',
      anchor: '  if (report.total !== baselineTotal)',
      replacement: '  if (report.total !== report.total)',
      red: { [`${UNIT} › judge > misses a moved total`]: 'the total moved' },
    },
    {
      name: 'read-back-unchecked',
      file: 'scripts/mutate.ts',
      anchor: '    if (!sameBytes(io.read(mutation.file), original))',
      replacement: '    if (sameBytes(original, original) === false)',
      red: {
        [`${RUN} › runFile > stops when the file does not read back as it was`]:
          'src/reader.ts did not read back as it was before reader-blind',
      },
    },
    {
      name: 'timeout-anywhere-in-the-message',
      file: 'scripts/mutate-reporter.ts',
      anchor: '      if (errors.some((e) => e.message.startsWith(TIMED_OUT)))',
      replacement:
        '      if (errors.some((e) => e.message.includes(TIMED_OUT)))',
      red: {
        [`${REPORTER} › reportOf > does not take a failure that only mentions a timeout for one`]:
          'reader.test.ts › quotes',
      },
    },
    {
      name: 'timeout-unseen',
      file: 'scripts/mutate-reporter.ts',
      anchor: '      if (errors.some((e) => e.message.startsWith(TIMED_OUT)))',
      replacement:
        "      if (errors.some((e) => e.message.startsWith('Tests timed out in ')))",
      // The second test added after the fourth run (hindsight): the
      // guards fix gave it a genuine timed-out control member, which this
      // mutant misses too. The row after it is its sibling, predicted
      // before its first run.
      red: {
        [`${REPORTER} › reportOf > names a test that timed out`]:
          'reader.test.ts › slow',
        [`${REPORTER} › reportOf > does not take a failure that only mentions a timeout for one`]:
          'reader.test.ts › slow',
      },
    },
    {
      name: 'timeout-words-misspelt',
      file: 'scripts/mutate-reporter.ts',
      anchor: "const TIMED_OUT = 'Test timed out in ';",
      replacement: "const TIMED_OUT = 'Test timed out at ';",
      red: {
        [`${REPORTER} › reportOf > names a test that timed out`]:
          'reader.test.ts › slow',
        [`${REPORTER} › reportOf > does not take a failure that only mentions a timeout for one`]:
          'reader.test.ts › slow',
      },
    },
    {
      name: 'targets-not-excluded',
      file: 'scripts/mutate.ts',
      anchor: '    if (actual === recorded || excluded.has(file)) continue;',
      replacement: '    if (actual === recorded) continue;',
      red: {
        [`${UNIT} › corpusPredictions > leaves out a floor checked in an excluded file (a target or an importer)`]:
          'reader/items',
        [GUARDS_RUN]: 'reader/items 4 → 3',
      },
    },
    {
      name: 'importers-not-excluded',
      file: 'scripts/mutate.ts',
      anchor:
        '      ? new Set([...file.targets, ...(await importersOf(mutation.file))])',
      replacement:
        '      ? new Set([...file.targets, ...[...(await importersOf(mutation.file))].filter(() => false)])',
      red: { [GUARDS_RUN]: 'helper/items 2 → 1' },
    },
    {
      name: 'laptop-runs-any-suite',
      file: 'scripts/mutate.ts',
      anchor: '  if (ci || suite === UNIT_SUITE) return undefined;',
      replacement:
        '  if (ci || suite !== UNIT_SUITE || true) return undefined;',
      red: {
        [`${UNIT} › laptopRefusal > refuses any other suite on the laptop`]:
          'pacing suite: the laptop runs the unit suite only (Shyden, 2026-10-09)',
        [`${RUN} › runFile > refuses a non-unit suite on the laptop before running anything`]:
          'tests/mutations/x.ts: guards suite: the laptop runs the unit suite only',
      },
    },
    {
      name: 'report-total-unchecked',
      file: 'scripts/mutate.ts',
      anchor:
        "  if (!isCount(json.total)) return refuse('total is not a count');",
      replacement:
        "  if (!isCount(json.total) && false) return refuse('total is not a count');",
      // Corrected after the second run (hindsight): it went red as predicted,
      // but a function that throws nothing gets vitest's bare "to throw an
      // error", naming no text it expected. The two rows after it are its
      // siblings, predicted before their first run.
      red: {
        [`${UNIT} › readReport > refuses a total that is not a count`]:
          'to throw an error',
      },
    },
    {
      name: 'report-files-unchecked',
      file: 'scripts/mutate.ts',
      anchor:
        "  if (!isTextList(json.files)) return refuse('files is not a list of paths');",
      replacement:
        "  if (!isTextList(json.files) && false) return refuse('files is not a list of paths');",
      red: {
        [`${UNIT} › readReport > refuses files that are not text`]:
          'to throw an error',
      },
    },
    {
      name: 'report-timed-out-unchecked',
      file: 'scripts/mutate.ts',
      anchor: '  if (!isTextList(json.timedOut))',
      replacement: '  if (!isTextList(json.timedOut) && false)',
      red: {
        [`${UNIT} › readReport > refuses timed-out tests that are not text`]:
          'to throw an error',
      },
    },
    {
      // The well-formed search reads its mutations through watched copies:
      // a check skipping the first still finds nothing, and reads 1 of 2.
      name: 'mutations-partly-read',
      file: 'scripts/mutation-file.ts',
      anchor: '  for (const m of file.mutations) {',
      replacement: '  for (const m of file.mutations.slice(1)) {',
      red: {
        [`${PROBLEMS} finds none in a well-formed file`]:
          'mutation-file/well-formed: read 1, recorded 2',
        [`${PROBLEMS} accepts a mutation predicted green`]:
          'the control found nothing',
        [`${PROBLEMS} refuses a name twice`]: 'names first-sail-blind twice',
        [`${PROBLEMS} refuses a name that cannot name a log file`]:
          'a name is letters, digits',
        [`${PROBLEMS} refuses an empty file`]: 'names no file',
        [`${PROBLEMS} refuses an empty anchor`]: 'has an empty anchor',
        [`${PROBLEMS} refuses a replacement equal to its anchor`]:
          'its replacement is its anchor',
        [`${PROBLEMS} refuses a red test named without its file`]:
          'is not written <file>',
        [`${PROBLEMS} refuses a red test with no text to show`]:
          'names no text its failure must show',
      },
    },
  ],
});
```

- [ ] **Step 1: Run them on the laptop** (unit suite): `source ~/.claude/scripts/test-lock.zsh heavy; npm run mutate -- tests/mutations/527-mutation-runner.ts tests/mutations/369-bots-run-player-streams.ts`. Expected: `mutate: 28 of 28 matched`. Measured: 13 of 13 at `a94d5fc` (the pull request's code, floors recorded) and 15 of 15 at `9b0a949`; every run's findings are in spec §4a. A miss is a finding: read it, record it, never re-run it; the first two runs' findings and why the set changed are in spec §4a.

### Task 6: Floors, the pull request, and the close

- [ ] Squash to one commit (`Refs #527`), push, open the PR into `develop` labelled `record-floors`, `npm run floors:fetch <run-id>`, fold the floors into the one commit quoting every delta, push.
- [ ] Read every CI step by name on the head SHA; merge into `develop`; check the dev deploy.
- [ ] Tick #527's ACs with evidence; close it by hand.

## Review log

Every code block is generated from the stage tree (`scratch/527-stages` at `96c6f7d`), whose code ran: unit tests red against throwing stubs then green, the whole unit suite (135 files, 13,338 passed), typecheck, lint, Prettier, and three runner runs (spec §4a). The guards and integration suites are CI-only and run on the pull request.

- **Pass 1 (2026-10-17):** no placeholders. Four figures written before v2 were stale (Task 2's file count twice, Task 3's red count, Task 5's expected total); each now quotes its measurement.
- **Pass 2:** Global Constraints implied every test ran red first; Task 4 now says its integration test is CI-only and has not, and what makes it fail.
- **Pass 3:** clean. Spec §3 → Task 1, §4 and §4a → Tasks 2–3, §5 → Task 3, §6 → Tasks 2 and 4, §7 → Tasks 4–5, §9 → Tasks 1–5, floors → Task 6; no stale name (`timeoutsIn`, `fullName(`, `--reporter=json`: 0); each of the 16 functions the plan names is exported exactly once. Self-approved (global rule, 2026-09-24).
- **Pass 4 (after PR #650's first CI run):** five whole-repo guards found real breaches (spec §4a); the code moved `main` to `scripts/mutate-cli.ts`, made git calls literal, and proved the tests' absence searches. Task 3 gains the entry, Task 5 its twelfth row; the generator now reads the stage SHA from git. Clean.
- **Pass 5 (after the second CI run, `758c80a`):** `raised-limits` refused local names shadowing vitest's `test` and `suite`; renamed, and the guard's reader applied to the eight files outside the suite: 0 findings, every call counted. Clean.
- **Pass 6 (after CI went green on `7da72b1`):** the self-mutation file ran on the pull request's own code: 11 of 12, one prediction stale after the guards fix; corrected as hindsight with a sibling, then 13 of 13. Task 5's expectation now quotes those runs. Clean.
