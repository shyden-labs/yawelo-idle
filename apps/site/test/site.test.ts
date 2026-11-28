import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from '../../../tests/support/create-covered-harness';
import { BLOCKING_ROBOTS_TXT, NO_INDEX } from '@yawelo-idle/lockdown';
import { COPY, LEGAL } from '../src/copy';
import {
  isLegal,
  LEGAL_PAGES,
  otherLocale,
  pagePath,
  SITE,
  type Locale,
  type Page,
} from '../src/i18n';
import { DOOR_HOST_HEADER, DOOR_SECRET_HEADER } from '../../door/worker/door';
import {
  EXEMPT_PATHS,
  SITE_DOOR,
  PRIVATE_PATHS,
  ROADMAP_PATHS,
} from '../worker/routes';
import { CONTENT_SECURITY_POLICY as GAME_POLICY } from '../../web/worker/policy';
import { supportPolicy } from '../worker/support';

/**
 * The dev site Worker, served by wrangler's test harness from the real
 * wrangler.jsonc and the built ./dist. Requests go through the server, so
 * Cloudflare's asset router decides whether the Worker runs at all: this is
 * the layer `run_worker_first` configures, and the only one where its absence
 * shows. (vitest-pool-workers' `exports.default.fetch` and `SELF` call the
 * Worker directly, below the router; measured 2026-10-01, both stayed green
 * with `run_worker_first: false`.)
 *
 * The GAME binding reaches the real game Worker, built from apps/web
 * (`build:harness` builds it). #332 measured every game asset answering 500
 * beside the site on wrangler 4.145.0; on 4.148.0 both serve (#815,
 * 2026-11-01), so the real game answers.
 *
 * Absolute URLs set the hostname the Worker sees.
 */
const DEV = 'https://yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev';
const PROD = SITE;
const DOOR_SECRET = 'test-only-door-secret';

const server = createTestHarness({
  root: new URL('..', import.meta.url).pathname,
  workers: [
    {
      configPath: './wrangler.jsonc',
      secrets: { DOOR_SECRET },
    },
    // The real game Worker, the service wrangler.jsonc's GAME binding names.
    { configPath: '../web/wrangler.jsonc' },
  ],
});

/**
 * A request as the door sends it: the dev origin requires its door (#1078),
 * and the door adds the door secret to every request it passes on, so this
 * stands in for the door. `bare` is a request that skipped the door.
 */
const get = (url: string, headers: Record<string, string> = {}) =>
  server.fetch(url, {
    headers: { [DOOR_SECRET_HEADER]: DOOR_SECRET, ...headers },
    redirect: 'manual',
  });

const bare = (url: string, headers: Record<string, string> = {}) =>
  server.fetch(url, { headers, redirect: 'manual' });

beforeAll(async () => {
  await server.listen();
});

afterAll(async () => {
  await server.close();
});

/**
 * Whether the real game Worker answered: it sets its own Content Security
 * Policy on everything it serves, which the site's answers never carry.
 */
// The harness answers with miniflare's Response, not the DOM's.
const fromGame = (response: {
  headers: { get(name: string): string | null };
}): boolean => response.headers.get('Content-Security-Policy') === GAME_POLICY;

/** The game's built shell and the script it loads, as apps/web built them. */
const GAME_SHELL = readFileSync(
  new URL('../../web/dist/play/index.html', import.meta.url),
  'utf8',
);
const GAME_SCRIPT_PATH = /src="(\/play\/assets\/[^"]+\.js)"/.exec(
  GAME_SHELL,
)?.[1];
if (GAME_SCRIPT_PATH === undefined) {
  throw new Error('the built game shell names no /play/assets/*.js script');
}
const GAME_SCRIPT = readFileSync(
  new URL(`../../web/dist${GAME_SCRIPT_PATH}`, import.meta.url),
  'utf8',
);

/** The pages each language has: every page is in English and Indonesian (#928). */
const PAGES: [Locale, Page][] = [
  ['en', 'home'],
  ['en', 'roadmap'],
  ['en', 'privacy'],
  ['en', 'support'],
  ['en', 'supportTicket'],
  ['id', 'home'],
  ['id', 'roadmap'],
  ['id', 'privacy'],
  ['id', 'support'],
  ['id', 'supportTicket'],
];

/** A page's title: a legal page's comes from `LEGAL`, apart from the general copy. */
const titleOf = (locale: Locale, page: Page): string =>
  isLegal(page) ? LEGAL[locale][page].title : COPY[locale].titles[page];

describe('the dev site Worker requires its door, through the asset router (#1078)', () => {
  it('serves the home page with the door secret, noindex added, no password asked', async () => {
    const response = await get(`${DEV}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(response.headers.get('WWW-Authenticate')).toBeNull();
    expect(await response.text()).toContain('<meta name="yawelo-idle-commit"');
  });

  it.each([
    ['without the door secret', {}],
    [
      'with a wrong door secret',
      { [DOOR_SECRET_HEADER]: 'not-the-door-secret' },
    ],
  ])(
    'refuses a real built page %s and sends none of its bytes',
    async (_case, headers) => {
      const page = await (await get(`${DEV}/roadmap`)).text();
      expect(page).toContain(COPY.en.voyage.intro);
      const response = await bare(`${DEV}/roadmap`, headers);
      expect(response.status).toBe(403);
      expect(response.headers.get('WWW-Authenticate')).toBeNull();
      expect(await response.text()).toBe('forbidden');
    },
  );

  it.each([
    '/',
    '/id/',
    '/index.html',
    '/privacy',
    '/no/such/page',
    '/robots.txt',
  ])('refuses %s without the door secret', async (path) => {
    const response = await bare(`${DEV}${path}`);
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('forbidden');
  });

  it.each(['/play', '/play/', '/play/assets/index.js'])(
    'refuses the game path %s without the door secret and never forwards it',
    async (path) => {
      const response = await bare(`${DEV}${path}`);
      expect(response.status).toBe(403);
      expect(fromGame(response)).toBe(false);
    },
  );

  it('ignores a password sent without the door secret', async () => {
    const response = await bare(`${DEV}/`, {
      Authorization: `Basic ${btoa('tester:any-password')}`,
    });
    expect(response.status).toBe(403);
  });

  it('serves blocking robots.txt with the door secret', async () => {
    const response = await get(`${DEV}/robots.txt`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
  });

  it('passes the production host through untouched', async () => {
    const page = await (await get(`${DEV}/roadmap`)).text();
    const response = await get(`${PROD}/roadmap`);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBeNull();
    expect(await response.text()).toBe(page);
  });
});

describe('the webhook path, which the door passes on unchecked (#341 signs it)', () => {
  it.each(EXEMPT_PATHS)(
    '%s reaches its handler with the door secret, which takes POST only',
    async (path) => {
      const response = await get(`${DEV}${path}`);
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toBe('POST');
      expect(response.headers.get('WWW-Authenticate')).toBeNull();
    },
  );

  it.each([...EXEMPT_PATHS, '/hooks/github/', '/hooks/github/x', '/hooks'])(
    'refuses %s without the door secret, like every other path',
    async (path) => {
      const response = await bare(`${DEV}${path}`);
      expect(response.status).toBe(403);
    },
  );
});

describe('the game, forwarded through the GAME binding after the gate', () => {
  // The real game shows what reached it: the file for the path, its shell
  // for a client route, and the query kept in its own redirect.
  it('forwards /play, where the game redirects to /play/ keeping the query', async () => {
    const response = await get(`${DEV}/play?x=1`);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('/play/?x=1');
    expect(fromGame(response)).toBe(true);
  });

  it('forwards /play/, answered with the game shell', async () => {
    const response = await get(`${DEV}/play/?x=1`);
    expect(response.status).toBe(200);
    expect(fromGame(response)).toBe(true);
    expect(await response.text()).toBe(GAME_SHELL);
  });

  it('forwards the game script by its path, answered with that file', async () => {
    const response = await get(`${DEV}${GAME_SCRIPT_PATH}?x=1`);
    expect(response.status).toBe(200);
    expect(fromGame(response)).toBe(true);
    expect(await response.text()).toBe(GAME_SCRIPT);
  });

  it('forwards a client route, answered with the game shell', async () => {
    const response = await get(`${DEV}/play/a/client/route?x=1`);
    expect(response.status).toBe(200);
    expect(fromGame(response)).toBe(true);
    expect(await response.text()).toBe(GAME_SHELL);
  });

  it('adds noindex to what the game answers on dev', async () => {
    const response = await get(`${DEV}/play/`);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
  });

  it.each(['/playground', '/plays', '/id/play/'])(
    'keeps %s on the site, which only looks like a game path',
    async (path) => {
      const response = await get(`${DEV}${path}`);
      expect(response.status).toBe(404);
      expect(fromGame(response)).toBe(false);
    },
  );
});

describe('the placeholder pages, in both languages (#332 AC1, AC2)', () => {
  it.each(PAGES)('%s %s is served at its own path', async (locale, page) => {
    const response = await get(`${DEV}${pagePath(locale, page)}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(`<html lang="${locale}"`);
    expect(html).toContain(`<title>${titleOf(locale, page)}</title>`);
  });

  it.each(PAGES)(
    '%s %s carries the development strip in its language',
    async (locale, page) => {
      const html = await (await get(`${DEV}${pagePath(locale, page)}`)).text();
      expect(html).toContain(
        `<p class="dev-strip" data-dev-strip>${COPY[locale].devStrip}</p>`,
      );
    },
  );

  it.each(PAGES)(
    '%s %s switches language to the same page',
    async (locale, page) => {
      const other = otherLocale(locale);
      const html = await (await get(`${DEV}${pagePath(locale, page)}`)).text();
      expect(html).toContain(
        `<a href="${pagePath(other, page)}" hreflang="${other}" lang="${other}" data-language-switch>`,
      );
    },
  );

  it.each(PAGES)(
    '%s %s lists every language as an hreflang alternate',
    async (locale, page) => {
      const html = await (await get(`${DEV}${pagePath(locale, page)}`)).text();
      const links = [...html.matchAll(/<link rel="alternate"[^>]*>/g)].map(
        ([link]) => link,
      );
      expect(links).toEqual([
        `<link rel="alternate" hreflang="en" href="${SITE}${pagePath('en', page)}">`,
        `<link rel="alternate" hreflang="id" href="${SITE}${pagePath('id', page)}">`,
        `<link rel="alternate" hreflang="x-default" href="${SITE}${pagePath('en', page)}">`,
      ]);
    },
  );

  it.each([
    ['en', '/no/such/page'],
    ['id', '/id/no/such/page'],
  ] as const)(
    'answers an unknown %s path %s with that language’s 404 page',
    async (locale, path) => {
      const response = await get(`${DEV}${path}`);
      expect(response.status).toBe(404);
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}"`);
      expect(html).toContain(COPY[locale].notFoundTitle);
      expect(html).toContain(COPY[locale].devStrip);
    },
  );
});

describe('the roadmap page’s own text, in its language (#830)', () => {
  /**
   * The old Indonesian note that ticket titles and island summaries stayed
   * English. The voyage map (#1068) shows no ticket titles and its summaries
   * are Indonesian, so neither page shows it (#830, 2026-11-24).
   */
  const OLD_NOTE =
    'Judul tiket dan ringkasan pulau di halaman ini tetap dalam bahasa Inggris.';

  it.each(['en', 'id'] as const)(
    'the %s roadmap says what it shows, what launch means and how to read it, with no ticket-titles note',
    async (locale) => {
      const html = await (
        await get(`${DEV}${pagePath(locale, 'roadmap')}`)
      ).text();
      const { intro, launch, howToRead } = COPY[locale].voyage;
      expect([
        html.includes(`<p lang="${locale}">${intro}</p>`),
        html.includes(`<p lang="${locale}">${launch}</p>`),
        html.includes(`<p lang="${locale}">${howToRead}</p>`),
        html.includes(OLD_NOTE),
      ]).toEqual([true, true, true, false]);
    },
  );
});

describe('legal pages are English and Indonesian (#928)', () => {
  it.each(
    (['en', 'id'] as const).flatMap((locale) =>
      LEGAL_PAGES.map((page) => [locale, page] as const),
    ),
  )(
    'the %s %s page says which text governs, in its own language',
    async (locale, page) => {
      const html = await (await get(`${DEV}${pagePath(locale, page)}`)).text();
      expect(html).toContain(
        `<p data-governing-language>${LEGAL[locale][page].governs}</p>`,
      );
      // The request counts line (#164 AC2), as the page escapes it.
      expect(html).toContain(
        `<p data-request-counts>${LEGAL[locale][page].requestCounts.replaceAll("'", '&#39;')}</p>`,
      );
      expect(html).not.toContain('data-english-only-note');
    },
  );
});

/**
 * The dev front door, dev.yaweloidle.com: the site being built, with the game
 * and the roadmap (Shyden, 2026-11-28, #1078: "Built site on dev"; the holding
 * page production shows is at dev-holding). The door reaches this Worker at
 * its workers.dev address with the door secret and its own name (#784).
 */
const front = (path: string, headers: Record<string, string> = {}) =>
  get(`${DEV}${path}`, {
    [DOOR_SECRET_HEADER]: DOOR_SECRET,
    [DOOR_HOST_HEADER]: SITE_DOOR,
    ...headers,
  });

describe('the dev front door shows the site being built (#1078)', () => {
  it.each(['/', '/id/'])(
    'shows the site being built at %s, noindex added',
    async (path) => {
      const response = await front(path);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
      const html = await response.text();
      expect(html).toContain(' data-dev-strip>');
      expect(html).not.toContain(' data-coming-soon>');
    },
  );

  it('serves blocking robots.txt on the front door', async () => {
    const response = await front('/robots.txt');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
  });

  it('forwards the game on the front door', async () => {
    const response = await front('/play/');
    expect(response.status).toBe(200);
    expect(fromGame(response)).toBe(true);
    expect(await response.text()).toBe(GAME_SHELL);
  });

  it('answers the roadmap’s health on the front door, not a page', async () => {
    const response = await front(ROADMAP_PATHS.health);
    expect(response.headers.get('Content-Type')).toMatch(
      /^application\/json\b/,
    );
  });

  it.each(EXEMPT_PATHS)(
    'takes %s on the front door, POST only',
    async (path) => {
      const response = await front(path);
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toBe('POST');
    },
  );

  it('keeps the site being built at the Worker’s own address', async () => {
    const html = await (await get(`${DEV}/`)).text();
    expect(html).toContain(' data-dev-strip>');
  });
});

/**
 * Behind its door (#784), this Worker is reached at its workers.dev address,
 * and the door's name is believed only with the door secret. The door host
 * is read from routes.ts, never written out (#784 AC1b).
 */
describe('through the dev site’s door, the site being built (#784, #1078)', () => {
  const through = (secret: string) => ({
    [DOOR_SECRET_HEADER]: secret,
    [DOOR_HOST_HEADER]: SITE_DOOR,
  });

  it('shows the site being built at the workers.dev address with the door secret', async () => {
    const response = await get(`${DEV}/`, through(DOOR_SECRET));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(' data-dev-strip>');
    expect(html).not.toContain(' data-coming-soon>');
  });

  it('refuses a wrong door secret, whatever door it names', async () => {
    const response = await get(`${DEV}/`, through('not-the-door-secret'));
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('forbidden');
  });
});

describe('the roadmap API docs (#588)', () => {
  const DOCS = '/api/docs';
  const SPEC = readFileSync(
    new URL('../api/roadmap.openapi.json', import.meta.url),
    'utf8',
  );

  /** The docs page's HTML, read on `origin`. */
  const docsPage = async (
    origin: string,
    headers: Record<string, string> = {},
  ): Promise<string> => {
    const response = await get(`${origin}${DOCS}`, headers);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^text\/html/);
    return response.text();
  };

  /** Every address the page loads from: src, href and the spec's url. */
  const addresses = (html: string): string[] => [
    ...[...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? ''),
    ...[...html.matchAll(/"specUrl":\s*"([^"]+)"|specUrl = "([^"]+)"/g)].map(
      (m) => m[1] ?? m[2] ?? '',
    ),
  ];

  it('serves the page on the production host', async () => {
    expect(await docsPage(PROD)).toContain('Yawelo Idle roadmap API');
  });

  it('keeps the page behind the door on dev', async () => {
    const response = await bare(`${DEV}${DOCS}`);
    expect(response.status).toBe(403);
  });

  it('serves the page on dev through the door', async () => {
    expect(await docsPage(DEV)).toContain('Yawelo Idle roadmap API');
  });

  it('loads every file from the site’s own origin, never a CDN', async () => {
    const found = addresses(await docsPage(PROD));
    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(found.filter((a) => !a.startsWith('/'))).toEqual([]);
  });

  it('serves Swagger UI’s script and stylesheet from the site', async () => {
    const found = addresses(await docsPage(PROD)).filter((a) =>
      /swagger-ui/.test(a),
    );
    expect(
      found.map((a) => a.replace(/^.*\//, '').replace(/\..*$/, '')).sort(),
    ).toEqual(['swagger-ui', 'swagger-ui-bundle']);
    const answers = await Promise.all(found.map((a) => get(`${PROD}${a}`)));
    expect(answers.map((r) => r.status)).toEqual([200, 200]);
  });

  it('serves the hand-written spec, byte for byte', async () => {
    const specUrl = addresses(await docsPage(PROD)).find((a) =>
      a.endsWith('.json'),
    );
    expect(specUrl).toBeDefined();
    const response = await get(`${PROD}${specUrl ?? ''}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(SPEC);
  });

  it('turns off the validator badge, which calls validator.swagger.io', async () => {
    expect(await docsPage(PROD)).toMatch(/validatorUrl:\s*null/);
  });
});

describe('the private API docs, dev only (#589)', () => {
  const { docs: DOCS, spec: SPEC_PATH } = PRIVATE_PATHS;
  const PRIVATE_SPEC: unknown = JSON.parse(
    readFileSync(
      new URL('../api/private.openapi.json', import.meta.url),
      'utf8',
    ),
  );

  /** Every address the page loads from: src, href and the spec's url. */
  const addresses = (html: string): string[] => [
    ...[...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? ''),
    ...[...html.matchAll(/url: '([^']+)'/g)].map((m) => m[1] ?? ''),
  ];

  const docsPage = async (): Promise<string> => {
    const response = await get(`${DEV}${DOCS}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^text\/html/);
    return response.text();
  };

  it('answers 404 for the page on the production host', async () => {
    expect((await get(`${PROD}${DOCS}`)).status).toBe(404);
  });

  it('answers 404 for the page’s file name on the production host', async () => {
    expect((await get(`${PROD}${DOCS}.html`)).status).toBe(404);
  });

  it('answers 404 for an encoded, upper-case spelling on the production host', async () => {
    expect((await get(`${PROD}/API/%70rivate/docs`)).status).toBe(404);
  });

  it('answers 404 for the spec on the production host', async () => {
    expect((await get(`${PROD}${SPEC_PATH}`)).status).toBe(404);
  });

  it('answers 404 for POST on the production host', async () => {
    const response = await server.fetch(`${PROD}${DOCS}`, { method: 'POST' });
    expect(response.status).toBe(404);
  });

  it('keeps the page behind the door on dev', async () => {
    expect((await bare(`${DEV}${DOCS}`)).status).toBe(403);
  });

  it('keeps the spec behind the door on dev', async () => {
    expect((await bare(`${DEV}${SPEC_PATH}`)).status).toBe(403);
  });

  it('refuses a wrong door secret on dev', async () => {
    const response = await get(`${DEV}${DOCS}`, {
      [DOOR_SECRET_HEADER]: 'not-the-door-secret',
    });
    expect(response.status).toBe(403);
  });

  it('serves the page on dev through the door', async () => {
    expect(await docsPage()).toContain('Yawelo Idle private operations API');
  });

  it('serves the hand-written spec on dev through the door', async () => {
    const response = await get(`${DEV}${SPEC_PATH}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual(PRIVATE_SPEC);
  });

  it('points Swagger UI at the Worker’s spec', async () => {
    expect(addresses(await docsPage())).toContain(SPEC_PATH);
  });

  it('loads every file from the site’s own origin, never a CDN', async () => {
    const found = addresses(await docsPage());
    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(found.filter((a) => !a.startsWith('/'))).toEqual([]);
  });

  it('turns off the validator badge, which calls validator.swagger.io', async () => {
    expect(await docsPage()).toMatch(/validatorUrl:\s*null/);
  });

  it('builds no copy of the private spec into the pages', () => {
    const built = readdirSync(new URL('../dist', import.meta.url), {
      recursive: true,
      encoding: 'utf8',
    });
    expect(built.filter((f) => f.includes('private.openapi'))).toEqual([]);
  });

  it('is linked from no other built page, in either build', () => {
    const roots = ['../dist/', '../dist-holding/'];
    // runtime population: the pages the two builds wrote.
    const linking = roots.flatMap((root) =>
      readdirSync(new URL(root, import.meta.url), {
        recursive: true,
        encoding: 'utf8',
      })
        .filter((f) => f.endsWith('.html') && f !== 'api/private/docs.html')
        .filter((f) =>
          readFileSync(
            new URL(`${root}${f}`, import.meta.url),
            'utf8',
          ).includes('/api/private'),
        )
        .map((f) => `${root}${f}`),
    );
    expect(linking).toEqual([]);
  });
});

/**
 * The support pages (#860): ShyDesk's piece, loaded from ShyDesk's own dev
 * host (relayed by shydesk-b1, 2026-11-22), on the site being built and
 * through the dev front door (#860; it shows the site being built everywhere since #1078)
 * (Shyden, 2026-11-22: "let /support through the doors").
 */
describe('the support pages (#860)', () => {
  const SHYDESK_DEV = 'https://shydesk.shydesk-non-prod.workers.dev';
  const SUPPORT: [Locale, Page, 'contact' | 'ticket'][] = [
    ['en', 'support', 'contact'],
    ['en', 'supportTicket', 'ticket'],
    ['id', 'support', 'contact'],
    ['id', 'supportTicket', 'ticket'],
  ];

  it.each(SUPPORT)(
    '%s %s embeds ShyDesk’s %s view from ShyDesk’s dev host, with its own words, through the front door',
    async (locale, page, view) => {
      const response = await front(pagePath(locale, page));
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Security-Policy')).toBe(
        supportPolicy(SHYDESK_DEV),
      );
      const html = await response.text();
      expect(html).not.toContain(' data-coming-soon>');
      expect(html).toContain(
        `<script src="${SHYDESK_DEV}/embed.js" defer></script>`,
      );
      expect(html).toContain(
        `<shydesk-support product="yawelo-idle" view="${view}" lang="${locale}"`,
      );
      expect(html).toContain(
        `<h1>${COPY[locale].titles[page as 'support']}</h1>`,
      );
      const intro =
        view === 'contact'
          ? COPY[locale].support.intro
          : COPY[locale].support.ticketIntro;
      expect(html).toContain(`<p data-support-intro>${intro}</p>`);
      expect(html).toContain(
        `<p data-support-failed hidden>${COPY[locale].support.failed}</p>`,
      );
    },
  );

  it('serves the stylesheet the support page links through the front door, as CSS', async () => {
    const html = await (await front('/support')).text();
    const link = /<link rel="stylesheet" href="(\/_site\/[^"]+\.css)">/;
    expect(html, 'a stylesheet under /_site/').toMatch(link);
    const href = link.exec(html)?.[1];
    const response = await front(String(href));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^text\/css\b/);
  });

  it('serves the script the support page runs through the front door, as JavaScript', async () => {
    const html = await (await front('/support')).text();
    const script =
      /<script type="module" src="(\/_site\/[^"]+\.js)"><\/script>/;
    expect(html, 'a module script under /_site/').toMatch(script);
    const src = script.exec(html)?.[1];
    const response = await front(String(src));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(
      /^(text|application)\/javascript\b/,
    );
  });

  it('sends a browser preferring Indonesian from the ticket address to the Indonesian ticket page', async () => {
    const response = await front('/support/ticket', {
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      'Sec-Fetch-Site': 'cross-site',
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/id/support/ticket');
  });

  it('keeps the English ticket page for a reader who switched to it on the site', async () => {
    const response = await front('/support/ticket', {
      'Accept-Language': 'id-ID,id;q=0.9',
      'Sec-Fetch-Site': 'same-origin',
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('view="ticket" lang="en"');
  });

  it.each([DEV, PROD])(
    'forwards nothing at %s/support-api/embed.js (AC3)',
    async (origin) => {
      const response = await get(`${origin}/support-api/embed.js`);
      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toMatch(/^text\/html\b/);
    },
  );

  it('forwards nothing at /support-api/embed.js through the front door (AC3)', async () => {
    const response = await front('/support-api/embed.js');
    expect(response.status).toBe(404);
  });
});
