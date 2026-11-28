/**
 * The non-prod lockdown for Yawelo Idle's Workers (#39): on every host but
 * production, a blocking robots.txt and the noindex header. The password
 * gate it once held is retired (#1078 AC3): each dev origin requires its
 * door (apps/door/worker/origin.ts), which checks the shared DEV pass.
 *
 * The production hostname is matched exactly and case-insensitively, and
 * passes through untouched.
 */

/** The production web hostname. Attaching it is the production pipeline's job. */
export const PROD_HOSTNAME = 'yaweloidle.com';

/** The production sync API hostname. */
export const PROD_API_HOSTNAME = 'api.yaweloidle.com';

/** Sent on every non-prod response: no index, no link crawl, no cached copy. */
export const NO_INDEX = 'noindex, nofollow, noarchive';

/** The robots.txt every non-prod host serves. */
export const BLOCKING_ROBOTS_TXT = [
  '# A non-prod Yawelo Idle environment, blocked from indexing.',
  '# The public robots.txt is served only on yaweloidle.com.',
  'User-agent: *',
  'Disallow: /',
  '',
].join('\n');

/** Serves a request once the gate has let it through. */
export type Serve = (request: Request) => Promise<Response>;

/**
 * True only when `hostname` is exactly `prodHostname`, ignoring case (DNS
 * does). Exact equality, never a prefix or suffix test, so neither
 * `dev.yaweloidle.com` nor `yaweloidle.com.evil.com` passes.
 */
export function isProdHost(hostname: string, prodHostname: string): boolean {
  return hostname.length > 0 && hostname.toLowerCase() === prodHostname;
}

/** The blocking robots.txt, served on non-prod hosts. */
export function robotsResponse(): Response {
  return new Response(BLOCKING_ROBOTS_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': NO_INDEX,
    },
  });
}

/** A copy of `response` with the noindex header set; status and body kept. */
export function withNoIndex(response: Response): Response {
  const tagged = new Response(response.body, response);
  tagged.headers.set('X-Robots-Tag', NO_INDEX);
  return tagged;
}

/**
 * The site Worker's marking once its door is the gate (#1078 AC3): no
 * password, the origin refusing any request its door did not send
 * (apps/door/worker/origin.ts). On the production host the request is served
 * untouched; on any other host `/robots.txt` is blocking and every other
 * response carries noindex.
 */
export async function markWebRequest(
  request: Request,
  serve: Serve,
): Promise<Response> {
  const { hostname, pathname } = new URL(request.url);
  if (isProdHost(hostname, PROD_HOSTNAME)) return serve(request);
  if (pathname === '/robots.txt') return robotsResponse();
  return withNoIndex(await serve(request));
}

/**
 * The sync Worker's marking, with no password (operator decision). On the
 * production API host the request is served untouched; on any other host
 * `/robots.txt` is blocking and every other response carries noindex.
 */
export async function markApiRequest(
  request: Request,
  serve: Serve,
): Promise<Response> {
  const { hostname, pathname } = new URL(request.url);
  if (isProdHost(hostname, PROD_API_HOSTNAME)) return serve(request);
  if (pathname === '/robots.txt') return robotsResponse();
  return withNoIndex(await serve(request));
}
