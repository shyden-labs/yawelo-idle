import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from 'wrangler';
import {
  BLOCKING_ROBOTS_TXT,
  challengeResponse,
  NO_INDEX,
} from '@yawelo-idle/lockdown';
import { COPY, LEGAL } from '../src/copy';
import {
  LEGAL_PAGES,
  otherLocale,
  pagePath,
  SITE,
  type Locale,
  type LocalisedPage,
} from '../src/i18n';
import {
  EXEMPT_PATHS,
  HOLDING_HOST,
  PRIVATE_PATHS,
  ROADMAP_PATHS,
} from '../worker/routes';
import { CONTENT_SECURITY_POLICY as GAME_POLICY } from '../../web/worker/policy';

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
const DEV = 'https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev';
const PROD = SITE;
const PASSWORD = 'test-only-password';

const authorised = { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` };
const wrong = { Authorization: `Basic ${btoa('tester:not-it')}` };

const server = createTestHarness({
  root: new URL('..', import.meta.url).pathname,
  workers: [
    {
      configPath: './wrangler.jsonc',
      secrets: { DEV_PASSWORD: PASSWORD },
      bindingOverrides: { HOLDING: 'holding-copy' },
    },
    // The real game Worker, the service wrangler.jsonc's GAME binding names.
    { configPath: '../web/wrangler.jsonc' },
    // The holding page's build, served as assets only, as its dev copy is
    // (apps/site/holding-dev/wrangler.jsonc, #673).
    {
      config: {
        name: 'holding-copy',
        compatibility_date: '2026-10-20',
        assets: { directory: './dist-holding', not_found_handling: '404-page' },
      },
    },
  ],
});

const get = (url: string, headers: Record<string, string> = {}) =>
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

/** The pages each language has: legal pages are English only (#925). */
const PAGES: [Locale, LocalisedPage][] = [
  ['en', 'home'],
  ['en', 'roadmap'],
  ['id', 'home'],
  ['id', 'roadmap'],
];

describe('the dev site Worker gate, through the asset router', () => {
  it('serves the home page with the password, noindex added', async () => {
    const response = await get(`${DEV}/`, authorised);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(await response.text()).toContain('<meta name="yawelo-idle-commit"');
  });

  it.each([
    ['without credentials', {}],
    ['with a wrong password', wrong],
  ])(
    'refuses a real built page %s and sends none of its bytes',
    async (_case, headers) => {
      const page = await (await get(`${DEV}/roadmap`, authorised)).text();
      expect(page).toContain(COPY.en.voyage.intro);
      const response = await get(`${DEV}/roadmap`, headers);
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Basic realm="Yawelo Idle Non-Prod"',
      );
      expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
      expect(await response.text()).toBe(await challengeResponse().text());
    },
  );

  it.each(['/', '/id/', '/index.html', '/privacy', '/no/such/page'])(
    'refuses the page %s without credentials',
    async (path) => {
      const response = await get(`${DEV}${path}`);
      expect(response.status).toBe(401);
      expect(await response.text()).toBe(await challengeResponse().text());
    },
  );

  it.each(['/play', '/play/', '/play/assets/index.js'])(
    'refuses the game path %s without credentials and never forwards it',
    async (path) => {
      const response = await get(`${DEV}${path}`);
      expect(response.status).toBe(401);
      expect(fromGame(response)).toBe(false);
    },
  );

  it('serves blocking robots.txt without credentials', async () => {
    const response = await get(`${DEV}/robots.txt`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
  });

  it('passes the production host through untouched', async () => {
    const page = await (await get(`${DEV}/roadmap`, authorised)).text();
    const response = await get(`${PROD}/roadmap`);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBeNull();
    expect(await response.text()).toBe(page);
  });
});

describe('the paths exempt from the gate (#341 signs them instead)', () => {
  it.each(EXEMPT_PATHS)(
    '%s reaches its handler without credentials, which takes POST only',
    async (path) => {
      const response = await get(`${DEV}${path}`);
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toBe('POST');
      expect(response.headers.get('WWW-Authenticate')).toBeNull();
    },
  );

  it.each(['/hooks/github/', '/hooks/github/x', '/hooks/githubx', '/hooks'])(
    'gates %s, which only looks like an exempt path',
    async (path) => {
      const response = await get(`${DEV}${path}`);
      expect(response.status).toBe(401);
    },
  );
});

describe('the game, forwarded through the GAME binding after the gate', () => {
  // The real game shows what reached it: the file for the path, its shell
  // for a client route, and the query kept in its own redirect.
  it('forwards /play, where the game redirects to /play/ keeping the query', async () => {
    const response = await get(`${DEV}/play?x=1`, authorised);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('/play/?x=1');
    expect(fromGame(response)).toBe(true);
  });

  it('forwards /play/, answered with the game shell', async () => {
    const response = await get(`${DEV}/play/?x=1`, authorised);
    expect(response.status).toBe(200);
    expect(fromGame(response)).toBe(true);
    expect(await response.text()).toBe(GAME_SHELL);
  });

  it('forwards the game script by its path, answered with that file', async () => {
    const response = await get(`${DEV}${GAME_SCRIPT_PATH}?x=1`, authorised);
    expect(response.status).toBe(200);
    expect(fromGame(response)).toBe(true);
    expect(await response.text()).toBe(GAME_SCRIPT);
  });

  it('forwards a client route, answered with the game shell', async () => {
    const response = await get(`${DEV}/play/a/client/route?x=1`, authorised);
    expect(response.status).toBe(200);
    expect(fromGame(response)).toBe(true);
    expect(await response.text()).toBe(GAME_SHELL);
  });

  it('adds noindex to what the game answers on dev', async () => {
    const response = await get(`${DEV}/play/`, authorised);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
  });

  it.each(['/playground', '/plays', '/id/play/'])(
    'keeps %s on the site, which only looks like a game path',
    async (path) => {
      const response = await get(`${DEV}${path}`, authorised);
      expect(response.status).toBe(404);
      expect(fromGame(response)).toBe(false);
    },
  );
});

describe('the placeholder pages, in both languages (#332 AC1, AC2)', () => {
  it.each(PAGES)('%s %s is served at its own path', async (locale, page) => {
    const response = await get(`${DEV}${pagePath(locale, page)}`, authorised);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(`<html lang="${locale}"`);
    expect(html).toContain(`<title>${COPY[locale].titles[page]}</title>`);
  });

  it.each(PAGES)(
    '%s %s carries the development strip in its language',
    async (locale, page) => {
      const html = await (
        await get(`${DEV}${pagePath(locale, page)}`, authorised)
      ).text();
      expect(html).toContain(
        `<p class="dev-strip" data-dev-strip>${COPY[locale].devStrip}</p>`,
      );
    },
  );

  it.each(PAGES)(
    '%s %s switches language to the same page',
    async (locale, page) => {
      const other = otherLocale(locale);
      const html = await (
        await get(`${DEV}${pagePath(locale, page)}`, authorised)
      ).text();
      expect(html).toContain(
        `<a href="${pagePath(other, page)}" hreflang="${other}" lang="${other}" data-language-switch>`,
      );
    },
  );

  it.each(PAGES)(
    '%s %s lists every language as an hreflang alternate',
    async (locale, page) => {
      const html = await (
        await get(`${DEV}${pagePath(locale, page)}`, authorised)
      ).text();
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
      const response = await get(`${DEV}${path}`, authorised);
      expect(response.status).toBe(404);
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}"`);
      expect(html).toContain(COPY[locale].notFoundTitle);
      expect(html).toContain(COPY[locale].devStrip);
    },
  );
});

describe('legal pages are English only (#925)', () => {
  it.each(LEGAL_PAGES)('%s is served in English', async (page) => {
    const response = await get(`${DEV}${pagePath('en', page)}`, authorised);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<html lang="en"');
    expect(html).toContain(`<title>${LEGAL[page].title}</title>`);
    expect(html).toContain(
      `<p class="dev-strip" data-dev-strip>${COPY.en.devStrip}</p>`,
    );
  });

  it.each(LEGAL_PAGES)(
    '%s has no Indonesian address: /id/%s is the Indonesian 404',
    async (page) => {
      const response = await get(`${DEV}/id/${page}`, authorised);
      expect(response.status).toBe(404);
      const html = await response.text();
      expect(html).toContain('<html lang="id"');
      expect(html).toContain(COPY.id.notFoundTitle);
    },
  );

  it.each(LEGAL_PAGES)(
    '%s carries the Indonesian note, marked as Indonesian',
    async (page) => {
      const html = await (
        await get(`${DEV}${pagePath('en', page)}`, authorised)
      ).text();
      expect(html).toContain(
        `<p lang="id" data-english-only-note>${COPY.id.englishOnlyNote}</p>`,
      );
    },
  );

  it.each(LEGAL_PAGES)('%s offers no language switch', async (page) => {
    const html = await (
      await get(`${DEV}${pagePath('en', page)}`, authorised)
    ).text();
    expect(html).not.toContain('data-language-switch');
  });

  it.each(LEGAL_PAGES)(
    '%s lists English and x-default as its only hreflang alternates',
    async (page) => {
      const html = await (
        await get(`${DEV}${pagePath('en', page)}`, authorised)
      ).text();
      const links = [...html.matchAll(/<link rel="alternate"[^>]*>/g)].map(
        ([link]) => link,
      );
      expect(links).toEqual([
        `<link rel="alternate" hreflang="en" href="${SITE}${pagePath('en', page)}">`,
        `<link rel="alternate" hreflang="x-default" href="${SITE}${pagePath('en', page)}">`,
      ]);
    },
  );
});

/** The dev front door: the holding page, with the game and the roadmap kept (#673). */
const FRONT = `https://${HOLDING_HOST}`;

describe('the dev front door shows the holding page production shows (#673)', () => {
  it.each(['/', '/id/'])(
    'shows the holding page at %s with the password, noindex added',
    async (path) => {
      const response = await get(`${FRONT}${path}`, authorised);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
      const html = await response.text();
      expect(html).toContain(' data-coming-soon>');
    },
  );

  it('serves the stylesheet the holding page links, as CSS', async () => {
    const html = await (await get(`${FRONT}/`, authorised)).text();
    // Matched on the page, never on the href: toMatch throws on a missing
    // href before it adds this message, so the failure would not say why.
    const link =
      /<link rel="stylesheet" href="(\/_astro\/Holding\.[^"]+\.css)">/;
    expect(html, 'the Holding stylesheet').toMatch(link);
    const href = link.exec(html)?.[1];
    const response = await get(`${FRONT}${String(href)}`, authorised);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^text\/css\b/);
  });

  it.each(['/', '/id/', '/no/such/page'])(
    'refuses %s on the front door without credentials',
    async (path) => {
      const response = await get(`${FRONT}${path}`);
      expect(response.status).toBe(401);
      expect(await response.text()).toBe(await challengeResponse().text());
    },
  );

  it('serves blocking robots.txt on the front door without credentials', async () => {
    const response = await get(`${FRONT}/robots.txt`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
  });

  it('forwards the game on the front door', async () => {
    const response = await get(`${FRONT}/play/`, authorised);
    expect(response.status).toBe(200);
    expect(fromGame(response)).toBe(true);
    expect(await response.text()).toBe(GAME_SHELL);
  });

  it('answers the roadmap’s health on the front door, not the holding page', async () => {
    const response = await get(`${FRONT}${ROADMAP_PATHS.health}`, authorised);
    expect(response.headers.get('Content-Type')).toMatch(
      /^application\/json\b/,
    );
  });

  it.each(EXEMPT_PATHS)(
    'takes %s on the front door without credentials, POST only',
    async (path) => {
      const response = await get(`${FRONT}${path}`);
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toBe('POST');
    },
  );

  it('keeps the site being built at the Worker’s own address', async () => {
    const html = await (await get(`${DEV}/`, authorised)).text();
    expect(html).toContain(' data-dev-strip>');
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

  it('serves the page on the production host without a password', async () => {
    expect(await docsPage(PROD)).toContain('Yawelo Idle roadmap API');
  });

  it('keeps the page behind the password on dev', async () => {
    const response = await get(`${DEV}${DOCS}`);
    expect(response.status).toBe(401);
  });

  it('serves the page on dev with the password', async () => {
    expect(await docsPage(DEV, authorised)).toContain(
      'Yawelo Idle roadmap API',
    );
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
    const response = await get(`${DEV}${DOCS}`, authorised);
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

  it('keeps the page behind the password on dev', async () => {
    expect((await get(`${DEV}${DOCS}`)).status).toBe(401);
  });

  it('keeps the spec behind the password on dev', async () => {
    expect((await get(`${DEV}${SPEC_PATH}`)).status).toBe(401);
  });

  it('keeps the page behind the password on the dev front door', async () => {
    expect((await get(`https://${HOLDING_HOST}${DOCS}`)).status).toBe(401);
  });

  it('refuses a wrong password on dev', async () => {
    expect((await get(`${DEV}${DOCS}`, wrong)).status).toBe(401);
  });

  it('serves the page on dev with the password', async () => {
    expect(await docsPage()).toContain('Yawelo Idle private operations API');
  });

  it('serves the hand-written spec on dev with the password', async () => {
    const response = await get(`${DEV}${SPEC_PATH}`, authorised);
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
