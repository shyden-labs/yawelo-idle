import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { headerRules } from '../../scripts/headers-file';
import { readDeployConfig } from './wrangler-configs';
import { apiProblems, API_PATHS, type ApiPath } from '../../scripts/verify-api';
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
