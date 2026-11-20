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

  it('is the same file for the game and the site', () => {
    expect(readFileSync(SITE_ICON, 'utf8')).toBe(
      readFileSync(GAME_ICON, 'utf8'),
    );
  });
});
