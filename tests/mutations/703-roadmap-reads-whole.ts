import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The roadmap Worker refuses a read short of the board (#703), predicted
 * before its first run, through the site's harness suite. The Worker shares
 * assertBoard, so one row: the short-read check dropped, and the board the
 * fake counts as 10 items is published from the 9 it served. The other
 * refusals are proved in the unit suite (703-board-reads-whole.ts).
 */

const ROADMAP = 'apps/site/test/roadmap/roadmap.test.ts';

export default mutationFile({
  targets: [ROADMAP],
  mutations: [
    {
      name: 'roadmap-short-read-passes',
      file: 'packages/progress/src/index.ts',
      anchor: '  if (read !== total)\n',
      replacement: '  if (false)\n',
      red: {
        [`${ROADMAP} › reading the board > refuses a read short of the board, keeping nothing from it`]:
          'to be +0',
      },
    },
  ],
});
