import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The site Worker shows the holding page on the dev front door (#673),
 * through wrangler's harness after the site's build, predicted before the
 * first run. Without the HOLDING branch the front door serves the site being
 * built: its pages lose the holding mark and link no holding stylesheet,
 * while the gate, robots.txt, the game, the roadmap and the webhook answer
 * as before.
 */

const SITE = 'apps/site/test/site.test.ts';
const FRONT = `${SITE} › the dev front door shows the holding page production shows (#673) >`;
const NO_KEY = 'apps/site/test/roadmap/no-app-key.test.ts';

export default mutationFile({
  targets: [SITE, NO_KEY],
  mutations: [
    // The roadmap harness (apps/site/test/roadmap/harness.ts) changed for
    // #673: it now binds HOLDING too. Dropping that override stops the
    // harness starting at all, so every roadmap test goes red; this row
    // proves the harness's one narrow switch instead, its missing-key world.
    {
      name: 'harness-key-always-sent',
      file: 'apps/site/test/roadmap/harness.ts',
      anchor:
        '              ...(appKey ? { ROADMAP_APP_KEY: keys.privateKey } : {}),\n',
      replacement: '              ...{ ROADMAP_APP_KEY: keys.privateKey },\n',
      red: {
        [`${NO_KEY} › names the missing App key in the health, the board never read`]:
          'ROADMAP_APP_KEY is not set',
      },
    },
    {
      name: 'front-door-shows-the-site',
      file: 'apps/site/worker/index.ts',
      anchor:
        '      if (showsHolding(hostname)) return env.HOLDING.fetch(allowed);\n',
      replacement: '',
      red: {
        [`${FRONT} shows the holding page at / with the password, noindex added`]:
          'data-coming-soon',
        [`${FRONT} shows the holding page at /id/ with the password, noindex added`]:
          'data-coming-soon',
        [`${FRONT} serves the stylesheet the holding page links, as CSS`]:
          'Holding',
      },
    },
  ],
});
