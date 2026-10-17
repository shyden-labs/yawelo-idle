import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The game harness (#649, spec §8 AC3), run from `apps/web` after its build.
 * Predicted before the first run. `shell-text-shouted` changes text the
 * harness sees only in the built bundle, so it goes red only when the runner
 * builds after planting. Its replacement keeps the text's length, so the
 * bundle test beside it (asset bytes) stays out of the prediction.
 * `base-joined` is an equivalent mutant: it must stay green.
 */

const GAME = 'apps/web/test/game.test.ts';
const PLAY = `${GAME} › the game Worker, under /play/ (#332 AC4) >`;
const CSP = `${GAME} › the game Worker sets a Content Security Policy (#123 AC5) >`;

export default mutationFile({
  targets: [GAME],
  mutations: [
    {
      name: 'shell-text-shouted',
      file: 'packages/ui/src/Shell.svelte',
      anchor: '<p>Coming soon.</p>',
      replacement: '<p>Coming SOON.</p>',
      red: {
        [`${PLAY} says coming soon and links to the roadmap (#332 AC6)`]:
          'Coming soon.',
        [`${PLAY} says coming soon and links to the launch list (#332 AC6)`]:
          'Coming soon.',
        [`${PLAY} says coming soon and links to the Indonesian roadmap (#332 AC6)`]:
          'Coming soon.',
        [`${PLAY} says coming soon and links to the Indonesian launch list (#332 AC6)`]:
          'Coming soon.',
      },
    },
    {
      name: 'policy-objects-allowed',
      file: 'apps/web/worker/policy.ts',
      anchor: "object-src 'none'",
      replacement: "object-src 'self'",
      red: {
        [`${CSP} on the shell`]: "object-src 'none'",
        [`${CSP} on a client route`]: "object-src 'none'",
        [`${CSP} on the redirect from /play`]: "object-src 'none'",
        [`${CSP} on a path outside /play/`]: "object-src 'none'",
        [`${CSP} on the script the shell loads, a file the asset router serves`]:
          "object-src 'none'",
      },
    },
    {
      name: 'base-joined',
      file: 'apps/web/worker/index.ts',
      anchor: "const BASE = '/play/';",
      replacement: "const BASE = '/play' + '/';",
      red: {},
    },
  ],
});
