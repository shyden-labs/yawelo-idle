import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The tab icon (#1055). Without one, branded Chrome and Edge ask for
 * /favicon.ico and log a 404 (measured on PR #1054). The game and the site
 * each declare the same SVG icon, served from their own origin, so
 * `default-src 'self'` admits it and no browser falls back to /favicon.ico.
 */

const GAME_ICON = 'apps/web/public/favicon.svg';
const SITE_ICON = 'apps/site/public/favicon.svg';

const PAGES: [string, string, string][] = [
  ['the game', 'apps/web/index.html', '/play/favicon.svg'],
  ['the site', 'apps/site/src/layouts/Base.astro', '/favicon.svg'],
  ['the holding page', 'apps/site/src/layouts/Holding.astro', '/favicon.svg'],
];

describe.each(PAGES)('%s (#1055)', (_label, page, href) => {
  it('declares the SVG tab icon from its own origin', () => {
    expect(readFileSync(page, 'utf8')).toContain(
      `<link rel="icon" type="image/svg+xml" href="${href}" />`,
    );
  });
});

describe('the icon file (#1055)', () => {
  it('is an SVG with a square view box', () => {
    const svg = readFileSync(GAME_ICON, 'utf8');
    expect(svg).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/viewBox="0 0 (\d+) \1"/);
  });

  it('is the design Shyden chose: twin sparkles on the night square (2026-11-21)', () => {
    expect(readFileSync(GAME_ICON, 'utf8')).toBe(
      readFileSync('docs/design/tab-icon/twin-sparkles.svg', 'utf8'),
    );
  });

  // The holding page (production's yaweloidle.com, and its test and dev
  // copies) builds from apps/site/holding/public, not apps/site/public:
  // without its own copy, /favicon.svg answered 404 on dev-holding
  // (measured 2026-11-21 after PR #1056 deployed).
  it('is served by the holding page too, from its own public folder', () => {
    expect(readFileSync('apps/site/holding/public/favicon.svg', 'utf8')).toBe(
      readFileSync(GAME_ICON, 'utf8'),
    );
  });

  it('is the same file for the game and the site', () => {
    expect(readFileSync(SITE_ICON, 'utf8')).toBe(
      readFileSync(GAME_ICON, 'utf8'),
    );
  });
});

/**
 * The .ico fallback at /favicon.ico (#1055 AC2): browsers that ignore the
 * SVG, and every browser before it reads the page, ask for /favicon.ico.
 * One file, rendered once from the chosen design at 16, 32 and 48 px, each
 * image stored as PNG (allowed in ICO since Windows Vista).
 */
const ICO_DESIGN = 'docs/design/tab-icon/twin-sparkles.ico';
const ICO_COPIES = [
  ['the site', 'apps/site/public/favicon.ico'],
  ['the holding page', 'apps/site/holding/public/favicon.ico'],
] as const;

describe.each(ICO_COPIES)('%s’s /favicon.ico (#1055 AC2)', (_label, path) => {
  it('is the .ico rendered from the chosen design', () => {
    expect(readFileSync(path)).toEqual(readFileSync(ICO_DESIGN));
  });
});

describe('the .ico file (#1055 AC2)', () => {
  const ico = (): Buffer => readFileSync(ICO_DESIGN);

  it('is an icon file holding three images', () => {
    const file = ico();
    expect([
      file.readUInt16LE(0),
      file.readUInt16LE(2),
      file.readUInt16LE(4),
    ]).toEqual([0, 1, 3]);
  });

  it('holds 16, 32 and 48 px square images, each a PNG inside the file', () => {
    const file = ico();
    const entries = [0, 1, 2].map((index) => {
      const at = 6 + index * 16;
      const size = file.readUInt32LE(at + 8);
      const offset = file.readUInt32LE(at + 12);
      return {
        width: file.readUInt8(at),
        height: file.readUInt8(at + 1),
        png: file.subarray(offset, offset + 8).toString('hex'),
        inside: offset + size <= file.length,
      };
    });
    expect(entries).toEqual(
      [16, 32, 48].map((px) => ({
        width: px,
        height: px,
        png: '89504e470d0a1a0a',
        inside: true,
      })),
    );
  });
});
