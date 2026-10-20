import { describe, expect, it } from 'vitest';
import type { Probe } from '../../scripts/verify-dev';
import { DEV_MEDIA, type MediaHost } from '../../apps/site/src/media';
import {
  mediaJudgement,
  mediaProblems,
  notFoundJudgement,
  notFoundProblems,
  pageJudgement,
  pageProblems,
  pastEndJudgement,
  pastEndProblems,
  rangeJudgement,
  rangeProblems,
  reportedCommit,
  robotsJudgement,
  robotsProblems,
  type MediaProbe,
  type MediaSource,
} from '../../scripts/verify-prod';
import { floorBreach } from '../floors';
import { searched } from '../searched';

/**
 * The production verify's judgements (#621 AC5), each fed a constructed
 * answer and a constructed "built" file: no request leaves the process.
 */
const SHA = 'a'.repeat(40);
const RULES = new Map([
  ['content-security-policy', "default-src 'none'"],
  ['x-content-type-options', 'nosniff'],
]);

const page = (body: string, sha = SHA): string =>
  `<!doctype html><html><head><meta name="yawelo-idle-commit" content="${sha}"></head><body>${body}</body></html>`;
const BUILT = page('Yawelo Idle');

const HEADERS = {
  'content-type': 'text/html',
  'content-security-policy': "default-src 'none'",
  'x-content-type-options': 'nosniff',
};
const answer = (
  status: number,
  body: string,
  headers: Record<string, string> = HEADERS,
): Probe => ({ status, headers: new Headers(headers), body });

describe('a holding home page', () => {
  it('passes when it is 200 HTML of this commit, exactly as built, with every header', () => {
    const judged = pageJudgement('/', answer(200, BUILT), BUILT, SHA, RULES);
    expect(
      searched(judged.problems, { of: judged.checked, what: 'page checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-prod/page-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('names a status other than 200, and judges nothing else', () => {
    expect(pageProblems('/', answer(503, BUILT), BUILT, SHA, RULES)).toEqual([
      '/: status 503, expected 200',
    ]);
  });

  it('names another commit, whose page also differs from the build', () => {
    const old = page('Yawelo Idle', 'b'.repeat(40));
    expect(pageProblems('/', answer(200, old), BUILT, SHA, RULES)).toEqual([
      `/: serves commit ${'b'.repeat(40)}, expected ${SHA}`,
      `/: is not the page this commit builds (${String(old.length)} characters served, ${String(BUILT.length)} built)`,
    ]);
  });

  it('names a page that differs from the build', () => {
    const edited = page('Yawelo');
    expect(pageProblems('/', answer(200, edited), BUILT, SHA, RULES)).toEqual([
      `/: is not the page this commit builds (${String(edited.length)} characters served, ${String(BUILT.length)} built)`,
    ]);
  });

  it('names a cookie', () => {
    expect(
      pageProblems(
        '/',
        answer(200, BUILT, { ...HEADERS, 'set-cookie': 'a=b' }),
        BUILT,
        SHA,
        RULES,
      ),
    ).toEqual(['/: sets a cookie']);
  });

  it('names a header that differs from _headers, and one that is missing', () => {
    expect(
      pageProblems(
        '/',
        answer(200, BUILT, {
          'content-type': 'text/html',
          'content-security-policy': '*',
        }),
        BUILT,
        SHA,
        RULES,
      ),
    ).toEqual([
      `/: content-security-policy is "*", expected "default-src 'none'"`,
      '/: x-content-type-options is missing, expected "nosniff"',
    ]);
  });

  it('names an answer that is not HTML', () => {
    expect(
      pageProblems(
        '/',
        answer(200, BUILT, { ...HEADERS, 'content-type': 'text/plain' }),
        BUILT,
        SHA,
        RULES,
      ),
    ).toEqual(['/: content-type text/plain, expected text/html']);
  });

  it('names a noindex header, which would hide production from search', () => {
    expect(
      pageProblems(
        '/',
        answer(200, BUILT, { ...HEADERS, 'x-robots-tag': 'noindex' }),
        BUILT,
        SHA,
        RULES,
      ),
    ).toEqual(['/: X-Robots-Tag noindex']);
  });
});

describe('the holding page’s dev copy (#621 AC8)', () => {
  const DEV_RULES = new Map([
    ...RULES,
    ['x-robots-tag', 'noindex, nofollow, noarchive'],
  ]);
  const devAnswer = answer(200, BUILT, {
    ...HEADERS,
    'x-robots-tag': 'noindex, nofollow, noarchive',
  });

  it('passes a noindex page when the copy is not meant to be indexed', () => {
    const judged = pageJudgement('/', devAnswer, BUILT, SHA, DEV_RULES, false);
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'dev copy page checks',
      }),
    ).toEqual([]);
    expect(
      floorBreach('verify-prod/dev-page-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('names a dev copy that a search engine could index', () => {
    expect(
      pageProblems('/', answer(200, BUILT), BUILT, SHA, DEV_RULES, false),
    ).toEqual([
      '/: x-robots-tag is missing, expected "noindex, nofollow, noarchive"',
    ]);
  });
});

describe('a holding 404 page', () => {
  const NOT_FOUND = page('Page not found');

  it('passes when it is a 404, exactly as built, with the headers', () => {
    const judged = notFoundJudgement(
      '/nope',
      answer(404, NOT_FOUND),
      NOT_FOUND,
      RULES,
    );
    expect(
      searched(judged.problems, { of: judged.checked, what: '404 checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-prod/not-found-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('names a status other than 404', () => {
    expect(
      notFoundProblems('/nope', answer(200, NOT_FOUND), NOT_FOUND, RULES),
    ).toEqual(['/nope: status 200, expected 404']);
  });

  it('names a 404 that differs from the build', () => {
    expect(
      notFoundProblems('/nope', answer(404, BUILT), NOT_FOUND, RULES),
    ).toEqual([
      `/nope: is not the page this commit builds (${String(BUILT.length)} characters served, ${String(NOT_FOUND.length)} built)`,
    ]);
  });
});

/**
 * The promo media on their R2 host (#713): the tracked file, the host's
 * headers, and a constructed answer. Production's zone rule must add both
 * headers; a host can also require a header to be absent.
 */
const SOURCE: MediaSource = {
  file: 'm.mp4',
  type: 'video/mp4',
  bytes: new Uint8Array([1, 2, 3, 4, 5]),
};
const HOST: MediaHost = {
  origin: 'https://media.example',
  headers: {
    'cross-origin-resource-policy': 'same-site',
    'x-content-type-options': 'nosniff',
  },
  sizeOnPastEnd: true,
};
const URL_ = 'https://media.example/m.mp4';
const SENT = {
  'cross-origin-resource-policy': 'same-site',
  'x-content-type-options': 'nosniff',
};
const mediaAnswer = (
  status: number,
  bytes: readonly number[],
  headers: Record<string, string>,
): MediaProbe => ({
  status,
  headers: new Headers(headers),
  bytes: new Uint8Array(bytes),
});
const WHOLE = {
  'content-type': 'video/mp4',
  'content-length': '5',
  ...SENT,
};
const RANGE = {
  'content-type': 'video/mp4',
  'content-range': 'bytes 0-1/5',
  ...SENT,
};
const PAST_END = { 'content-range': 'bytes */5', ...SENT };
const without = (
  headers: Record<string, string>,
  name: string,
): Record<string, string> =>
  Object.fromEntries(Object.entries(headers).filter(([key]) => key !== name));

describe('a promo media file, asked for whole', () => {
  it('passes when it is 200 of its type, byte for byte the tracked file, with the host’s headers', () => {
    const judged = mediaJudgement(
      URL_,
      mediaAnswer(200, [1, 2, 3, 4, 5], WHOLE),
      SOURCE,
      HOST,
    );
    expect(
      searched(judged.problems, { of: judged.checked, what: 'media checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-prod/media-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('names a status other than 200 and judges nothing after it', () => {
    const judged = mediaJudgement(
      URL_,
      mediaAnswer(404, [], { 'content-type': 'text/plain' }),
      SOURCE,
      HOST,
    );
    expect(judged).toEqual({
      checked: [`${URL_} status`],
      problems: [`${URL_}: status 404, expected 200`],
    });
  });

  it('names the wrong type', () => {
    expect(
      mediaProblems(
        URL_,
        mediaAnswer(200, [1, 2, 3, 4, 5], {
          ...WHOLE,
          'content-type': 'text/html',
        }),
        SOURCE,
        HOST,
      ),
    ).toEqual([`${URL_}: content-type text/html, expected video/mp4`]);
  });

  it('names a size other than the tracked file’s', () => {
    expect(
      mediaProblems(
        URL_,
        mediaAnswer(200, [1, 2, 3, 4, 5], { ...WHOLE, 'content-length': '4' }),
        SOURCE,
        HOST,
      ),
    ).toEqual([`${URL_}: Content-Length 4, expected 5`]);
  });

  it('names a file that differs from the tracked one, and how to upload it', () => {
    expect(
      mediaProblems(
        URL_,
        mediaAnswer(200, [1, 2, 3, 4, 6], WHOLE),
        SOURCE,
        HOST,
      ),
    ).toEqual([
      `${URL_}: differs from apps/site/media/m.mp4; upload it (apps/site/media/README.md)`,
    ]);
  });

  it('names a missing Cross-Origin-Resource-Policy, which would let any site embed it', () => {
    expect(
      mediaProblems(
        URL_,
        mediaAnswer(
          200,
          [1, 2, 3, 4, 5],
          without(WHOLE, 'cross-origin-resource-policy'),
        ),
        SOURCE,
        HOST,
      ),
    ).toEqual([
      `${URL_}: cross-origin-resource-policy is missing, expected same-site`,
    ]);
  });

  it('names a missing nosniff', () => {
    expect(
      mediaProblems(
        URL_,
        mediaAnswer(
          200,
          [1, 2, 3, 4, 5],
          without(WHOLE, 'x-content-type-options'),
        ),
        SOURCE,
        HOST,
      ),
    ).toEqual([`${URL_}: x-content-type-options is missing, expected nosniff`]);
  });

  it('names a header the host must not send', () => {
    expect(
      mediaProblems(URL_, mediaAnswer(200, [1, 2, 3, 4, 5], WHOLE), SOURCE, {
        ...HOST,
        headers: {
          ...HOST.headers,
          'cross-origin-resource-policy': null,
        },
      }),
    ).toEqual([
      `${URL_}: cross-origin-resource-policy is same-site, expected none`,
    ]);
  });
});

describe('a promo media file, asked for bytes=0-1', () => {
  it('passes when it is 206 of exactly those two bytes, of its type, with the host’s headers', () => {
    const judged = rangeJudgement(
      URL_,
      mediaAnswer(206, [1, 2], RANGE),
      SOURCE,
      HOST,
    );
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'media range checks',
      }),
    ).toEqual([]);
    expect(
      floorBreach('verify-prod/media-range-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('names a whole-file 200, which a range-less server sends, and judges nothing after it', () => {
    const judged = rangeJudgement(
      URL_,
      mediaAnswer(200, [1, 2, 3, 4, 5], WHOLE),
      SOURCE,
      HOST,
    );
    expect(judged).toEqual({
      checked: [`${URL_} bytes=0-1 status`],
      problems: [`${URL_} bytes=0-1: status 200, expected 206`],
    });
  });

  it('names a Content-Range other than the two bytes of the tracked size', () => {
    expect(
      rangeProblems(
        URL_,
        mediaAnswer(206, [1, 2], { ...RANGE, 'content-range': 'bytes 0-1/6' }),
        SOURCE,
        HOST,
      ),
    ).toEqual([
      `${URL_} bytes=0-1: Content-Range bytes 0-1/6, expected bytes 0-1/5`,
    ]);
  });

  it('names bytes other than the tracked file’s first two', () => {
    expect(
      rangeProblems(URL_, mediaAnswer(206, [1, 3], RANGE), SOURCE, HOST),
    ).toEqual([
      `${URL_} bytes=0-1: the 2 bytes served are not the first 2 of apps/site/media/m.mp4`,
    ]);
  });

  it('names the wrong type', () => {
    expect(
      rangeProblems(
        URL_,
        mediaAnswer(206, [1, 2], { ...RANGE, 'content-type': 'text/html' }),
        SOURCE,
        HOST,
      ),
    ).toEqual([
      `${URL_} bytes=0-1: content-type text/html, expected video/mp4`,
    ]);
  });

  it('names a missing header', () => {
    expect(
      rangeProblems(
        URL_,
        mediaAnswer(206, [1, 2], without(RANGE, 'x-content-type-options')),
        SOURCE,
        HOST,
      ),
    ).toEqual([
      `${URL_} bytes=0-1: x-content-type-options is missing, expected nosniff`,
    ]);
  });
});

describe('a promo media file, asked for a range past its end', () => {
  it('passes when it is 416 naming the tracked size, with the host’s headers', () => {
    const judged = pastEndJudgement(
      URL_,
      mediaAnswer(416, [], PAST_END),
      SOURCE,
      HOST,
    );
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'media past-end checks',
      }),
    ).toEqual([]);
    expect(
      floorBreach('verify-prod/media-past-end-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('names a status other than 416 and judges nothing after it', () => {
    const judged = pastEndJudgement(
      URL_,
      mediaAnswer(200, [1, 2, 3, 4, 5], WHOLE),
      SOURCE,
      HOST,
    );
    expect(judged).toEqual({
      checked: [`${URL_} bytes=5- status`],
      problems: [`${URL_} bytes=5-: status 200, expected 416`],
    });
  });

  it('names a Content-Range other than the tracked size', () => {
    expect(
      pastEndProblems(
        URL_,
        mediaAnswer(416, [], { ...PAST_END, 'content-range': 'bytes */6' }),
        SOURCE,
        HOST,
      ),
    ).toEqual([
      `${URL_} bytes=5-: Content-Range bytes */6, expected bytes */5`,
    ]);
  });

  it('names a missing header', () => {
    expect(
      pastEndProblems(
        URL_,
        mediaAnswer(416, [], without(PAST_END, 'cross-origin-resource-policy')),
        SOURCE,
        HOST,
      ),
    ).toEqual([
      `${URL_} bytes=5-: cross-origin-resource-policy is missing, expected same-site`,
    ]);
  });

  // The dev store's r2.dev address answers 416 with no Content-Range, CORP or
  // nosniff (measured 2026-10-20, #713), and its verify expects exactly that.
  it('passes a 416 with no Content-Range from a host that sends none', () => {
    const judged = pastEndJudgement(
      URL_,
      mediaAnswer(416, [], {}),
      SOURCE,
      DEV_MEDIA,
    );
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'dev media past-end checks',
      }),
    ).toEqual([]);
    expect(
      floorBreach(
        'verify-prod/dev-media-past-end-checks',
        judged.checked.length,
      ),
    ).toBeUndefined();
  });

  it('names a Content-Range from a host that sends none, so a change is seen', () => {
    expect(
      pastEndProblems(URL_, mediaAnswer(416, [], PAST_END), SOURCE, {
        ...HOST,
        sizeOnPastEnd: false,
      }),
    ).toEqual([`${URL_} bytes=5-: Content-Range bytes */5, expected none`]);
  });

  it('names a missing Content-Range from a host that names the size', () => {
    expect(
      pastEndProblems(URL_, mediaAnswer(416, [], SENT), SOURCE, HOST),
    ).toEqual([`${URL_} bytes=5-: Content-Range missing, expected bytes */5`]);
  });
});

describe('the production robots file', () => {
  const ALLOW = 'User-agent: *\nAllow: /\n';

  it('passes when it is the built robots file', () => {
    const judged = robotsJudgement(answer(200, ALLOW, {}), ALLOW);
    expect(
      searched(judged.problems, { of: judged.checked, what: 'robots checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-prod/robots-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('names a robots file that differs from the build', () => {
    const block = 'User-agent: *\nDisallow: /\n';
    expect(robotsProblems(answer(200, block, {}), ALLOW)).toEqual([
      `/robots.txt: is not the page this commit builds (${String(block.length)} characters served, ${String(ALLOW.length)} built)`,
    ]);
  });
});

describe('the commit a page reports', () => {
  it('reads the stamp', () => {
    expect(reportedCommit(page(''))).toBe(SHA);
  });

  it('is undefined on a page with no stamp', () => {
    expect(reportedCommit('<html></html>')).toBeUndefined();
  });
});
