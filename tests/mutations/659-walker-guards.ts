import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The guards that load the import follower (`tests/unit/helper-modules.ts`),
 * which #659 changed: a helper a non-unit test loads carries a mutation
 * planted in it and predicted red for those tests (#659 AC2). Predicted
 * before its first run: with the follower failing, every guards test that
 * calls it fails naming why, whether it calls it itself or through
 * `unitSuiteFiles` (`tests/unit/unit-suite-files.ts`). Each guard's walk is
 * cached only once it succeeds, so each test calls it again and fails too.
 * Guards-suite mutations: they run in CI only.
 */

const COLLECTION = 'tests/guards/collection-calls.test.ts';
const FAST_CHECK = 'tests/guards/fast-check-in-unit.test.ts';
const RAISED = 'tests/guards/raised-limits.test.ts';
const MINIMUMS = 'tests/guards/measured-minimums.test.ts';

const PLANTED = '659 planted: the import follower fails';

const red = (prefix: string, titles: readonly string[]) =>
  Object.fromEntries(titles.map((title) => [`${prefix}${title}`, PLANTED]));

export default mutationFile({
  targets: [COLLECTION, FAST_CHECK, RAISED, MINIMUMS],
  mutations: [
    {
      name: 'follower-fails',
      file: 'tests/unit/helper-modules.ts',
      anchor:
        '  const { helpers, imports, unresolved } = walk(entries, source);\n  return { helpers: [...helpers].sort(), imports, unresolved };',
      replacement: `  throw new Error('${PLANTED}');`,
      red: {
        ...red(`${COLLECTION} › the suite > `, [
          'scans every committable test file, this one included',
          'follows every relative import of a test file to the helper modules it loads, and scans them too (#554)',
          'reads the describe callbacks in them, counted as callbacks, not files',
          'judges the calls they evaluate at collection, counted as calls',
          'reads a describe callback in every file whose text holds a describe call',
          'lists every call in each file, as its parse tree counts them (#371)',
          'classifies every call evaluated at collection, refusing by name what it cannot follow',
          'reaches no workspace code at collection',
        ]),
        ...red(`${FAST_CHECK} › fast-check in the unit suite (#551) > `, [
          'reads every file the unit suite loads: its tests, setup files and their helpers',
          'follows every helper import those files make',
          'finds no load of fast-check in them, of any spelling',
          'meets every fast-check specifier TypeScript’s own reader meets, file by file',
        ]),
        ...red(
          `${RAISED} › no unit test or unit config raises a limit (#477 AC3, AC4) > `,
          [
            'finds none in any file the unit suite loads',
            'reads as many tests, suites, hooks and limit keys in each file as its text writes, every call judged and declarations counted',
            'reads the unit config and the setup file it names',
          ],
        ),
        ...red(
          `${MINIMUMS} › the properties suite sets no fast-check seed but in its one home (#84) > `,
          [
            'reads every runner in the properties, the helpers they load and the suite’s setup, and finds no seed set there',
          ],
        ),
      },
    },
  ],
});
