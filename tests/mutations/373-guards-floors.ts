import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The one-test-per-case guard's searches over the whole repository check
 * floors on what each read (#373 AC4). Predicted before the first run, from
 * the populations measured on the branch: 212 test files, each holding a
 * test call; 2,674 calls on `it` or `test` examined, 2,672 of them tests and
 * 2 of the "other" kind (a suite, a hook or an annotation); and
 * tests/unit/workflow-timeouts.test.ts holding 12 tests, all examined.
 *
 * `timeouts-file-unread` blinds the guard to one test file, which all three
 * floors see; `other-calls-uncounted` blinds the reader to one kind of call,
 * which only the examined calls' floor counts. `stale-check-ignores-input`
 * proves the burn-down check's control: a check that ignored the list it is
 * given finds nothing in the planted stale entry, and againstControl refuses.
 * The floorless-searches guard refuses it too, by its own reading: a run that
 * never reads its parameter is not a bound control (isBoundControl), so the
 * check becomes an unproved absence search. That sibling was missed in the
 * first CI run (39155124831), so its prediction is hindsight. Two rows of the
 * same cause, predicted before their first run, test the explanation:
 * `stale-check-reads-part-of-input` still reads its parameter, so only the
 * control refuses; `stale-check-takes-no-input` has no parameter, the other
 * branch of isBoundControl, so floorless-searches refuses as well.
 */

const GUARD = 'tests/guards/one-test-per-case.test.ts';
const SUITE = `${GUARD} › the suite >`;
const FILES = `${SUITE} reads at least one test in every file whose text holds a test call`;
const CALLS = `${SUITE} classifies every call on it and test, refusing by name what it cannot read`;
const LOOPS = `${SUITE} loops no known population inside a test beyond the burn-down list`;
const FLOORLESS =
  'tests/guards/floorless-searches.test.ts › every absence search is proved, or listed (#361) > finds every scope holding exactly the unproved searches listed';

export default mutationFile({
  targets: [GUARD],
  mutations: [
    {
      name: 'timeouts-file-unread',
      file: GUARD,
      anchor:
        '  const files = committableFiles().filter((path) => TEST_FILE.test(path));',
      replacement:
        "  const files = committableFiles().filter(\n    (path) => TEST_FILE.test(path) && path !== 'tests/unit/workflow-timeouts.test.ts',\n  );",
      red: {
        [FILES]: 'one-test-per-case/files-with-test-calls: read 211',
        [CALLS]: 'one-test-per-case/repo-calls: read 2662',
        [LOOPS]: 'one-test-per-case/repo-test-calls: read 2660',
      },
    },
    {
      name: 'other-calls-uncounted',
      file: 'tests/unit/one-test-per-case.ts',
      anchor: "      if (kind !== 'none') examined += 1;",
      replacement:
        "      if (kind !== 'none' && kind !== 'other') examined += 1;",
      red: { [CALLS]: 'one-test-per-case/repo-calls: read 2672' },
    },
    {
      name: 'stale-check-ignores-input',
      file: GUARD,
      anchor: 'minus(listed, sites)',
      replacement: 'minus([], sites)',
      red: {
        [`${SUITE} keeps no burn-down entry that has already been split`]:
          'the control found nothing',
        [FLOORLESS]: `${GUARD} › keeps no burn-down entry that has already been split: 1 unproved, 0 listed`,
      },
    },
    {
      name: 'stale-check-reads-part-of-input',
      file: GUARD,
      anchor: 'minus(listed, sites)',
      replacement: 'minus(listed.slice(1), sites)',
      red: {
        [`${SUITE} keeps no burn-down entry that has already been split`]:
          'the control found nothing',
      },
    },
    {
      name: 'stale-check-takes-no-input',
      file: GUARD,
      anchor: '(listed: readonly string[]) => minus(listed, sites)',
      replacement: '() => minus([], sites)',
      red: {
        [`${SUITE} keeps no burn-down entry that has already been split`]:
          'the control found nothing',
        [FLOORLESS]: `${GUARD} › keeps no burn-down entry that has already been split: 1 unproved, 0 listed`,
      },
    },
  ],
});
