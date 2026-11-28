import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  BUILDS,
  emailProblems,
  main,
  readsToScan,
} from '../../scripts/no-email.ts';
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

const shownIn = (text: string): string[] =>
  emailProblems({ 'index.html': text }, ['index.html']).map((problem) =>
    problem.replace('index.html: shows ', ''),
  );

describe('where an address starts and ends (#1106: the same matches as the old pattern)', () => {
  it('ends an address before the full stop that ends its sentence', () => {
    expect(shownIn('Write to a@b.co.')).toEqual(['a@b.co']);
  });

  it('takes a mailto: inside a longer address as part of that address', () => {
    expect(shownIn('xmailto:y@a.com')).toEqual(['xmailto:y@a.com']);
  });

  it('finds a mailto: inside a word that holds no address', () => {
    expect(shownIn('see xmailto:y')).toEqual(['mailto:']);
  });

  it('keeps every label of a long domain', () => {
    expect(shownIn('a@x.y.museum!')).toEqual(['a@x.y.museum']);
  });

  it('needs a top-level domain of two letters or more', () => {
    expect(shownIn('a@b.c')).toEqual([]);
  });

  it('accepts a domain that starts with a full stop', () => {
    expect(shownIn('a@.b.co')).toEqual(['a@.b.co']);
  });

  it('stops at the letters of the last label, where a second @ follows', () => {
    expect(shownIn('a@b.coc@d.org')).toEqual(['a@b.coc']);
  });

  it('finds MAILTO: in capitals', () => {
    expect(shownIn('MAILTO:x')).toEqual(['MAILTO:']);
  });

  it('ends at the last label with two letters, before a digit', () => {
    expect(shownIn('a@b.c1.de9')).toEqual(['a@b.c1.de']);
  });

  it('starts a second address after an @ with no domain', () => {
    expect(shownIn('a@b@c.io')).toEqual(['b@c.io']);
  });

  it('finds nothing when no label ends in two letters', () => {
    expect(shownIn('p@q.r.s1')).toEqual([]);
  });
});

// Each page below took the old backtracking pattern 0.9 to 9.6 s at 40,000
// characters (measured 2026-11-25): its time grew with the square of the
// length (Sonar S8786). The test counts the characters the scan reads, never
// the time it takes (#1123): CPU-time ratios still overshot their limit inside
// the full suite under load (10.7 and 12.2 against 10, 2026-11-28), while a
// count is the same on every machine. A linear scan reads each character a
// fixed number of times; the old pattern read each one about as many times
// as the page is long.
const LENGTH = 40_000;
const MAX_READS_PER_CHARACTER = 8;
const perCharacter = (text: string): number => readsToScan(text) / text.length;

describe('a long page is read a fixed number of times per character (#1106, #1123)', () => {
  it('counts at least one read of every character, so a count of nothing cannot pass', () => {
    expect(perCharacter('a'.repeat(LENGTH))).toBeGreaterThanOrEqual(1);
  });

  it('reads letters with no @ a fixed number of times each', () => {
    expect(perCharacter('a'.repeat(LENGTH))).toBeLessThanOrEqual(
      MAX_READS_PER_CHARACTER,
    );
  });

  it('reads a run of near-misses of mailto: a fixed number of times each', () => {
    expect(perCharacter('mailt'.repeat(LENGTH / 5))).toBeLessThanOrEqual(
      MAX_READS_PER_CHARACTER,
    );
  });

  it('reads an @ followed by one-letter labels a fixed number of times each', () => {
    expect(perCharacter(`x@${'a.'.repeat(LENGTH / 2)}`)).toBeLessThanOrEqual(
      MAX_READS_PER_CHARACTER,
    );
  });

  it('reads an @ followed by full stops a fixed number of times each', () => {
    expect(perCharacter(`x@a${'.'.repeat(LENGTH)}`)).toBeLessThanOrEqual(
      MAX_READS_PER_CHARACTER,
    );
  });

  it('reads an @ followed by labels ending in a digit a fixed number of times each', () => {
    expect(perCharacter(`x@a${'b.1'.repeat(LENGTH / 3)}`)).toBeLessThanOrEqual(
      MAX_READS_PER_CHARACTER,
    );
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
    expect(BUILDS['apps/web/dist']).toEqual(['play/index.html']);
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

describe('the command (#1090)', () => {
  /** Every expected page of every build, each with `body` in it. */
  const builds = (body: string) => (folder: string) =>
    Object.fromEntries(
      (BUILDS[folder] ?? []).map((page) => [page, html(body)]),
    );

  it('passes and says what it read when no page shows an address', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = main(builds('<p>Ask through the form</p>'));
    expect({ code, log: log.mock.calls, error: error.mock.calls }).toEqual({
      code: 0,
      log: [
        [
          'no-email: no address or mailto: in apps/site/dist, apps/site/dist-holding, apps/site/dist-holding-dev, apps/web/dist',
        ],
      ],
      error: [],
    });
    log.mockRestore();
    error.mockRestore();
  });

  it('fails naming each page by its folder', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const read = (folder: string) =>
      folder === 'apps/web/dist'
        ? { 'play/index.html': html('<p>a@b.org</p>') }
        : builds('')(folder);
    const code = main(read);
    expect({ code, error: error.mock.calls }).toEqual({
      code: 1,
      error: [['apps/web/dist/play/index.html: shows a@b.org']],
    });
    error.mockRestore();
  });
});
