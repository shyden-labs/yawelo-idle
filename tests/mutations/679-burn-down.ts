import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #679 drops the burn-down entries of the deleted every-commit tests,
 * predicted before its first run: an entry left for a test that no longer
 * exists lists an unproved search nobody holds, and the guard names it.
 * Guards-suite mutation: it runs in CI only.
 */

const GUARD = 'tests/guards/floorless-searches.test.ts';
const STALE = 'tests/unit/every-commit.test.ts › reads no output as no commits';

export default mutationFile({
  targets: [GUARD],
  mutations: [
    {
      name: 'deleted-test-still-listed',
      file: 'tests/unit/floorless-searches.burn-down.ts',
      anchor: "  'tests/unit/core-determinism-lint.test.ts › lint': 1,\n};",
      replacement: `  'tests/unit/core-determinism-lint.test.ts › lint': 1,\n  '${STALE}': 1,\n};`,
      red: {
        [`${GUARD} › every absence search is proved, or listed (#361) > finds every scope holding exactly the unproved searches listed`]:
          STALE,
      },
    },
  ],
});
