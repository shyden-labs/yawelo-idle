import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * Planted control for #619 AC6, never merged: a mutation predicted red that
 * stays green (it edits a comment), so the run job, and with it the
 * required `mutations` job, must fail.
 */

const VERDICT = 'tests/unit/mutations-verdict.test.ts';

export default mutationFile({
  targets: [VERDICT],
  mutations: [
    {
      name: 'comment-only',
      file: 'scripts/mutations-verdict.ts',
      anchor:
        ' * `node scripts/mutations-verdict.ts` (#619 AC5): the `mutations` job, which',
      replacement:
        ' * `node scripts/mutations-verdict.ts` (#619 AC5): the mutations job, which',
      red: {
        [`${VERDICT} › verdict > fails when the run was skipped with files to run`]:
          'the run of 3 mutation files ended skipped',
      },
    },
  ],
});
