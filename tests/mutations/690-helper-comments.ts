import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #690 in the guards suite (judge rule #659: a changed helper a non-unit
 * test loads gets a row planted in it). #690 changes only comments in the
 * two helpers; Shyden chose (2026-10-20) to prove them still guarded rather
 * than exempt comment-only changes. Each predicted before it first ran
 * (2026-10-20).
 */
export default mutationFile({
  targets: [
    'tests/guards/floorless-searches.test.ts',
    'tests/guards/one-test-per-case.test.ts',
  ],
  mutations: [
    {
      name: 'C1-control-result-returned',
      file: 'tests/searched.ts',
      anchor: '  return run(input);\n}\n',
      replacement: '  return run(control);\n}\n',
      red: {
        'tests/guards/one-test-per-case.test.ts › the suite > keeps no burn-down entry that has already been split':
          'planted.test.ts',
      },
    },
    {
      name: 'T1-twin-overlisted',
      file: 'tests/unit/floorless-searches.twins.ts',
      anchor: "  'tests/unit/core-determinism-lint.test.ts › label': 1,\n",
      replacement: "  'tests/unit/core-determinism-lint.test.ts › label': 2,\n",
      red: {
        'tests/guards/floorless-searches.test.ts › every bad twin is listed for review (#374) > finds every scope using againstTwin exactly as the twin list holds':
          'label: 1 proved by a twin, 2 listed',
      },
    },
  ],
});
