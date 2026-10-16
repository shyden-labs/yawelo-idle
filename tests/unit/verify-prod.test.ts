import { describe, expect, it } from 'vitest';
import type { Probe } from '../../scripts/verify-dev';
import {
  mediaJudgement,
  mediaProblems,
  notFoundJudgement,
  notFoundProblems,
  pageJudgement,
  pageProblems,
  reportedCommit,
  robotsJudgement,
  robotsProblems,
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

describe('a promo video file', () => {
  const media = (
    type: string,
    length: string,
    corp: string | undefined,
  ): Probe =>
    answer(200, '', {
      'content-type': type,
      'content-length': length,
      ...(corp === undefined ? {} : { 'cross-origin-resource-policy': corp }),
    });

  it('passes when it is 200 of its type and built size, embeddable by the same site only', () => {
    const judged = mediaJudgement(
      '/m.mp4',
      media('video/mp4', '42', 'same-site'),
      'video/mp4',
      42,
    );
    expect(
      searched(judged.problems, { of: judged.checked, what: 'media checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-prod/media-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('names the wrong type', () => {
    expect(
      mediaProblems(
        '/m.mp4',
        media('text/html', '42', 'same-site'),
        'video/mp4',
        42,
      ),
    ).toEqual(['/m.mp4: content-type text/html, expected video/mp4']);
  });

  it('names a size other than the built file’s', () => {
    expect(
      mediaProblems(
        '/m.mp4',
        media('video/mp4', '41', 'same-site'),
        'video/mp4',
        42,
      ),
    ).toEqual(['/m.mp4: Content-Length 41, expected 42']);
  });

  it('names a missing embed rule', () => {
    expect(
      mediaProblems(
        '/m.mp4',
        media('video/mp4', '42', undefined),
        'video/mp4',
        42,
      ),
    ).toEqual([
      '/m.mp4: Cross-Origin-Resource-Policy is missing, expected same-site',
    ]);
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
