import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * A deleted or transferred issue leaving the roadmap is explained by its
 * webhook (#689, found after #691 merged), through wrangler's harness,
 * predicted before the first run. Without the absence rule, the issue's
 * witness is never seen and its card's change becomes drift.
 */

const ROADMAP = 'apps/site/test/roadmap/roadmap.test.ts';
const BEHIND = `${ROADMAP} › a read behind its webhook (#689) >`;

export default mutationFile({
  targets: [ROADMAP],
  mutations: [
    {
      name: 'gone-issue-never-seen',
      file: 'apps/site/worker/witness.ts',
      anchor: '    if (witness.gone) return read === undefined;\n',
      replacement: '',
      red: {
        [`${BEHIND} counts no drift when a deleted issue’s card leaves the board by webhook`]:
          'expected 1 to be +0',
        [`${BEHIND} counts no drift when a transferred issue leaves the roadmap by webhook`]:
          'expected 1 to be +0',
      },
    },
  ],
});
