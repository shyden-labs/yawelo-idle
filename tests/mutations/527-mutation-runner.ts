import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The mutation runner's own controls (#527, spec §9), each predicted before
 * its first run on 2026-10-17: an anchor found other than once, a moved
 * total, a file that does not read back, a timed-out test, a floor in a
 * target or in a guard importing the mutated file, and a non-unit suite on
 * the laptop. Unit-suite mutations: they run on the laptop too.
 */

const UNIT = 'tests/unit/mutate.test.ts';
const RUN = 'tests/unit/mutate-run.test.ts';

export default mutationFile({
  targets: [UNIT, RUN],
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
          'did not read back as it was before reader-blind',
      },
    },
    {
      name: 'timeouts-uncounted',
      file: 'scripts/mutate.ts',
      anchor: "  return log.split('Test timed out').length - 1;",
      replacement: "  return log.split('Tests timed out').length - 1;",
      red: {
        [`${UNIT} › timeoutsIn > counts each timed-out test in the default log`]:
          'expected 0 to be 2',
        [`${RUN} › runFile > refuses a baseline with a timed-out test`]:
          'red before any mutation',
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
        [`${RUN} › runFile in the guards suite (CI) > lists the importers once, records, and predicts only floors outside targets and importers`]:
          'reader/items 4 → 3',
      },
    },
    {
      name: 'importers-not-excluded',
      file: 'scripts/mutate.ts',
      anchor:
        '      ? new Set([...file.targets, ...(await importersOf(mutation.file))])',
      replacement:
        '      ? new Set([...file.targets, ...[...(await importersOf(mutation.file))].filter(() => false)])',
      red: {
        [`${RUN} › runFile in the guards suite (CI) > lists the importers once, records, and predicts only floors outside targets and importers`]:
          'helper/items 2 → 1',
      },
    },
    {
      name: 'laptop-runs-any-suite',
      file: 'scripts/mutate.ts',
      anchor: '  if (ci || suite === UNIT_SUITE) return undefined;',
      replacement:
        '  if (ci || suite !== UNIT_SUITE || true) return undefined;',
      red: {
        [`${UNIT} › laptopRefusal > refuses any other suite on the laptop`]:
          'the laptop runs the unit suite only',
        [`${RUN} › runFile > refuses a non-unit suite on the laptop before running anything`]:
          'the laptop runs the unit suite only',
      },
    },
  ],
});
