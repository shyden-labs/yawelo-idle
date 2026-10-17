import { describe, expect, it } from 'vitest';
import { BLOCKING_ROBOTS_TXT, NO_INDEX } from '@yawelo-idle/lockdown';
import { DEV_ROBOTS, devHeaders } from '../../scripts/holding-dev';
import { headerRules } from '../../scripts/headers-file';

/**
 * The holding page's dev copy (#621 AC8, Shyden 2026-10-16: "A dev copy"):
 * the production build with every crawler blocked and every response marked
 * noindex, so Shyden can check it on his phones before the release.
 */
const PROD = [
  '# The holding page.',
  '/*',
  "  Content-Security-Policy: default-src 'none'",
  '  X-Content-Type-Options: nosniff',
  '',
  '/media/*',
  '  Cross-Origin-Resource-Policy: same-site',
  '',
].join('\n');

describe('the dev copy’s headers', () => {
  it('keeps every production header and adds noindex on every path', () => {
    const rules = headerRules(devHeaders(PROD));
    expect([...(rules.get('/*') ?? [])]).toEqual([
      ['content-security-policy', "default-src 'none'"],
      ['x-content-type-options', 'nosniff'],
      ['x-robots-tag', NO_INDEX],
    ]);
  });

  it('leaves the other rules as they are', () => {
    expect([...(headerRules(devHeaders(PROD)).get('/media/*') ?? [])]).toEqual([
      ['cross-origin-resource-policy', 'same-site'],
    ]);
  });

  it('refuses headers with no rule for every path, rather than ship an indexable copy', () => {
    expect(() => devHeaders('/media/*\n  A: b\n')).toThrow(
      '_headers has no /* rule to mark noindex',
    );
  });

  it('refuses headers that already set X-Robots-Tag, rather than guess which wins', () => {
    expect(() => devHeaders('/*\n  X-Robots-Tag: all\n')).toThrow(
      '_headers already sets X-Robots-Tag',
    );
  });
});

describe('the dev copy’s robots file', () => {
  it('is dev’s blocking robots file, from its one home', () => {
    expect(DEV_ROBOTS).toBe(BLOCKING_ROBOTS_TXT);
  });

  it('blocks every crawler', () => {
    expect(DEV_ROBOTS).toContain('User-agent: *\nDisallow: /\n');
  });
});
