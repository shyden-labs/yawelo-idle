import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The guard over every tracked mutation file (#619 AC1), each row predicted
 * before its first run: a file that names a target or a planted file git
 * does not have, a file that refuses to load, a loader that skips a file
 * (a file with no reading is a finding), and a listing that drops one (seen
 * by the file system's cross-check). Guards-suite mutations: CI only.
 */

const GUARD = 'tests/guards/mutation-files.test.ts';
const TEST = `${GUARD} › the mutation files (#619 AC1) > loads every file in tests/mutations/, each naming only files git has`;
const RUN_FILES = 'tests/mutations/652-run-files.ts';

export default mutationFile({
  targets: [GUARD],
  mutations: [
    {
      name: 'target-git-lacks',
      file: RUN_FILES,
      anchor: '  targets: [RUN],',
      replacement: "  targets: ['tests/unit/gone.test.ts'],",
      red: {
        [TEST]: `${RUN_FILES}: targets tests/unit/gone.test.ts, which git does not have`,
      },
    },
    {
      name: 'planted-file-git-lacks',
      file: RUN_FILES,
      anchor:
        "      name: 'refusal-ends-the-loop',\n      file: 'scripts/mutate.ts',",
      replacement:
        "      name: 'refusal-ends-the-loop',\n      file: 'scripts/gone.ts',",
      red: {
        [TEST]: `${RUN_FILES}: plants in scripts/gone.ts, which git does not have`,
      },
    },
    {
      name: 'file-refuses-to-load',
      file: RUN_FILES,
      anchor: '  targets: [RUN],',
      replacement: '  targets: [],',
      red: { [TEST]: 'names no targets' },
    },
    {
      name: 'loader-skips-a-file',
      file: 'scripts/load-mutation-files.ts',
      anchor: '  for (const path of process.argv.slice(2)) {',
      replacement: '  for (const path of process.argv.slice(3)) {',
      red: {
        [TEST]:
          'tests/mutations/369-bots-run-player-streams.ts: the loader printed nothing for it',
      },
    },
    {
      name: 'listing-drops-a-file',
      file: GUARD,
      anchor: ".filter((name) => name.endsWith('.ts'))",
      replacement:
        ".filter((name) => name.endsWith('.ts') && !name.startsWith('369-'))",
      red: { [TEST]: 'tests/mutations/369-bots-run-player-streams.ts' },
    },
  ],
});
