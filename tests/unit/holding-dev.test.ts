import { describe, expect, it } from 'vitest';
import { BLOCKING_ROBOTS_TXT, NO_INDEX } from '@yawelo-idle/lockdown';
import {
  DEV_ROBOTS,
  MEDIA_ADDRESSES,
  devHeaders,
  devMedia,
  devMediaFiles,
  rewritten,
} from '../../scripts/holding-dev';
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

/**
 * The dev copy's media host (#713): the dev copy is on workers.dev, another
 * site, where media.shyden.co.uk's same-site policy blocks the video
 * (measured in Chrome 155, NotSameSite), so it takes the media from the
 * dev-only bucket instead (Shyden, 2026-10-20, "Dev media store").
 */
describe('the dev copy’s media host', () => {
  const FROM = 'https://media.example';
  const TO = 'https://dev-media.example';

  it('moves every media address in a page to the dev host', () => {
    expect(
      devMedia(
        '<video poster="https://media.example/a.jpg"><source src="https://media.example/b.mp4"></video>',
        2,
        'index.html',
        FROM,
        TO,
      ),
    ).toBe(
      '<video poster="https://dev-media.example/a.jpg"><source src="https://dev-media.example/b.mp4"></video>',
    );
  });

  it('moves the media host in the content security policy', () => {
    expect(
      devMedia(
        "img-src https://media.example; media-src https://media.example; base-uri 'none'",
        2,
        '_headers',
        FROM,
        TO,
      ),
    ).toBe(
      "img-src https://dev-media.example; media-src https://dev-media.example; base-uri 'none'",
    );
  });

  it('leaves a host that only starts like the media host', () => {
    expect(
      devMedia('src="https://media.example.org/a.mp4"', 0, 'x', FROM, TO),
    ).toBe('src="https://media.example.org/a.mp4"');
  });

  it('refuses a file holding fewer media addresses than expected, rather than ship a copy that still loads production’s', () => {
    expect(() =>
      devMedia(
        'poster="https://media.example/a.jpg"',
        3,
        'index.html',
        FROM,
        TO,
      ),
    ).toThrow('index.html: moved 1 media address, expected 3');
  });

  it('refuses a file holding more media addresses than expected', () => {
    expect(() =>
      devMedia(
        'https://media.example/a https://media.example/b',
        1,
        '_headers',
        FROM,
        TO,
      ),
    ).toThrow('_headers: moved 2 media addresses, expected 1');
  });
});

describe('the dev copy’s build', () => {
  const FROM = 'https://media.example';
  const TO = 'https://dev-media.example';
  const page = (count: number): string =>
    Array.from({ length: count }, (_, at) => `${FROM}/${String(at)}`).join(' ');
  const BUILD = new Map([
    ['index.html', page(3)],
    ['id/index.html', page(3)],
    ['404.html', page(0)],
    ['_headers', page(2)],
  ]);

  // Counted in the holding build of 2026-10-20: the poster and two sources
  // on each home page, `img-src` and `media-src` in the CSP, none elsewhere.
  it('holds media addresses on both home pages and in the headers only', () => {
    expect(MEDIA_ADDRESSES).toEqual({
      'index.html': 3,
      'id/index.html': 3,
      _headers: 2,
    });
  });

  it.each([
    'index.html',
    'id/404.html',
    '_astro/a.js',
    '_astro/b.css',
    '_headers',
  ])('rewrites %s, which could name the media host', (path) => {
    expect(rewritten(path)).toBe(true);
  });

  it.each(['robots.txt', '_astro/c.woff2', 'icon.png'])(
    'leaves %s, which cannot name it',
    (path) => {
      expect(rewritten(path)).toBe(false);
    },
  );

  it('moves every media address in the build to the dev host', () => {
    expect([...devMediaFiles(BUILD, FROM, TO).values()].join(' ')).toBe(
      [page(3), page(3), page(0), page(2)].join(' ').replaceAll(FROM, TO),
    );
  });

  it('refuses a build missing a page that holds the media', () => {
    expect(() =>
      devMediaFiles(
        new Map([...BUILD].filter(([path]) => path !== 'id/index.html')),
        FROM,
        TO,
      ),
    ).toThrow('the build has no id/index.html to move media addresses in');
  });

  it('refuses a page that gained a media address, rather than ship one still loading production’s', () => {
    expect(() =>
      devMediaFiles(new Map([...BUILD, ['404.html', page(1)]]), FROM, TO),
    ).toThrow('404.html: moved 1 media address, expected 0');
  });
});
