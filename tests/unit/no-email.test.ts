import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { BUILDS, emailProblems } from '../../scripts/no-email.ts';
import { runOf } from './workflow-steps';

/**
 * #1090: no Yawelo Idle web page shows an email address or a mailto: link
 * (Shyden, 2026-11-23, every project: support requests come only through the
 * support request form). The check reads every built page, in both
 * languages, and fails when a page it expects is missing from the build.
 */

const html = (body: string): string =>
  `<!doctype html><html><body>${body}</body></html>`;

describe('a built page showing an email address (#1090)', () => {
  it('passes pages with no address', () => {
    expect(
      emailProblems(
        { 'index.html': html('<a href="/support/ticket">Ask for help</a>') },
        ['index.html'],
      ),
    ).toEqual([]);
  });

  it('finds a mailto: link', () => {
    expect(
      emailProblems({ 'index.html': html('<a href="mailto:help">Mail</a>') }, [
        'index.html',
      ]),
    ).toEqual(['index.html: shows mailto:']);
  });

  it('finds a written address, once per page, in every page', () => {
    expect(
      emailProblems(
        {
          'privacy.html': html(
            '<p>Write to support@yaweloidle.com or support@yaweloidle.com</p>',
          ),
          'id/privacy.html': html('<p>Surel: tim@contoh.co.id</p>'),
        },
        ['privacy.html', 'id/privacy.html'],
      ),
    ).toEqual([
      'id/privacy.html: shows tim@contoh.co.id',
      'privacy.html: shows support@yaweloidle.com',
    ]);
  });

  it('finds an address in an attribute as well as in text', () => {
    expect(
      emailProblems(
        { 'index.html': html('<meta name="author" content="a@b.org">') },
        ['index.html'],
      ),
    ).toEqual(['index.html: shows a@b.org']);
  });

  it('reads pages only, leaving a retina image name in a stylesheet alone', () => {
    expect(
      emailProblems(
        {
          'index.html': html('<img src="/logo.png">'),
          '_site/a.css': '.logo{background:url(logo@2x.png)}',
        },
        ['index.html'],
      ),
    ).toEqual([]);
  });

  it('fails when an expected page is missing from the build', () => {
    expect(
      emailProblems({ 'index.html': html('') }, ['index.html', 'privacy.html']),
    ).toEqual(['privacy.html: missing from the build']);
  });

  it('refuses a build with no pages, so a wrong folder cannot pass', () => {
    expect(emailProblems({}, [])).toEqual(['no built pages to check']);
  });
});

describe('the pages it expects (#1090 AC3)', () => {
  it('reads the site, the holding page, its dev copy and the game shell', () => {
    expect(Object.keys(BUILDS)).toEqual([
      'apps/site/dist',
      'apps/site/dist-holding',
      'apps/site/dist-holding-dev',
      'apps/web/dist',
    ]);
  });

  it('expects every site page in English and Indonesian, legal pages included', () => {
    expect(BUILDS['apps/site/dist']).toEqual([
      '404.html',
      'api/docs.html',
      'api/private/docs.html',
      'id/404.html',
      'id/index.html',
      'id/privacy.html',
      'id/roadmap.html',
      'id/support.html',
      'id/support/ticket.html',
      'index.html',
      'privacy.html',
      'roadmap.html',
      'support.html',
      'support/ticket.html',
    ]);
  });

  it('expects the holding page and its dev copy in both languages', () => {
    const holding = ['404.html', 'id/404.html', 'id/index.html', 'index.html'];
    expect({
      prod: BUILDS['apps/site/dist-holding'],
      dev: BUILDS['apps/site/dist-holding-dev'],
    }).toEqual({ prod: holding, dev: holding });
  });

  it('expects the game shell', () => {
    expect(BUILDS['apps/web/dist']).toEqual(['index.html']);
  });
});

describe('the check in CI (#1090 AC2)', () => {
  const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
    jobs: Record<string, { steps: { run?: string; name?: string }[] }>;
  };
  const steps = ci.jobs['build-and-test']?.steps ?? [];
  const at = (command: string): number =>
    steps.findIndex((s) => runOf(s) === command);

  it('runs after the site, the game and the holding page and its dev copy are built', () => {
    const build = at('scripts/fail-on-warnings.sh npm run build');
    const devCopy = at('node scripts/holding-dev.ts');
    const check = at('node scripts/no-email.ts');
    expect({
      built: build >= 0 && devCopy > build,
      checkedAfter: check > devCopy,
    }).toEqual({ built: true, checkedAfter: true });
  });
});
