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
 * predictions, not the old ones edited.
 */

const UNIT = 'tests/unit/mutate.test.ts';
const RUN = 'tests/unit/mutate-run.test.ts';
const REPORTER = 'tests/unit/mutate-reporter.test.ts';
const GUARDS_RUN = `${RUN} › runFile in the guards suite (CI) > lists the importers once, records, and predicts only floors outside targets and importers`;

export default mutationFile({
  targets: [UNIT, RUN, REPORTER],
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
      red: {
        [`${REPORTER} › reportOf > names a test that timed out`]:
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
      red: {
        [`${UNIT} › readReport > refuses a total that is not a count`]:
          'total is not a count',
      },
    },
  ],
});
