import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { FREE_HOSTS, freeHostProblems } from '../../scripts/free-hosts';
import { runOf } from './workflow-steps';

/**
 * #768 AC5: no page built for production or either dev copy loads a file
 * from a free shared domain, since Indonesian providers block r2.dev and
 * could block any of the others. The check reads every built file whole, so
 * it finds an address in any attribute, stylesheet, script or header.
 */

const page = (body: string): Record<string, string> => ({
  'index.html': `<!doctype html><html><body>${body}</body></html>`,
});

describe('a built file loading from a free shared domain (#768)', () => {
  it('names the eight free shared domains', () => {
    expect(FREE_HOSTS).toEqual([
      'r2.dev',
      'workers.dev',
      'pages.dev',
      'github.io',
      'netlify.app',
      'vercel.app',
      'web.app',
      'firebaseapp.com',
    ]);
  });

  it('passes a build that loads only from shyden.co.uk', () => {
    expect(
      freeHostProblems({
        ...page(
          '<video poster="https://media.shyden.co.uk/p.jpg"><source src="https://media.shyden.co.uk/v.mp4"></video>',
        ),
        _headers:
          "/*\n  Content-Security-Policy: media-src 'self' https://media.shyden.co.uk\n",
      }),
    ).toEqual([]);
  });

  it.each(FREE_HOSTS)('names a file loaded from %s', (host) => {
    expect(
      freeHostProblems(page(`<img src="https://a-b1.${host}/x.png">`)),
    ).toEqual([`index.html: loads from https://a-b1.${host}`]);
  });

  it.each([
    ['src', '<video><source src="https://x.r2.dev/v.mp4"></video>'],
    ['poster', '<video poster="https://x.r2.dev/p.jpg"></video>'],
    [
      'stylesheet href',
      '<link rel="stylesheet" href="https://x.r2.dev/s.css">',
    ],
    ['script src', '<script src="https://x.r2.dev/s.js"></script>'],
    [
      'preload href',
      '<link rel="preload" as="video" href="https://x.r2.dev/v.mp4">',
    ],
    ['srcset', '<img srcset="/a.png 1x, https://x.r2.dev/b.png 2x">'],
    ['protocol-relative src', '<img src="//x.r2.dev/b.png">'],
  ])('finds it in a %s', (_form, body) => {
    expect(freeHostProblems(page(body))).toEqual([
      'index.html: loads from https://x.r2.dev',
    ]);
  });

  it.each(['media-src', 'img-src'])(
    'finds it in a CSP %s entry',
    (directive) => {
      expect(
        freeHostProblems({
          _headers: `/*\n  Content-Security-Policy: ${directive} 'self' https://x.r2.dev\n`,
        }),
      ).toEqual(['_headers: loads from https://x.r2.dev']);
    },
  );

  it('finds a bare host in a CSP entry', () => {
    expect(
      freeHostProblems({
        _headers: '/*\n  Content-Security-Policy: img-src x.r2.dev\n',
      }),
    ).toEqual(['_headers: loads from x.r2.dev']);
  });

  it('names each address once per file, in every file', () => {
    expect(
      freeHostProblems({
        'a.html':
          '<img src="https://x.r2.dev/1"><img src="https://x.r2.dev/2">',
        'b/c.js': 'fetch("https://y.pages.dev/z")',
      }),
    ).toEqual([
      'a.html: loads from https://x.r2.dev',
      'b/c.js: loads from https://y.pages.dev',
    ]);
  });

  it('leaves a longer domain that only ends like one alone', () => {
    expect(
      freeHostProblems(page('<img src="https://x.r2.develop.shyden.co.uk/a">')),
    ).toEqual([]);
  });

  it('refuses an empty build, so a wrong folder cannot pass', () => {
    expect(freeHostProblems({})).toEqual(['no built files to check']);
  });
});

describe('the check in CI (#768)', () => {
  const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
    jobs: Record<
      string,
      { steps: { name?: string; run?: unknown; if?: string }[] }
    >;
  };
  const steps = ci.jobs['build-and-test']?.steps ?? [];
  const at = (command: string): number =>
    steps.findIndex((s) => runOf(s) === command);

  it('runs on the production holding page, its dev copy and the site, after they are built', () => {
    const build = at('scripts/fail-on-warnings.sh npm run build');
    const holding = at('npm run build:holding --workspace @yawelo-idle/site');
    const devCopy = at('node scripts/holding-dev.ts');
    const check = at(
      'node scripts/free-hosts.ts apps/site/dist apps/site/dist-holding apps/site/dist-holding-dev',
    );
    expect([build, holding, devCopy].every((i) => i >= 0)).toBe(true);
    expect(holding).toBeGreaterThan(build);
    expect(devCopy).toBe(holding + 1);
    expect(check).toBe(devCopy + 1);
    expect([holding, devCopy, check].map((i) => steps[i]?.if)).toEqual(
      Array.from({ length: 3 }, () => steps[build]?.if),
    );
  });
});
