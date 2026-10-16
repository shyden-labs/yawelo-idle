/**
 * The holding page's media, answered in byte ranges (#621). Cloudflare's
 * static assets answer `Range: bytes=0-1` with 200 and the whole file
 * (measured 2026-10-16), and Safari on iPhone then shows only the poster:
 * "HTTP servers hosting media files for iOS must support byte-range requests"
 * (Apple, Safari HTML5 Audio and Video Guide). So /media/* runs this, in front
 * of the assets, and every other path stays a plain static file.
 *
 * One range per request (RFC 9110 §14.1.2): a multi-range or malformed header
 * is ignored and the whole file served, as the RFC allows; an unsatisfiable
 * one gets 416 with the size.
 */

/** The ASSETS binding, as much of it as this uses. */
export interface Assets {
  fetch(request: Request): Promise<Response>;
}

/**
 * The headers `_headers` sets on /media/* (its `/*` and `/media/*` rules),
 * which a Worker's answer does not get by itself. A unit test pins this equal
 * to `_headers`, so the two cannot drift.
 */
export const MEDIA_HEADERS: readonly [string, string][] = [
  [
    'content-security-policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  ],
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'no-referrer'],
  [
    'permissions-policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  ],
  ['cross-origin-resource-policy', 'same-site'],
];

export type Range = { start: number; end: number } | 'unsatisfiable' | 'whole';

/** The one byte range a `Range` header asks of a `size`-byte file. */
export function parseRange(header: string | null, size: number): Range {
  if (header === null) return 'whole';
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null) return 'whole';
  const [, from = '', to = ''] = match;
  if (from === '' && to === '') return 'whole';
  if (from === '') {
    const suffix = Number(to);
    if (suffix === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(from);
  const end = to === '' ? size - 1 : Math.min(Number(to), size - 1);
  if (start >= size || end < start) return 'unsatisfiable';
  return { start, end };
}

/** The answer to a GET or HEAD for a media file, in a byte range when asked. */
export async function mediaResponse(
  request: Request,
  assets: Assets,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response('Method not allowed', {
      status: 405,
      headers: { allow: 'GET, HEAD' },
    });
  // The whole file, asked for without the range the assets would ignore.
  const asset = await assets.fetch(new Request(request.url));
  if (!asset.ok) return asset;
  const bytes = new Uint8Array(await asset.arrayBuffer());
  const headers = new Headers([...MEDIA_HEADERS]);
  for (const name of ['content-type', 'etag', 'cache-control']) {
    const value = asset.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set('accept-ranges', 'bytes');
  const range = parseRange(request.headers.get('range'), bytes.length);
  if (range === 'unsatisfiable') {
    headers.set('content-range', `bytes */${String(bytes.length)}`);
    return new Response(null, { status: 416, headers });
  }
  const { status, body } =
    range === 'whole'
      ? { status: 200, body: bytes }
      : {
          status: 206,
          body: bytes.subarray(range.start, range.end + 1),
        };
  if (range !== 'whole')
    headers.set(
      'content-range',
      `bytes ${String(range.start)}-${String(range.end)}/${String(bytes.length)}`,
    );
  headers.set('content-length', String(body.length));
  return new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers,
  });
}
