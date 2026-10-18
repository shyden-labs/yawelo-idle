import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The dev front door shows the holding page (#673), predicted before the
 * first run: which host shows it, the site Worker's HOLDING binding, and
 * verify-dev's marks, stylesheet type and site gate. Unit-suite mutations:
 * they run on the laptop too.
 */

const ROUTES = 'apps/site/worker/routes.test.ts';
const CONFIG = 'tests/unit/dev-config.test.ts';
const VERIFY = 'tests/unit/verify-dev.test.ts';
const SHOWS = `${ROUTES} › showsHolding (#673) > `;
const DEV = `${CONFIG} › the dev Workers’ deploy configs > `;
const FLOW = `${VERIFY} › verifyDev > `;

export default mutationFile({
  targets: [ROUTES, CONFIG, VERIFY],
  mutations: [
    {
      name: 'front-door-by-prefix',
      file: 'apps/site/worker/routes.ts',
      anchor: '  return hostname === HOLDING_HOST;',
      replacement: '  return hostname.startsWith(HOLDING_HOST);',
      red: {
        [`${SHOWS}shows the site on a host that only starts with the front door`]:
          'expected true to be false',
      },
    },
    {
      name: 'front-door-by-suffix',
      file: 'apps/site/worker/routes.ts',
      anchor: '  return hostname === HOLDING_HOST;',
      replacement: '  return hostname.endsWith(HOLDING_HOST);',
      red: {
        [`${SHOWS}shows the site on a host that only ends with the front door`]:
          'expected true to be false',
      },
    },
    {
      name: 'front-door-is-the-api-host',
      file: 'apps/site/worker/routes.ts',
      anchor: "export const HOLDING_HOST = 'dev.yawelo-idle.shyden.co.uk';",
      replacement:
        "export const HOLDING_HOST = 'dev-api.yawelo-idle.shyden.co.uk';",
      red: {
        [`${SHOWS}names the dev front door`]: 'dev-api.yawelo-idle',
        [`${SHOWS}shows the holding page on the dev front door`]:
          'expected false to be true',
        [`${SHOWS}shows the site on the dev API host`]:
          'expected true to be false',
        [`${DEV}shows the holding page on the hostname that reaches the site Worker (#673)`]:
          'dev-api.yawelo-idle',
      },
    },
    {
      name: 'holding-binding-names-the-site',
      file: 'apps/site/wrangler.jsonc',
      anchor:
        '    { "binding": "HOLDING", "service": "yawelo-idle-holding-dev" },',
      replacement:
        '    { "binding": "HOLDING", "service": "yawelo-idle-site-dev" },',
      red: {
        [`${DEV}binds the game and the holding page’s dev copy, and nothing else, to the site Worker (#332, #673)`]:
          'yawelo-idle-holding-dev',
      },
    },
    {
      name: 'holding-mark-anywhere',
      file: 'scripts/verify-dev.ts',
      anchor: 'const HOLDING_MARK = /<[a-z][^>]*\\sdata-coming-soon[\\s>=]/;',
      replacement: 'const HOLDING_MARK = /data-coming-soon/;',
      red: {
        [`${VERIFY} › holdingProblems (#673) > fails a page that names the mark only in its text`]:
          'not the holding page',
      },
    },
    {
      name: 'site-mark-unchecked',
      file: 'scripts/verify-dev.ts',
      anchor:
        "    markCheck(\n      label,\n      probe,\n      SITE_MARK,\n      'the site being built',\n      'data-dev-strip',\n    ),\n",
      replacement: '',
      red: {
        [`${VERIFY} › siteProblems (#673) > accepts the site being built with its commit, noindex and mark`]:
          'verify-dev/site-checks',
        [`${VERIFY} › siteProblems (#673) > fails the holding page served in its place`]:
          'not the site being built',
        [`${FLOW}fails a site address serving the holding page in place of the site (#673)`]:
          'not the site being built',
      },
    },
    {
      name: 'stylesheet-any-text',
      file: 'scripts/verify-dev.ts',
      anchor: "        return /^text\\/css\\b/.test(type ?? '')",
      replacement: "        return /^text\\//.test(type ?? '')",
      red: {
        [`${VERIFY} › stylesheetProblems (#673) > fails a stylesheet served as a page`]:
          'expected text/css',
      },
    },
    {
      name: 'site-gate-unchecked',
      file: 'scripts/verify-dev.ts',
      anchor:
        "    await look('site', 'site without credentials', target.siteUrl, {}, (p) =>\n      gateProblems('site without credentials', p),\n    ),\n",
      replacement: '',
      red: {
        [`${FLOW}passes a gated site serving the expected commit, judging each check once`]:
          'site:/',
        [`${FLOW}fails a site address the gate does not cover (#673)`]:
          'site without credentials',
        [`${FLOW}waits while one page still serves the old commit, then judges it once (#581)`]:
          'two looks of nine probes, then one of sixteen',
        [`${FLOW}waits for a stale deploy to turn current, then judges it once`]:
          'two stale looks of four probes, then one of sixteen',
        [`${FLOW}fails a flaky gate that answers wrongly once, with no second look`]:
          'one look of sixteen probes',
        [`${FLOW}fails at once when robots.txt drops its connection, with no second look`]:
          'one look of sixteen probes',
      },
    },
  ],
});
