import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The scalar-zero reader (#786), as the guards suite's whole-tree walk loads
 * it (tests/guards/floorless-searches.test.ts). Predicted before the first
 * run (2026-10-30 UTC, rewritten the same day: see below). The tree holds no
 * settled or polled zero, so the row breaks the path every zero takes: a
 * direct zero is no longer read at all, so each file that writes one reads
 * as misread against its text.
 *
 * The first row (a direct zero marked settled, so never a site) stayed green
 * in CI's run 40954181744: the tree holds no real `length` or `size` zero
 * site (all 10 such texts are string fixtures in floorless-searches.test.ts,
 * measured with git grep), so marking them settled changed nothing the guard
 * sees. That prediction was an unmeasured guess; this one rests on the 74
 * scalar zeros the floor records.
 */

export default mutationFile({
  targets: ['tests/guards/floorless-searches.test.ts'],
  mutations: [
    {
      name: 'no-direct-zero-read',
      file: 'tests/unit/floorless-searches.ts',
      anchor:
        '  if (direct !== undefined) return { ...direct, settled: false };',
      replacement: '  if (direct !== undefined) return undefined;',
      red: {
        'tests/guards/floorless-searches.test.ts › the reader proves what it read (#361) > reads every zero assertion its text writes, and ratchets the scalar ones (#367)':
          'to deeply equal',
      },
    },
  ],
});
