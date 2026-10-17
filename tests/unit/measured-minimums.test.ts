import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  CHECK_HOME,
  checkReadingOf,
  EXEMPT,
  isPropertiesFile,
  SEED_HOME,
  seedReadingOf,
} from './measured-minimums';

/**
 * The measured-minimums guard's reader (#84, spec §5.8) on planted source:
 * every form a check call or a fast-check seed can be written in, each
 * planted by hand (guard catalogue: a plant generated from the reader's own
 * list cannot see that list drop a form). The guard over the repository is
 * in tests/guards/measured-minimums.test.ts.
 */

const PROPS = 'packages/core/properties/sample.test.ts';
const HELPER = 'packages/core/test/sample-laws.ts';

const parse = (source: string, file: string) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const checks = (source: string, file = PROPS) =>
  checkReadingOf(file, parse(source, file));
const seeds = (source: string, file = PROPS) =>
  seedReadingOf(file, parse(source, file));

const IMPORT_CHECKS =
  "import { minimumBreach, minimumsBreach } from '../../../tests/minimums';\n";
const IMPORT_FC = "import fc from 'fast-check';\n";

describe('checkReadingOf', () => {
  it('counts a call of each check', () => {
    expect(
      checks(
        IMPORT_CHECKS +
          "expect(minimumBreach('g/a', n)).toBeUndefined();\n" +
          "expect(minimumsBreach('g/k-', counts)).toBeUndefined();\n",
      ),
    ).toEqual({ calls: 2, refusals: [] });
  });

  it('counts a call split over lines and one inside an object', () => {
    expect(
      checks(
        IMPORT_CHECKS +
          'expect({\n  a: minimumBreach(\n    `g/${x}`,\n    n,\n  ),\n}).toEqual({ a: undefined });\n',
      ),
    ).toEqual({ calls: 1, refusals: [] });
  });

  it('counts nothing for a name in a string, a comment or a title, and judges the reference beside them', () => {
    expect(
      checks(
        "// minimumBreach('g/a', 1)\nit('minimumBreach reads', () => {});\nconst s = 'minimumsBreach(';\nconst atLeast = minimumsBreach;\n",
      ),
    ).toEqual({
      calls: 0,
      refusals: [`${PROPS}:4: uses minimumsBreach other than by calling it`],
    });
  });

  it('refuses an aliased import', () => {
    expect(
      checks(
        "import { minimumBreach as atLeast } from '../../../tests/minimums';\natLeast('g/a', 1);\n",
      ).refusals,
    ).toEqual([`${PROPS}:1: imports minimumBreach under another name`]);
  });

  it.each([
    ['../../../tests/minimums'],
    ['../../../tests/minimums.ts'],
    ['../minimums'],
    ['./minimums'],
  ])('refuses a namespace import of %s', (specifier) => {
    expect(checks(`import * as m from '${specifier}';\n`).refusals).toEqual([
      `${PROPS}:1: imports the minimum checks as a namespace: import each by name`,
    ]);
  });

  it('refuses a call through a namespace', () => {
    expect(checks("m.minimumBreach('g/a', 1);\n").refusals).toEqual([
      `${PROPS}:1: reaches minimumBreach through a namespace`,
    ]);
  });

  it('refuses an element access', () => {
    expect(checks("m['minimumsBreach']('g/k-', c);\n").refusals).toEqual([
      `${PROPS}:1: reaches minimumsBreach by element access`,
    ]);
  });

  it('refuses a check passed by reference', () => {
    expect(
      checks(IMPORT_CHECKS + 'ids.map((id) => id).forEach(minimumBreach);\n')
        .refusals,
    ).toEqual([`${PROPS}:2: uses minimumBreach other than by calling it`]);
  });

  it('refuses a check bound to another name', () => {
    expect(
      checks(IMPORT_CHECKS + 'const atLeast = minimumsBreach;\n').refusals,
    ).toEqual([`${PROPS}:2: uses minimumsBreach other than by calling it`]);
  });

  it('refuses a re-export', () => {
    expect(
      checks("export { minimumBreach } from '../minimums';\n", HELPER).refusals,
    ).toEqual([`${HELPER}:1: re-exports minimumBreach`]);
  });

  it('leaves the checks’ own home to its tests, and judges the same text anywhere else', () => {
    const source =
      'export function minimumBreach() {}\nexport const x = minimumBreach;\n';
    expect({
      home: checks(source, CHECK_HOME),
      helper: checks(source, HELPER),
    }).toEqual({
      home: { calls: 0, refusals: [] },
      helper: {
        calls: 0,
        refusals: [
          `${HELPER}:1: uses minimumBreach other than by calling it`,
          `${HELPER}:2: uses minimumBreach other than by calling it`,
        ],
      },
    });
  });
});

describe('seedReadingOf', () => {
  it('counts a runner with no options, and one with options written out', () => {
    expect(
      seeds(
        IMPORT_FC +
          'fc.assert(fc.property(fc.nat(), check));\n' +
          'fc.assert(fc.property(fc.nat(), check), { numRuns: 300 });\n',
      ),
    ).toEqual({ runners: 2, configures: 0, refusals: [] });
  });

  it.each([['assert'], ['check'], ['sample'], ['statistics']])(
    'refuses a seed passed to fc.%s',
    (runner) => {
      expect(
        seeds(IMPORT_FC + `fc.${runner}(p, { numRuns: 3, seed: 474 });\n`)
          .refusals,
      ).toEqual([
        `${PROPS}:2: sets a seed for ${runner}: properties draw fresh cases (#84)`,
      ]);
    },
  );

  it('refuses a seed written as shorthand', () => {
    expect(seeds(IMPORT_FC + 'fc.assert(p, { seed });\n').refusals).toEqual([
      `${PROPS}:2: sets a seed for assert: properties draw fresh cases (#84)`,
    ]);
  });

  it('refuses a seed named by a string key', () => {
    expect(
      seeds(IMPORT_FC + "fc.assert(p, { 'seed': 1 });\n").refusals,
    ).toEqual([
      `${PROPS}:2: sets a seed for assert: properties draw fresh cases (#84)`,
    ]);
  });

  it('refuses a seed named by a computed string key', () => {
    expect(
      seeds(IMPORT_FC + "fc.assert(p, { ['seed']: 1 });\n").refusals,
    ).toEqual([
      `${PROPS}:2: sets a seed for assert: properties draw fresh cases (#84)`,
    ]);
  });

  it('refuses a computed key it cannot read', () => {
    expect(seeds(IMPORT_FC + 'fc.assert(p, { [KEY]: 1 });\n').refusals).toEqual(
      [`${PROPS}:2: sets a computed option for assert: write it out`],
    );
  });

  it('refuses options passed by name', () => {
    expect(
      seeds(IMPORT_FC + 'const OPTS = { seed: 1 };\nfc.assert(p, OPTS);\n')
        .refusals,
    ).toEqual([
      `${PROPS}:3: passes assert options the guard cannot read: write them out`,
    ]);
  });

  it('refuses options spread in', () => {
    expect(
      seeds(IMPORT_FC + 'fc.assert(p, { ...OPTS, numRuns: 5 });\n').refusals,
    ).toEqual([`${PROPS}:2: spreads options into assert: write them out`]);
  });

  it('follows a namespace import', () => {
    expect(
      seeds("import * as f from 'fast-check';\nf.assert(p, { seed: 2 });\n"),
    ).toEqual({
      runners: 1,
      configures: 0,
      refusals: [
        `${PROPS}:2: sets a seed for assert: properties draw fresh cases (#84)`,
      ],
    });
  });

  it('follows a default import under another name', () => {
    expect(
      seeds("import check from 'fast-check';\ncheck.sample(a, { seed: 2 });\n")
        .refusals,
    ).toEqual([
      `${PROPS}:2: sets a seed for sample: properties draw fresh cases (#84)`,
    ]);
  });

  it.each([
    ["import { assert } from 'fast-check';", 'assert'],
    ["import { assert as run } from 'fast-check';", 'assert'],
    ["import { configureGlobal } from 'fast-check';", 'configureGlobal'],
  ])('refuses %s', (line, name) => {
    expect(seeds(`${line}\n`).refusals).toEqual([
      `${PROPS}:1: imports fast-check's ${name} by name: call it through the default import`,
    ]);
  });

  it.each([
    ["export { assert } from 'fast-check';"],
    ["export * from 'fast-check';"],
    ["export * as fc from 'fast-check';"],
  ])('refuses the re-export %s', (line) => {
    expect(seeds(`${line}\n`, HELPER).refusals).toEqual([
      `${HELPER}:1: re-exports fast-check: import it where it is used`,
    ]);
  });

  it('leaves a type-only re-export, which carries no runner, and refuses the re-export beside it', () => {
    expect(
      seeds(
        "export type { Arbitrary } from 'fast-check';\nexport { assert } from 'fast-check';\n",
        HELPER,
      ).refusals,
    ).toEqual([
      `${HELPER}:2: re-exports fast-check: import it where it is used`,
    ]);
  });

  it('leaves a named import of anything else, and refuses a runner imported beside it', () => {
    expect(
      seeds(
        "import { type Arbitrary, nat } from 'fast-check';\nimport { assert } from 'fast-check';\n",
      ).refusals,
    ).toEqual([
      `${PROPS}:2: imports fast-check's assert by name: call it through the default import`,
    ]);
  });

  it('refuses fast-check bound to another name', () => {
    expect(seeds(IMPORT_FC + 'const f = fc;\n').refusals).toEqual([
      `${PROPS}:2: uses fc other than through its members`,
    ]);
  });

  it('refuses fast-check handed to a function', () => {
    expect(seeds(IMPORT_FC + 'run(fc);\n').refusals).toEqual([
      `${PROPS}:2: uses fc other than through its members`,
    ]);
  });

  it('refuses a runner reached by element access', () => {
    expect(
      seeds(IMPORT_FC + "fc['assert'](p, { seed: 1 });\n").refusals,
    ).toEqual([`${PROPS}:2: reaches fc by element access`]);
  });

  it('leaves fast-check’s types and its other members, and reads the runner beside them', () => {
    expect(
      seeds(
        IMPORT_FC +
          'const a: fc.Arbitrary<number> = fc.nat();\nfc.pre(true);\nfc.assert(p, { seed: 7 });\n',
      ),
    ).toEqual({
      runners: 1,
      configures: 0,
      refusals: [
        `${PROPS}:4: sets a seed for assert: properties draw fresh cases (#84)`,
      ],
    });
  });

  it('refuses a global configuration outside the seeding home', () => {
    expect(seeds(IMPORT_FC + 'fc.configureGlobal({ seed: 1 });\n')).toEqual({
      runners: 0,
      configures: 1,
      refusals: [
        `${PROPS}:2: configures fast-check globally outside ${SEED_HOME}`,
      ],
    });
  });

  it('counts the seeding home’s global configuration, refusing nothing', () => {
    expect(
      seeds(IMPORT_FC + 'fc.configureGlobal({ seed });\n', SEED_HOME),
    ).toEqual({ runners: 0, configures: 1, refusals: [] });
  });

  it('refuses an exact floor in a properties file', () => {
    expect(
      seeds("import { floorBreach } from '../../../tests/floors';\n").refusals,
    ).toEqual([
      `${PROPS}:1: names floorBreach in a properties file: fresh cases fail an exact floor at random; use minimumBreach (#84)`,
    ]);
  });

  it('refuses an exact floor in a logs-suite file (spec §5.12)', () => {
    expect(
      seeds(
        "import { floorBreach } from '../../../tests/floors';\n",
        'packages/core/logs/log.test.ts',
      ).refusals,
    ).toEqual([
      'packages/core/logs/log.test.ts:1: names floorBreach in a properties file: fresh cases fail an exact floor at random; use minimumBreach (#84)',
    ]);
  });

  it('leaves an exact floor in a helper the properties load, and judges the runner beside it', () => {
    expect(
      seeds(
        "import { floorBreach } from '../../../tests/floors';\n" +
          IMPORT_FC +
          'fc.assert(p, { seed: 9 });\n',
        HELPER,
      ).refusals,
    ).toEqual([
      `${HELPER}:3: sets a seed for assert: properties draw fresh cases (#84)`,
    ]);
  });

  it('reads a runner in a helper the properties load', () => {
    expect(
      seeds(IMPORT_FC + 'fc.assert(p, { seed: 9 });\n', HELPER).refusals,
    ).toEqual([
      `${HELPER}:2: sets a seed for assert: properties draw fresh cases (#84)`,
    ]);
  });
});

describe('isPropertiesFile', () => {
  it.each([
    ['packages/core/properties/sim.test.ts', true],
    ['packages/bots/properties/deep/a.test.ts', true],
    // The logs suite's properties draw fresh cases too (spec §5.12).
    ['packages/core/logs/log.test.ts', true],
    ['packages/core/logs/tsconfig.json', false],
    ['packages/core/test/logs/a.test.ts', false],
    ['packages/core/test/sim.test.ts', false],
    ['packages/core/properties/tsconfig.json', false],
    ['tests/unit/minimums.test.ts', false],
  ])('%s is a properties file: %s', (file, expected) => {
    expect(isPropertiesFile(file)).toBe(expected);
  });
});

describe('EXEMPT', () => {
  // Pinned by literal: the exemption is Shyden's (2026-10-12, 2026-10-16), so
  // a file joins or a count moves only through this test.
  it('lists the ten properties’ eight files and the checker’s own tests, with their calls', () => {
    expect(EXEMPT).toEqual({
      'packages/core/properties/automation.test.ts': 2,
      'packages/core/properties/pemandu-tick.test.ts': 1,
      'packages/core/properties/sim.test.ts': 3,
      'packages/core/properties/unfold.test.ts': 3,
      'packages/core/properties/words.test.ts': 1,
      'packages/core/properties/review.test.ts': 1,
      'packages/core/properties/rng.test.ts': 1,
      // Moved to the logs suite (spec §5.12).
      'packages/core/logs/log.test.ts': 3,
      'tests/unit/minimums.test.ts': 14,
    });
  });
});
