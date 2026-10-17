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
