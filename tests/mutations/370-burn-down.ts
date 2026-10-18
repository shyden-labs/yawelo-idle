import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The floorless-searches burn-down list after #370 (judge rule #659: a
 * changed helper a non-unit test loads gets a row planted in it). Predicted
 * before the first run. `pacing-gaps-relisted` puts back an entry #370
 * converted; the guard reads that scope as proved, so it names the stale
 * entry and asks for it to be lowered.
 */

const GUARD = 'tests/guards/floorless-searches.test.ts';

export default mutationFile({
  targets: [GUARD],
  mutations: [
    {
      name: 'pacing-gaps-relisted',
      file: 'tests/unit/floorless-searches.burn-down.ts',
      anchor: 'export const UNPROVED: Readonly<Record<string, number>> = {',
      replacement:
        "export const UNPROVED: Readonly<Record<string, number>> = {\n  'packages/bots/pacing/pacing.test.ts › (b) the Casual Learner reaches each later destination 1 to 3 days after the one before': 1,",
      red: {
        [`${GUARD} › every absence search is proved, or listed (#361) > finds every scope holding exactly the unproved searches listed`]:
          '(b) the Casual Learner reaches each later destination 1 to 3 days after the one before: 0 unproved, 1 listed. Lower the entry',
      },
    },
  ],
});
