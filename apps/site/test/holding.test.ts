import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COPY } from '../src/copy.ts';
import type { Locale } from '../src/i18n.ts';
import { floorBreach } from '../../../tests/floors.ts';
import { inlineTags, startTags } from '../../../tests/inline-tags.ts';
import { searched } from '../../../tests/searched.ts';

/**
 * The built holding page (#621 AC1, AC2), read from dist-holding/ after
 * `npm run build:holding` (this workspace's `test` script builds it first).
 * What is checked is what production serves: the files themselves.
 */
const DIST = new URL('../dist-holding/', import.meta.url).pathname;
const html = (path: string): string => readFileSync(join(DIST, path), 'utf8');

const HOMES: readonly [string, Locale][] = [
  ['index.html', 'en'],
  ['id/index.html', 'id'],
];
const NOT_FOUND: readonly [string, Locale][] = [
  ['404.html', 'en'],
  ['id/404.html', 'id'],
];
const ALL = [...HOMES, ...NOT_FOUND];

/** Each page's links: the language switch, then a 404's link home. */
const LINKS: Record<string, string[]> = {
  'index.html': ['/id/'],
  'id/index.html': ['/'],
  '404.html': ['/id/', '/'],
  'id/404.html': ['/', '/id/'],
};

describe.each(HOMES)('the holding home page %s', (file, locale) => {
  it('shows the wordmark, the Coming soon pill and the tagline in its language', () => {
    const page = html(file);
    expect(page).toContain(`<html lang="${locale}">`);
    expect(page).toContain(
      `<h1 class="wordmark">${COPY[locale].titles.home}</h1>`,
    );
    expect(page).toContain(`data-coming-soon>${COPY[locale].comingSoon}</p>`);
    expect(page).toContain(`<p class="tagline">${COPY[locale].tagline}</p>`);
  });

  it('gives the promo video exactly these attributes: muted, looped, inline, with controls and a poster, started by the play rule', () => {
    const video = /<video\b[^>]*>/.exec(html(file))?.[0] ?? '';
    expect(
      [...video.matchAll(/\s([a-z-]+)(?:="[^"]*")?/g)].map(([, name]) => name),
    ).toEqual([
      'class',
      'data-autoplay',
      'muted',
      'loop',
      'playsinline',
      'controls',
      'preload',
      'width',
      'height',
      'poster',
      'aria-label',
    ]);
    expect(video).toContain(
      'poster="https://media.shyden.co.uk/yawelo-idle-promo-poster.jpg"',
    );
  });

  // MP4 first: Safari on a physical iPhone Air played the WebM once, restarted
  // once, then froze on its end card for good, while the MP4 looped for 35 s
  // (three variants measured on 2026-10-16, #621). Chrome on Android loops
  // either.
  it('offers MP4 first, then WebM, both from the media host (#713)', () => {
    const sources = [
      ...html(file).matchAll(/<source src="([^"]+)" type="([^"]+)">/g),
    ].map(([, src, type]) => [src, type]);
    expect(sources).toEqual([
      ['https://media.shyden.co.uk/yawelo-idle-promo.mp4', 'video/mp4'],
      ['https://media.shyden.co.uk/yawelo-idle-promo.webm', 'video/webm'],
    ]);
  });

  it('loads the play rule from its own file', () => {
    expect(html(file)).toContain(
      '<script src="/holding-video.js" defer></script>',
    );
  });

  it('links its language alternates', () => {
    expect(html(file)).toContain(
      '<link rel="alternate" hreflang="id" href="https://yawelo-idle.shyden.co.uk/id/">',
    );
  });
});

describe.each(NOT_FOUND)('the holding 404 page %s', (file, locale) => {
  it('says the page is not found and links home, in its language', () => {
    const page = html(file);
    expect(page).toContain(
      `<h1 class="heading">${COPY[locale].notFoundTitle}</h1>`,
    );
    expect(page).toContain(COPY[locale].homeLink);
  });
});

describe.each(ALL)('the built page %s', (file) => {
  it('needs nothing inline and loads nothing from a data URI, so the CSP holds', () => {
    const tags = startTags(html(file));
    const unsafe = [
      ...inlineTags(tags),
      ...tags.filter((tag) => /=\s*["']?data:/i.test(tag)),
    ];
    expect(searched(unsafe, { of: tags, what: `tags in ${file}` })).toEqual([]);
    expect(floorBreach(`holding-html/${file}`, tags.length)).toBeUndefined();
  });

  it('links only the two home pages production has, in order', () => {
    const links = [...html(file).matchAll(/<a [^>]*href="([^"]+)"/g)].map(
      ([, href]) => href,
    );
    expect(links).toEqual(LINKS[file]);
  });
});

describe('the built holding files', () => {
  it.each(['_headers', 'robots.txt', 'holding-video.js'])(
    'ships %s',
    (file) => {
      expect(existsSync(join(DIST, file))).toBe(true);
    },
  );
});
