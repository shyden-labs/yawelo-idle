/**
 * The support pages (#860): ShyDesk's shared piece, served and run by ShyDesk
 * from its own host; Yawelo Idle forwards nothing (Shyden, 2026-11-22). The
 * site Worker lets these pages and the full site's own files through the
 * holding door (Shyden, 2026-11-22: "let /support through the doors"), names
 * ShyDesk's host for its environment in the page and in the page's security
 * policy, and sends a browser that prefers Indonesian from the one ticket
 * address ShyDesk links to (a single `ticketPageUrl` per product) to the
 * Indonesian ticket page. Browsers keep a URL's fragment across a redirect,
 * so the ticket's `#t=` token survives it.
 */
import { DEFAULT_LOCALE, LOCALES, pagePath, type Locale } from '../src/i18n';

/**
 * Where the built pages name ShyDesk's host, replaced by the Worker. An
 * `.invalid` name never resolves (RFC 2606), so a page served unreplaced
 * loads nothing from anywhere.
 */
export const SHYDESK_SENTINEL = 'https://shydesk.invalid';

/** Turnstile's script and frame (Cloudflare's CSP page, 2026-05-05). */
const TURNSTILE = 'https://challenges.cloudflare.com';

/** The full site's built files (`build.assets` in astro.config.ts). */
export const SITE_FILES = '/_site/';

const SUPPORT_PATHS: ReadonlySet<string> = new Set(
  LOCALES.flatMap((locale) => [
    pagePath(locale, 'support'),
    pagePath(locale, 'supportTicket'),
  ]),
);

const TICKET = pagePath(DEFAULT_LOCALE, 'supportTicket');

/** The four support pages, by their exact paths. */
export function isSupportPath(pathname: string): boolean {
  return SUPPORT_PATHS.has(pathname);
}

/** What goes through the holding door to the site being built. */
export function passesTheDoor(pathname: string): boolean {
  return isSupportPath(pathname) || pathname.startsWith(SITE_FILES);
}

/** The support pages' security policy, admitting the site and ShyDesk's host only. */
export function supportPolicy(host: string): string {
  return [
    "default-src 'none'",
    `script-src 'self' ${host} ${TURNSTILE}`,
    `connect-src ${host}`,
    `frame-src ${TURNSTILE}`,
    "img-src 'self' blob:",
    'media-src blob:',
    // ShyDesk's piece writes a <style> into its shadow root until
    // shyden-labs/shydesk#266; #1075 takes this away.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * The site's language a browser prefers most, by `Accept-Language` quality
 * (RFC 9110 §12.5.4): a tag counts for a language when its primary subtag
 * matches, the earlier tag wins a tie, `q=0` means "not this", and no match
 * is the default.
 */
export function preferredLocale(header: string | null): Locale {
  let best: { locale: Locale; q: number } | undefined;
  for (const entry of (header ?? '').split(',')) {
    const [tag = '', ...params] = entry.trim().split(';');
    const primary = tag.trim().toLowerCase().split('-')[0];
    const locale = LOCALES.find((known) => known === primary);
    if (locale === undefined) continue;
    const qParam = params
      .map((param) => param.trim().toLowerCase())
      .find((param) => param.startsWith('q='));
    const q = qParam === undefined ? 1 : Number(qParam.slice(2));
    if (!(q > 0)) continue;
    if (best === undefined || q > best.q) best = { locale, q };
  }
  return best?.locale ?? DEFAULT_LOCALE;
}

const VARY = 'Accept-Language, Sec-Fetch-Site';

/**
 * The one ticket address's answer for a browser that prefers Indonesian:
 * a redirect to the Indonesian ticket page, keeping the query. Never for a
 * navigation from this site itself (`Sec-Fetch-Site: same-origin`), which
 * is a reader who chose English with the language switch.
 */
export function ticketRedirect(request: Request): Response | undefined {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined;
  const { pathname, search } = new URL(request.url);
  if (pathname !== TICKET) return undefined;
  if (request.headers.get('Sec-Fetch-Site') === 'same-origin') return undefined;
  if (preferredLocale(request.headers.get('Accept-Language')) !== 'id')
    return undefined;
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${pagePath('id', 'supportTicket')}${search}`,
      'Cache-Control': 'no-store',
      Vary: VARY,
    },
  });
}

/** Whether `host` is an https origin and nothing more. */
function isHttpsOrigin(host: string | undefined): host is string {
  if (host === undefined) return false;
  try {
    const url = new URL(host);
    return url.protocol === 'https:' && url.origin === host;
  } catch {
    return false;
  }
}

/**
 * A built support page, served: ShyDesk's host named where the page loads
 * its piece, and the support policy for that host. A host that is not an
 * https origin refuses the page, naming the setting.
 */
export async function supportPage(
  page: Response,
  host: string | undefined,
): Promise<Response> {
  if (!page.ok) return page;
  if (!isHttpsOrigin(host))
    return new Response(
      'SHYDESK_HOST is not an https origin: the support page cannot name ShyDesk’s host',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  const html = (await page.text()).replaceAll(SHYDESK_SENTINEL, host);
  const headers = new Headers(page.headers);
  headers.delete('ETag');
  headers.delete('Content-Length');
  headers.set('Content-Security-Policy', supportPolicy(host));
  headers.set('Vary', VARY);
  return new Response(html, { status: page.status, headers });
}

/** Where the built pages are read from (the Worker's ASSETS binding). */
export interface Assets {
  fetch(request: Request): Promise<Response>;
}

/**
 * A support page's answer: the ticket address's language redirect, or the
 * built page with ShyDesk's host named and its policy.
 */
export async function serveSupport(
  request: Request,
  assets: Assets,
  host: string | undefined,
): Promise<Response> {
  return (
    ticketRedirect(request) ?? supportPage(await assets.fetch(request), host)
  );
}
