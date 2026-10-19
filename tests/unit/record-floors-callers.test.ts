import { readFileSync } from 'node:fs';
// TypeScript's parser, loaded with this file rather than by its first
// test: the recorder loads it lazily, on its first read of a caller (#432),
// so the first test here paid the load, 70 ms of CPU on a quiet laptop and
// 221-270 ms on a busy one (#544). The recorder's lazy load then finds it in
// Node's module cache. The load is this file's, under #541's load limit.
import 'typescript';
import { describe, expect, it } from 'vitest';
import { findFloorCallers, readFloorCaller } from '../../scripts/record-floors';
import { againstTwin } from '../searched';

/**
 * The floor recorder's reading of each file that calls `floorBreach` (#448),
 * from its parse tree: split from record-floors.test.ts so only the tests
 * that parse load TypeScript (#544).
 */

/** A test file one directory below `tests/`, the house layout. */
const TEST_PATH = 'tests/unit/a.test.ts';
const CALL = "expect(floorBreach('a/b', 1)).toBeUndefined();";
const reads = (source: string, path = TEST_PATH) =>
  readFloorCaller(path, source);

/** A real call of `floorBreach` through a namespace no case here names. */
const planted = (floors: string): string =>
  `import * as twinFloors from '${floors}';\ntwinFloors.floorBreach('a/b', 1);`;

/** What the reader found in `source`: a call, then each refusal. */
const found = (source: string): readonly string[] => {
  const { calls, refusals } = reads(source);
  return calls ? ['calls floorBreach', ...refusals] : refusals;
};

describe('readFloorCaller: every import form TypeScript accepts (#448 AC2)', () => {
  it.each([
    [
      'an extensionless import',
      TEST_PATH,
      `import { floorBreach } from '../floors';\n${CALL}`,
    ],
    [
      'a .ts import',
      TEST_PATH,
      `import { floorBreach } from '../floors.ts';\n${CALL}`,
    ],
    [
      'a .js import',
      TEST_PATH,
      `import { floorBreach } from '../floors.js';\n${CALL}`,
    ],
    [
      'double quotes',
      TEST_PATH,
      `import { floorBreach } from "../floors";\n${CALL}`,
    ],
    [
      'a multi-line import among others',
      TEST_PATH,
      `import {\n  FLOORS_DIR,\n  floorBreach,\n} from '../floors';\n${CALL}`,
    ],
    [
      "#123's import, three directories up with .ts",
      'apps/web/test/game.test.ts',
      `import { floorBreach } from '../../../tests/floors.ts';\n${CALL}`,
    ],
    [
      'an import from the same directory',
      'tests/floors.test.ts',
      `import { floorBreach } from './floors';\n${CALL}`,
    ],
    [
      'an aliased import',
      TEST_PATH,
      "import { floorBreach as fb } from '../floors';\nexpect(fb('a/b', 1)).toBeUndefined();",
    ],
    [
      'a namespace import',
      TEST_PATH,
      "import * as floors from '../floors';\nexpect(floors.floorBreach('a/b', 1)).toBeUndefined();",
    ],
    [
      'a namespace read by its literal key',
      TEST_PATH,
      "import * as floors from '../floors';\nexpect(floors['floorBreach']('a/b', 1)).toBeUndefined();",
    ],
    [
      'the function handed on by reference',
      TEST_PATH,
      "import { floorBreach } from '../floors';\nexport const judge = floorBreach;",
    ],
  ])('reads %s as a caller', (_what, path, source) => {
    expect(reads(source, path)).toEqual({ calls: true, refusals: [] });
  });
});

describe('readFloorCaller: the name in text is no call (#448 AC1)', () => {
  it.each([
    ['the name in a comment', '// every floorBreach( call'],
    ['the name in a string', "const s = 'floorBreach(';"],
    ['the name in a template literal', 'const s = `floorBreach(`;'],
    ['an object key of that name', 'const o = { floorBreach: 1 };'],
    [
      'another name from the floors module',
      "import { readFloors } from '../floors';\nreadFloors();",
    ],
    [
      'another member of a floors namespace',
      "import * as floors from '../floors';\nfloors.readFloors();",
    ],
    ['an import never used', "import { floorBreach } from '../floors';"],
  ])('reads %s as no caller', async (_what, source) => {
    // Proved by a twin with a real call planted (#692, Shyden 2026-10-20).
    expect(
      await againstTwin(found, {
        input: source,
        twin: `${source}\n${planted('../floors')}`,
      }),
    ).toEqual([]);
  });

  // A file read from disk cannot take a twin, whose sample is text written
  // in the test (#374), so each asserts its clean reading beside the reading
  // of the same text with a call planted: a dead reader cannot give both
  // (#692).
  it.each([
    [
      'the recorder, which names it in prose and messages',
      'scripts/record-floors.ts',
      '../tests/floors',
    ],
    [
      'the floorless-searches guard, which names it in strings',
      'tests/unit/floorless-searches.ts',
      '../floors',
    ],
    [
      'the literal-floors guard, which names it in strings',
      'tests/unit/literal-floors.ts',
      '../floors',
    ],
  ])(
    'reads %s as no caller, and as one with a call planted',
    (_what, path, floors) => {
      const text = readFileSync(path, 'utf8');
      expect([
        reads(text, path),
        reads(`${text}\n${planted(floors)}`, path),
      ]).toEqual([
        { calls: false, refusals: [] },
        { calls: true, refusals: [] },
      ]);
    },
  );

  it('reads the floors module itself as no caller, though its text elsewhere calls and is refused', () => {
    const text = `${readFileSync('tests/floors.ts', 'utf8')}\n${planted('./floors')}`;
    expect([reads(text, 'tests/floors.ts'), reads(text, 'tests/a.ts')]).toEqual(
      [
        { calls: false, refusals: [] },
        {
          calls: true,
          refusals: ['tests/a.ts: declares its own floorBreach'],
        },
      ],
    );
  });
});

describe('readFloorCaller: what it cannot follow, it refuses by name (#448 AC3)', () => {
  it.each([
    [
      'a call with no import',
      CALL,
      'calls floorBreach with no recognised import of it',
    ],
    [
      'a call imported from another module',
      `import { floorBreach } from './other';\n${CALL}`,
      'calls floorBreach with no recognised import of it',
    ],
    [
      'its own floorBreach',
      'function floorBreach() {}',
      'declares its own floorBreach',
    ],
    [
      'a re-export',
      "export { floorBreach } from '../floors';",
      're-exports floorBreach; import it from tests/floors directly',
    ],
    [
      'a dynamic import',
      "const floors = await import('../floors');",
      'imports tests/floors dynamically, which the recorder cannot follow',
    ],
    [
      'a namespace read by a computed key',
      "import * as floors from '../floors';\nconst k = 'floorBreach';\nfloors[k]('a/b', 1);",
      'reads tests/floors by a computed key',
    ],
    [
      'a namespace handed on whole',
      "import * as floors from '../floors';\nuse(floors);",
      'hands tests/floors on as a value',
    ],
    [
      'the name reached through another object',
      "helpers.floorBreach('a/b', 1);",
      'reaches floorBreach through helpers, which the recorder cannot follow',
    ],
  ])('refuses %s', (_what, source, why) => {
    expect(reads(source)).toEqual({
      calls: false,
      refusals: [`${TEST_PATH}: ${why}`],
    });
  });
});

describe('findFloorCallers (#448 AC3)', () => {
  it('returns each caller, refuses each file it cannot follow, and skips the home', () => {
    expect(
      findFloorCallers([
        { path: 'tests/floors.ts', source: 'export function floorBreach() {}' },
        {
          path: TEST_PATH,
          source: `import { floorBreach } from '../floors';\n${CALL}`,
        },
        { path: 'tests/unit/b.test.ts', source: CALL },
        { path: 'tests/unit/c.test.ts', source: "const s = 'floorBreach(';" },
      ]),
    ).toEqual({
      callers: [TEST_PATH],
      refusals: [
        'tests/unit/b.test.ts: calls floorBreach with no recognised import of it',
      ],
    });
  });
});
