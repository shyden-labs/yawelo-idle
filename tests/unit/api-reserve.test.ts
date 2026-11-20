import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { headerRules } from '../../scripts/headers-file';
import { readDeployConfig } from './wrangler-configs';
import {
  apiProblems,
  apiVerdict,
  runApiVerify,
  API_PATHS,
  verifyApi,
  type ApiPath,
} from '../../scripts/verify-api';
import type { Probe } from '../../scripts/verify-dev';

/**
 * The production API address, reserved (#1013 AC1, Shyden 2026-11-21:
 * "Reserve the address now"). Production has no sync Worker yet (#252), so
 * api.yaweloidle.com is held by an assets-only Worker under the name the real
 * one will take, `yawelo-idle-sync`. Every path answers 404 "not open yet",
 * hidden from search engines, and `commit.txt` names the release so the
 * verify can tell this deploy from the last.
 */
const ROOT = new URL('../..', import.meta.url).pathname;
const RESERVE = 'apps/sync-worker/reserve';
const read = (path: string): string =>
  readFileSync(join(ROOT, RESERVE, path), 'utf8');
const config = () => readDeployConfig(join(ROOT, RESERVE, 'wrangler.jsonc'));

describe('the API reserve Worker (#1013 AC1)', () => {
  it('takes the name the production sync Worker will use', () => {
    expect(config().name).toBe('yawelo-idle-sync');
  });

  it('is reached only at api.yaweloidle.com, as a Custom Domain, with no workers.dev or preview address', () => {
    expect(config().routes).toEqual([
      { pattern: 'api.yaweloidle.com', custom_domain: true },
    ]);
    expect(config().workers_dev).toBe(false);
    expect(config().preview_urls).toBe(false);
  });

  it('serves its own files only, every unknown path as the 404 page, and runs no script', () => {
    expect(config().assets).toEqual({
      directory: './public',
      not_found_handling: '404-page',
    });
    expect(config().main).toBeUndefined();
    expect(config().vars).toEqual({});
  });

  it('tells every crawler to stay out', () => {
    expect(read('public/robots.txt')).toBe('User-agent: *\nDisallow: /\n');
  });

  it('marks every path noindex, sends no script or style, and leaks no referrer', () => {
    const all = headerRules(read('public/_headers')).get('/*');
    expect(all?.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
    expect(all?.get('content-security-policy')).toBe("default-src 'none'");
    expect(all?.get('x-content-type-options')).toBe('nosniff');
    expect(all?.get('referrer-policy')).toBe('no-referrer');
  });

  it('says the address is not open yet, in English and Indonesian', () => {
    const page = read('public/404.html');
    expect(page).toContain('Yawelo Idle: not open yet.');
    expect(page).toContain('Yawelo Idle: belum dibuka.');
  });
});

const headers = (pairs: Record<string, string>): Headers => new Headers(pairs);
const SHA = 'a'.repeat(40);
const NOINDEX = { 'x-robots-tag': 'noindex, nofollow, noarchive' };
const good = (): Record<ApiPath, Probe> => ({
  '/commit.txt': { status: 200, headers: headers(NOINDEX), body: `${SHA}\n` },
  '/': {
    status: 404,
    headers: headers(NOINDEX),
    body: read('public/404.html'),
  },
  '/robots.txt': {
    status: 200,
    headers: headers(NOINDEX),
    body: 'User-agent: *\nDisallow: /\n',
  },
});

describe('the API reserve verify (#1013 AC1)', () => {
  it('looks at the commit, the home path and the robots file', () => {
    expect([...API_PATHS]).toEqual(['/commit.txt', '/', '/robots.txt']);
  });

  it('finds nothing wrong with a reserve serving this commit', () => {
    expect(apiProblems(good(), SHA, read('public/404.html'))).toEqual([]);
  });

  it('names a reserve still serving the last commit', () => {
    const answers = good();
    answers['/commit.txt'] = {
      status: 200,
      headers: headers(NOINDEX),
      body: `${'b'.repeat(40)}\n`,
    };
    expect(apiProblems(answers, SHA, read('public/404.html'))).toEqual([
      `/commit.txt: serves ${'b'.repeat(40)}, expected ${SHA}`,
    ]);
  });

  it('names a home path that answers anything but the 404 page', () => {
    const answers = good();
    answers['/'] = { status: 200, headers: headers(NOINDEX), body: 'hello' };
    expect(apiProblems(answers, SHA, read('public/404.html'))).toEqual([
      '/: status 200, expected 404',
      '/: body is not the reserve 404 page',
    ]);
  });

  it('names any path served without noindex', () => {
    const answers = good();
    answers['/robots.txt'] = {
      status: 200,
      headers: headers({}),
      body: 'User-agent: *\nDisallow: /\n',
    };
    expect(apiProblems(answers, SHA, read('public/404.html'))).toEqual([
      '/robots.txt: x-robots-tag is missing, expected noindex, nofollow, noarchive',
    ]);
  });

  it('names a robots file that lets crawlers in', () => {
    const answers = good();
    answers['/robots.txt'] = {
      status: 200,
      headers: headers(NOINDEX),
      body: 'User-agent: *\nAllow: /\n',
    };
    expect(apiProblems(answers, SHA, read('public/404.html'))).toEqual([
      '/robots.txt: does not disallow every path',
    ]);
  });
});

/** A stand-in for the network: each URL answers from `byPath`, counting looks. */
function stubLook(byPath: (path: string, look: number) => Probe | Error) {
  const looks: string[] = [];
  const look = (url: string): Promise<Probe> => {
    const path = new URL(url).pathname;
    looks.push(path);
    const answer = byPath(path, looks.filter((each) => each === path).length);
    return answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve(answer);
  };
  return { look, looks };
}

const ORIGIN = 'https://api.example.test';
const NO_WAIT = { polls: 3, pollMs: 0 };

describe('the API reserve verify run (#1013 AC1)', () => {
  it('waits for the commit, then judges every path once', async () => {
    const answers = good();
    const { look, looks } = stubLook((path, n) =>
      path === '/commit.txt' && n === 1
        ? { status: 404, headers: headers(NOINDEX), body: 'old' }
        : answers[path as ApiPath],
    );
    expect(
      await verifyApi(ORIGIN, SHA, NO_WAIT, look, read('public/404.html')),
    ).toEqual([]);
    expect(looks).toEqual(['/commit.txt', '/commit.txt', ...API_PATHS]);
  });

  it('names the last answer when the commit never arrives, and judges nothing', async () => {
    const { look, looks } = stubLook(() => ({
      status: 200,
      headers: headers(NOINDEX),
      body: 'b'.repeat(40),
    }));
    expect(
      await verifyApi(ORIGIN, SHA, NO_WAIT, look, read('public/404.html')),
    ).toEqual([
      `/commit.txt: never served commit ${SHA} in 3 looks 0 ms apart; last: status 200, body ${'b'.repeat(40)}`,
    ]);
    expect(looks).toEqual(['/commit.txt', '/commit.txt', '/commit.txt']);
  });

  it('names a request that fails while waiting', async () => {
    const { look } = stubLook(() => new Error('getaddrinfo ENOTFOUND'));
    expect(
      await verifyApi(ORIGIN, SHA, NO_WAIT, look, read('public/404.html')),
    ).toEqual([
      `/commit.txt: never served commit ${SHA} in 3 looks 0 ms apart; last: getaddrinfo ENOTFOUND`,
    ]);
  });

  it('names a path whose request fails after the commit arrived', async () => {
    const answers = good();
    const { look } = stubLook((path) =>
      path === '/robots.txt'
        ? new Error('socket hang up')
        : answers[path as ApiPath],
    );
    expect(
      await verifyApi(ORIGIN, SHA, NO_WAIT, look, read('public/404.html')),
    ).toEqual(['/robots.txt: request failed: socket hang up']);
  });
});

describe('the API reserve verdict (#1013 AC1)', () => {
  it('prints one success line naming the host and commit', () => {
    expect(apiVerdict(ORIGIN, SHA, [])).toEqual({
      code: 0,
      lines: [
        `✓ API reserve: ${ORIGIN} serves commit ${SHA}, the 404 page on every other path, a robots file keeping crawlers out, and noindex on every answer`,
      ],
    });
  });

  it('prints one failure line per problem', () => {
    expect(apiVerdict(ORIGIN, SHA, ['one', 'two'])).toEqual({
      code: 1,
      lines: ['✗ API reserve: one', '✗ API reserve: two'],
    });
  });
});

describe('the API reserve run from the environment (#1013 AC1)', () => {
  const env = { API_URL: ORIGIN, EXPECTED_SHA: SHA };
  const answers = good();
  const fine = stubLook((path) => answers[path as ApiPath]).look;

  it('refuses to start without API_URL', async () => {
    await expect(
      runApiVerify({ EXPECTED_SHA: SHA }, fine, {
        log: () => {},
        error: () => {},
      }),
    ).rejects.toThrow('API_URL is not set');
  });

  it('refuses to start with an empty EXPECTED_SHA', async () => {
    await expect(
      runApiVerify({ API_URL: ORIGIN, EXPECTED_SHA: '' }, fine, {
        log: () => {},
        error: () => {},
      }),
    ).rejects.toThrow('EXPECTED_SHA is not set');
  });

  it('logs the success line and exits 0', async () => {
    const logged: string[] = [];
    const errors: string[] = [];
    expect(
      await runApiVerify(env, fine, {
        log: (line) => logged.push(line),
        error: (line) => errors.push(line),
      }),
    ).toBe(0);
    expect(logged).toEqual(apiVerdict(ORIGIN, SHA, []).lines);
    expect(errors).toEqual([]);
  });

  it('sends each problem to the error stream and exits 1', async () => {
    const broken = stubLook((path) =>
      path === '/robots.txt'
        ? new Error('socket hang up')
        : answers[path as ApiPath],
    ).look;
    const logged: string[] = [];
    const errors: string[] = [];
    expect(
      await runApiVerify(env, broken, {
        log: (line) => logged.push(line),
        error: (line) => errors.push(line),
      }),
    ).toBe(1);
    expect(logged).toEqual([]);
    expect(errors).toEqual([
      '✗ API reserve: /robots.txt: request failed: socket hang up',
    ]);
  });
});

it('names a commit file that does not answer 200 (#1013 AC1)', () => {
  const answers = good();
  answers['/commit.txt'] = {
    status: 404,
    headers: headers(NOINDEX),
    body: 'gone',
  };
  expect(apiProblems(answers, SHA, read('public/404.html'))).toEqual([
    '/commit.txt: status 404, expected 200',
  ]);
});

it('pauses between looks while waiting for the commit (#1013 AC1)', async () => {
  const { look } = stubLook(() => new Error('not yet'));
  const started = performance.now();
  await verifyApi(
    ORIGIN,
    SHA,
    { polls: 3, pollMs: 40 },
    look,
    read('public/404.html'),
  );
  // Two pauses of 40 ms between three looks; timers never fire much early.
  expect(performance.now() - started).toBeGreaterThanOrEqual(75);
});
