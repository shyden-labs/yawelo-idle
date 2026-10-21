import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The minimums checker #718 rewrote the guidance of (`tests/minimums.ts`),
 * planted where a non-unit suite sees it (#659). Predicted before the first
 * run, which only CI makes: the properties suite runs nowhere else. The row
 * loses the record of one family, so its counts read as never recorded and
 * the checker prints the new guidance in the properties suite's own tests:
 * the three named sub-streams of `core-rng`, the only tests that judge a
 * `core-rng/` id (`git grep -l "core-rng/"`, 2026-10-21).
 */

const RNG = 'packages/core/properties/rng.test.ts';
const STREAMS = `${RNG} › named sub-streams > are independent: drawing the others never changes`;

export default mutationFile({
  targets: [RNG],
  mutations: [
    {
      name: 'core-rng-record-lost',
      file: 'tests/minimums.ts',
      anchor: '  const measured = minimums[id];\n',
      replacement:
        "  const measured = id.startsWith('core-rng/') ? undefined : minimums[id];\n",
      red: {
        [`${STREAMS} recall`]: 'to be undefined',
        [`${STREAMS} latency`]: 'to be undefined',
        [`${STREAMS} opens`]: 'to be undefined',
      },
    },
  ],
});
