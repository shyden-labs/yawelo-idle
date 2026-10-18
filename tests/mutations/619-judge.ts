import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The changed-test judge and the required check's verdict (#619 AC2, AC5),
 * each row predicted before its first run: a deleted test demanded, a
 * test predicted red still named, a target counted as proof without a red
 * row, a whole test name kept as its file, the unit suite judged, a
 * docs-only change listed anyway, a skipped run read as a pass, a failed
 * judge read as a pass. Unit-suite mutations: they run on the laptop too.
 */

const CHANGED = 'tests/unit/mutations-changed.test.ts';
const VERDICT = 'tests/unit/mutations-verdict.test.ts';
const JUDGE = 'scripts/mutations-changed.ts';

export default mutationFile({
  targets: [CHANGED, VERDICT],
  mutations: [
    {
      name: 'deleted-test-demanded',
      file: JUDGE,
      anchor:
        "    return status === 'D' || suite === undefined || predictedRed.has(path)",
      replacement: '    return suite === undefined || predictedRed.has(path)',
      red: {
        [`${CHANGED} › unprovedTests > passes a deleted non-unit test`]:
          'tests/guards/a.test.ts (guards suite)',
      },
    },
    {
      name: 'predicted-test-named',
      file: JUDGE,
      anchor:
        "    return status === 'D' || suite === undefined || predictedRed.has(path)",
      replacement: "    return status === 'D' || suite === undefined",
      red: {
        [`${CHANGED} › unprovedTests > passes a changed non-unit test that a changed mutation file predicts red`]:
          'tests/guards/a.test.ts (guards suite)',
      },
    },
    // Added with the predicted-red rule (a side agent's note, 2026-10-18),
    // each predicted before its first run.
    {
      name: 'targets-count-as-proof',
      file: JUDGE,
      anchor:
        '  return new Set(\n    files.flatMap(({ mutations }) =>\n      mutations.flatMap(({ red }) =>\n        Object.keys(red).map((key) =>\n          key.slice(0, key.indexOf(FILE_SEPARATOR)),\n        ),\n      ),\n    ),\n  );',
      replacement:
        '  return new Set([\n    ...files.flatMap(({ targets }) => targets),\n    ...files.flatMap(({ mutations }) =>\n      mutations.flatMap(({ red }) =>\n        Object.keys(red).map((key) =>\n          key.slice(0, key.indexOf(FILE_SEPARATOR)),\n        ),\n      ),\n    ),\n  ]);',
      red: {
        [`${CHANGED} › testsPredictedRed > leaves out a target whose every row is predicted green`]:
          'tests/guards/c.test.ts',
      },
    },
    {
      name: 'whole-key-kept',
      file: JUDGE,
      anchor: '          key.slice(0, key.indexOf(FILE_SEPARATOR)),\n',
      replacement: '          key,\n',
      red: {
        [`${CHANGED} › testsPredictedRed > collects the file of every test a row of any file predicts red`]:
          'tests/guards/a.test.ts › d > t',
        [`${CHANGED} › testsPredictedRed > leaves out a target whose every row is predicted green`]:
          'tests/guards/a.test.ts › d > t',
      },
    },
    {
      name: 'unit-suite-judged',
      file: JUDGE,
      anchor: '    if (suite === UNIT_SUITE) continue;\n',
      replacement: '',
      red: {
        [`${CHANGED} › nonUnitTests > maps each file a non-unit suite lists to that suite, leaving out the unit suite’s`]:
          'tests/unit/a.test.ts',
      },
    },
    {
      name: 'docs-only-listed',
      file: JUDGE,
      anchor: '  return changed.some(({ path }) => !onAllowlist(path));',
      replacement: '  return changed.length > 0;',
      red: {
        [`${CHANGED} › needsListings > lists none when every changed path is HANDOVER.md or Markdown under docs/`]:
          'to be false',
      },
    },
    {
      name: 'skipped-run-passes',
      file: 'scripts/mutations-verdict.ts',
      anchor: "  return run === 'success'\n",
      replacement: "  return run === 'success' || run === 'skipped'\n",
      red: {
        [`${VERDICT} › verdict > fails when the run was skipped with files to run`]:
          '✓ the judge passed and 3 mutation files ran clean',
      },
    },
    {
      name: 'failed-judge-passes',
      file: 'scripts/mutations-verdict.ts',
      anchor: "  if (changed !== 'success')\n",
      replacement: "  if (changed === 'cancelled')\n",
      red: {
        [`${VERDICT} › verdict > fails when the judge ended failure`]:
          'the judge passed but wrote no count it can read',
        [`${VERDICT} › verdict > fails when the judge ended skipped`]:
          'the judge passed but wrote no count it can read',
      },
    },
  ],
});
