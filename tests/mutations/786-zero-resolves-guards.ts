import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The scalar-zero reader (#786), as the guards suite's whole-tree walk loads
 * it (tests/guards/floorless-searches.test.ts). Predicted before the first
 * run (2026-10-30 UTC). The tree holds no settled or polled zero, so the
 * row breaks the path every zero takes: a direct zero marked settled is
 * never a site, so each `expect(x.length).toBe(0)` in the tree joins the
 * scalar list and the ratchet's recorded count no longer holds.
 */

export default mutationFile({
  targets: ['tests/guards/floorless-searches.test.ts'],
  mutations: [
    {
      name: 'every-direct-zero-read-as-settled',
      file: 'tests/unit/floorless-searches.ts',
      anchor:
        '  if (direct !== undefined) return { ...direct, settled: false };',
      replacement:
        '  if (direct !== undefined) return { ...direct, settled: true };',
      red: {
        'tests/guards/floorless-searches.test.ts › the reader proves what it read (#361) > reads every zero assertion its text writes, and ratchets the scalar ones (#367)':
          'floorless-searches/scalar-zeros',
      },
    },
  ],
});
