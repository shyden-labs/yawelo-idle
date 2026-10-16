import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MEDIA_HEADERS,
  mediaResponse,
  parseRange,
} from '../../apps/site/holding/media';
import { headerRules } from '../../scripts/headers-file';

/**
 * The holding page's media answered in byte ranges (#621). Measured
 * 2026-10-16: Cloudflare's static assets answer `Range: bytes=0-1` with 200
 * and the whole file, and the promo video stayed on its poster in Safari on a
 * physical iPhone Air while it played in Chrome on Android. Apple: "HTTP
 * servers hosting media files for iOS must support byte-range requests".
 */
const SIZE = 10;
const BYTES = Uint8Array.from({ length: SIZE }, (_, at) => at);

/** Stands in for the ASSETS binding: one file, or a 404. */
const assets = (found = true) => ({
  fetch: (request: Request): Promise<Response> => {
    if (request.headers.has('range'))
      throw new Error('the assets binding was asked for a range');
    return Promise.resolve(
      found
        ? new Response(BYTES, {
            headers: {
              'content-type': 'video/mp4',
              'content-length': String(SIZE),
              etag: '"abc"',
            },
          })
        : new Response('Not found', { status: 404 }),
    );
  },
});

const ask = (headers: Record<string, string> = {}, method = 'GET'): Request =>
  new Request('https://example.test/media/promo.mp4', { method, headers });

describe('a Range header (RFC 9110 §14.1.2)', () => {
  it.each([
    ['bytes=0-1', { start: 0, end: 1 }],
    ['bytes=5-', { start: 5, end: 9 }],
    ['bytes=-3', { start: 7, end: 9 }],
    ['bytes=2-100', { start: 2, end: 9 }],
  ] as const)('reads %s of 10 bytes', (header, range) => {
    expect(parseRange(header, SIZE)).toEqual(range);
  });

  it.each([['bytes=10-'], ['bytes=-0'], ['bytes=7-3']])(
    'calls %s of 10 bytes unsatisfiable',
    (header) => {
      expect(parseRange(header, SIZE)).toBe('unsatisfiable');
    },
  );

  it.each([['items=0-1'], ['bytes=a-b'], ['bytes=0-1,3-4'], ['bytes=-']])(
    'ignores %s, so the whole file is served',
    (header) => {
      expect(parseRange(header, SIZE)).toBe('whole');
    },
  );

  it('serves the whole file when there is no Range header', () => {
    expect(parseRange(null, SIZE)).toBe('whole');
  });
});

describe('a media answer', () => {
  it('answers a range with 206, exactly those bytes and their Content-Range', async () => {
    const answer = await mediaResponse(ask({ range: 'bytes=2-4' }), assets());
    expect(answer.status).toBe(206);
    expect(answer.headers.get('content-range')).toBe('bytes 2-4/10');
    expect(answer.headers.get('content-length')).toBe('3');
    expect([...new Uint8Array(await answer.arrayBuffer())]).toEqual([2, 3, 4]);
  });

  it('answers no range with 200 and the whole file, saying ranges are accepted', async () => {
    const answer = await mediaResponse(ask(), assets());
    expect(answer.status).toBe(200);
    expect(answer.headers.get('accept-ranges')).toBe('bytes');
    expect(answer.headers.get('content-length')).toBe('10');
    expect([...new Uint8Array(await answer.arrayBuffer())]).toEqual([...BYTES]);
  });

  it('answers an unsatisfiable range with 416 and the size', async () => {
    const answer = await mediaResponse(ask({ range: 'bytes=10-' }), assets());
    expect(answer.status).toBe(416);
    expect(answer.headers.get('content-range')).toBe('bytes */10');
  });

  it('answers HEAD with the headers and no body', async () => {
    const answer = await mediaResponse(ask({}, 'HEAD'), assets());
    expect(answer.status).toBe(200);
    expect(answer.headers.get('content-length')).toBe('10');
    expect(await answer.text()).toBe('');
  });

  it('keeps the file’s type and etag', async () => {
    const answer = await mediaResponse(ask({ range: 'bytes=0-0' }), assets());
    expect(answer.headers.get('content-type')).toBe('video/mp4');
    expect(answer.headers.get('etag')).toBe('"abc"');
  });

  it('sets every header _headers gives the media, which a Worker answer does not get on its own', async () => {
    const answer = await mediaResponse(ask({ range: 'bytes=0-0' }), assets());
    expect(
      [...MEDIA_HEADERS].map(([name]) => [name, answer.headers.get(name)]),
    ).toEqual([...MEDIA_HEADERS]);
  });

  it('passes a missing file’s 404 through', async () => {
    const answer = await mediaResponse(ask(), assets(false));
    expect(answer.status).toBe(404);
  });

  it('refuses a method other than GET or HEAD', async () => {
    const answer = await mediaResponse(ask({}, 'POST'), assets());
    expect(answer.status).toBe(405);
    expect(answer.headers.get('allow')).toBe('GET, HEAD');
  });
});

describe('the media headers’ one source', () => {
  it('are exactly the _headers rules for every path and for /media/*', () => {
    const rules = headerRules(
      readFileSync(
        new URL('../../apps/site/holding/public/_headers', import.meta.url),
        'utf8',
      ),
    );
    expect(new Map(MEDIA_HEADERS)).toEqual(
      new Map([...(rules.get('/*') ?? []), ...(rules.get('/media/*') ?? [])]),
    );
  });
});
