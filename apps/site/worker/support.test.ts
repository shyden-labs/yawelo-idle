import { describe, expect, it } from 'vitest';
import {
  isSupportPath,
  passesTheDoor,
  preferredLocale,
  SHYDESK_SENTINEL,
  serveSupport,
  supportPage,
  supportPolicy,
  ticketRedirect,
} from './support';

/**
 * The support pages (#860): ShyDesk's piece embedded from ShyDesk's own host,
 * never forwarded through Yawelo Idle (Shyden, 2026-11-22). The Worker lets
 * the support paths and the full site's own files through the holding door,
 * names ShyDesk's host in the page and its security policy, and sends a
 * browser that prefers Indonesian from the one ticket address ShyDesk links
 * to the Indonesian ticket page.
 */
const HOST = 'https://shydesk.shydesk-non-prod.workers.dev';

describe('isSupportPath (#860)', () => {
  it.each(['/support', '/support/ticket', '/id/support', '/id/support/ticket'])(
    'names %s',
    (path) => {
      expect(isSupportPath(path)).toBe(true);
    },
  );

  it.each([
    '/support-api/embed.js',
    '/support-api',
    '/supportx',
    '/support/',
    '/support/other',
    '/id/support-api/embed.js',
    '/',
  ])('does not name %s', (path) => {
    expect(isSupportPath(path)).toBe(false);
  });
});

describe('passesTheDoor (#860)', () => {
  it.each(['/support', '/id/support/ticket', '/_site/Base.abc123.css'])(
    'lets %s through to the full site',
    (path) => {
      expect(passesTheDoor(path)).toBe(true);
    },
  );

  it.each(['/', '/_astro/Holding.abc.css', '/roadmap', '/_sitex/a.css'])(
    'keeps %s on the holding page',
    (path) => {
      expect(passesTheDoor(path)).toBe(false);
    },
  );
});

describe('supportPolicy (#860 AC6)', () => {
  it('admits only the site and ShyDesk’s host, with Turnstile’s frame and script', () => {
    expect(supportPolicy(HOST)).toBe(
      [
        "default-src 'none'",
        `script-src 'self' ${HOST} https://challenges.cloudflare.com`,
        `connect-src ${HOST}`,
        'frame-src https://challenges.cloudflare.com',
        "img-src 'self' blob:",
        'media-src blob:',
        // ShyDesk's piece writes a <style> into its shadow root until
        // shyden-labs/shydesk#266 (#1075 takes this away).
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
  });
});

describe('preferredLocale (#860)', () => {
  it.each([
    ['id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7', 'id'],
    ['id', 'id'],
    ['en-GB,en;q=0.9,id;q=0.8', 'en'],
    ['fr-FR,id;q=0.5', 'id'],
    ['en;q=0.4,id;q=0.6', 'id'],
    ['id;q=0.5,en;q=0.5', 'id'],
    ['en;q=0.5,id;q=0.5', 'en'],
    ['fr-FR,de;q=0.9', 'en'],
    ['', 'en'],
    ['*', 'en'],
    ['id;q=0', 'en'],
    ['ID-id', 'id'],
    ['indonesian', 'en'],
  ] as const)('reads %j as %s', (header, locale) => {
    expect(preferredLocale(header)).toBe(locale);
  });

  it('reads a missing header as English', () => {
    expect(preferredLocale(null)).toBe('en');
  });
});

describe('ticketRedirect (#860)', () => {
  const ticket = (
    headers: Record<string, string>,
    path = '/support/ticket',
    method = 'GET',
  ) =>
    ticketRedirect(
      new Request(`https://dev.yaweloidle.com${path}`, { headers, method }),
    );

  it('sends a browser that prefers Indonesian to the Indonesian ticket page, keeping the query', () => {
    const response = ticketRedirect(
      new Request('https://dev.yaweloidle.com/support/ticket?from=mail', {
        headers: {
          'Accept-Language': 'id-ID,id;q=0.9',
          'Sec-Fetch-Site': 'none',
        },
      }),
    );
    expect(response?.status).toBe(302);
    expect(response?.headers.get('Location')).toBe(
      '/id/support/ticket?from=mail',
    );
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(response?.headers.get('Vary')).toBe(
      'Accept-Language, Sec-Fetch-Site',
    );
  });

  it('sends one from another site, such as a webmail link, too', () => {
    const response = ticket({
      'Accept-Language': 'id',
      'Sec-Fetch-Site': 'cross-site',
    });
    expect(response?.headers.get('Location')).toBe('/id/support/ticket');
  });

  it('sends one whose browser names no fetch site', () => {
    expect(ticket({ 'Accept-Language': 'id' })?.status).toBe(302);
  });

  it('sends a HEAD the same way', () => {
    expect(
      ticket({ 'Accept-Language': 'id' }, '/support/ticket', 'HEAD')?.status,
    ).toBe(302);
  });

  it('keeps a reader who chose English on this site (the language switch)', () => {
    expect(
      ticket({ 'Accept-Language': 'id', 'Sec-Fetch-Site': 'same-origin' }),
    ).toBeUndefined();
  });

  it('keeps a browser that prefers English', () => {
    expect(ticket({ 'Accept-Language': 'en-GB,en;q=0.9' })).toBeUndefined();
  });

  it.each([
    '/id/support/ticket',
    '/support',
    '/id/support',
    '/support/ticket/',
  ])('never redirects %s', (path) => {
    expect(ticket({ 'Accept-Language': 'id' }, path)).toBeUndefined();
  });

  it('never redirects a POST', () => {
    expect(
      ticket({ 'Accept-Language': 'id' }, '/support/ticket', 'POST'),
    ).toBeUndefined();
  });
});

describe('supportPage (#860)', () => {
  const PAGE = `<!doctype html><html><head><script src="${SHYDESK_SENTINEL}/embed.js" defer></script></head><body><shydesk-support product="yawelo-idle" view="contact" lang="en"></shydesk-support></body></html>`;
  const built = () =>
    new Response(PAGE, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"abc"' },
    });

  it('names ShyDesk’s host where the page loads its piece', async () => {
    const html = await (await supportPage(built(), HOST)).text();
    expect(html).toContain(`<script src="${HOST}/embed.js" defer></script>`);
    expect(html).not.toContain(SHYDESK_SENTINEL);
  });

  it('adds the support policy for that host', async () => {
    const response = await supportPage(built(), HOST);
    expect(response.headers.get('Content-Security-Policy')).toBe(
      supportPolicy(HOST),
    );
  });

  it('keeps the page’s status and type, and drops its ETag (the bytes changed)', async () => {
    const response = await supportPage(built(), HOST);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'text/html; charset=utf-8',
    );
    expect(response.headers.get('ETag')).toBeNull();
  });

  it('says it varies by language and fetch site, as the ticket address does', async () => {
    const response = await supportPage(built(), HOST);
    expect(response.headers.get('Vary')).toBe(
      'Accept-Language, Sec-Fetch-Site',
    );
  });

  it('passes a page that is not there through untouched', async () => {
    const missing = new Response('not found', { status: 404 });
    const response = await supportPage(missing, HOST);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('not found');
  });

  it.each([
    undefined,
    '',
    'http://shydesk.example',
    'shydesk.example',
    `${HOST}/`,
  ])(
    'refuses to serve the page with ShyDesk’s host set to %j, naming the setting',
    async (host) => {
      const response = await supportPage(built(), host);
      expect(response.status).toBe(503);
      expect(await response.text()).toBe(
        'SHYDESK_HOST is not an https origin: the support page cannot name ShyDesk’s host',
      );
    },
  );
});

describe('serveSupport (#860)', () => {
  const assets = (seen: string[]) => ({
    fetch: (request: Request): Promise<Response> => {
      seen.push(new URL(request.url).pathname);
      return Promise.resolve(
        new Response(
          `<script src="${SHYDESK_SENTINEL}/embed.js" defer></script>`,
          {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          },
        ),
      );
    },
  });

  it('sends a browser preferring Indonesian on, reading no page', async () => {
    const seen: string[] = [];
    const response = await serveSupport(
      new Request('https://dev.yaweloidle.com/support/ticket', {
        headers: { 'Accept-Language': 'id' },
      }),
      assets(seen),
      HOST,
    );
    expect(response.status).toBe(302);
    expect(seen).toEqual([]);
  });

  it('serves the built page with ShyDesk’s host and the policy otherwise', async () => {
    const seen: string[] = [];
    const response = await serveSupport(
      new Request('https://dev.yaweloidle.com/support'),
      assets(seen),
      HOST,
    );
    expect(seen).toEqual(['/support']);
    expect(response.headers.get('Content-Security-Policy')).toBe(
      supportPolicy(HOST),
    );
    expect(await response.text()).toContain(`${HOST}/embed.js`);
  });
});
