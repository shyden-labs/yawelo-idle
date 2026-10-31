import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEV_MEDIA, MEDIA_ORIGIN, PROD_MEDIA, PROMO, mediaUrl } from './media';

/**
 * The promo media's one home (#713): the files are tracked in apps/site/media/
 * and served from the Cloudflare R2 bucket `yawelo-idle-media` on
 * media.shyden.co.uk, which answers byte ranges. Shyden uploads a new file by
 * hand (2026-10-20, "By hand + checklist"), so the folder's README is the
 * checklist, and every deploy's verify compares each served file with its
 * tracked copy.
 */
const FOLDER = new URL('../media/', import.meta.url);

describe('the promo media', () => {
  it('are served from media.shyden.co.uk, on the same site as both pages that show them', () => {
    expect(MEDIA_ORIGIN).toBe('https://media.shyden.co.uk');
  });

  it('are the poster, the MP4 and the WebM, each with its content type, MP4 before WebM', () => {
    expect(PROMO.map(({ file, type }) => [file, type])).toEqual([
      ['yawelo-idle-promo-poster.jpg', 'image/jpeg'],
      ['yawelo-idle-promo.mp4', 'video/mp4'],
      ['yawelo-idle-promo.webm', 'video/webm'],
    ]);
  });

  it('name each file at its address on the media host', () => {
    expect(mediaUrl('yawelo-idle-promo.mp4')).toBe(
      'https://media.shyden.co.uk/yawelo-idle-promo.mp4',
    );
  });

  it('are judged on production by both headers of the zone rule, and a 416 that names the size', () => {
    expect(PROD_MEDIA).toEqual({
      origin: 'https://media.shyden.co.uk',
      headers: {
        'cross-origin-resource-policy': 'same-site',
        'x-content-type-options': 'nosniff',
      },
    });
  });

  // Measured 2026-10-26 (#768) from Biznet's own DNS and from DNS over
  // HTTPS: dev-media.shyden.co.uk answers 200, 206 on bytes=0-1 and 416 past
  // the end with the size, each with both headers, as production does.
  it('are judged on the dev store exactly as on production, apart from the origin', () => {
    expect(DEV_MEDIA).toEqual({
      ...PROD_MEDIA,
      origin: 'https://dev-media.shyden.co.uk',
    });
  });

  it('are exactly the files tracked in apps/site/media/, beside its upload checklist', () => {
    expect(readdirSync(FOLDER).sort()).toEqual([
      'README.md',
      'yawelo-idle-promo-poster.jpg',
      'yawelo-idle-promo.mp4',
      'yawelo-idle-promo.webm',
    ]);
  });
});

/**
 * The entries of the holding page's public folder that could put a promo
 * file in the build: a folder (written `name/`), where a copy could sit as
 * `media/` did before #713, or a file named like a promo file.
 */
const promoCopies = (entries: readonly string[]): string[] =>
  entries.filter(
    (entry) => entry.endsWith('/') || PROMO.some(({ file }) => entry === file),
  );

/** The holding page's public folder, one level: the build copies it as is. */
const publicEntries = (): string[] =>
  readdirSync(new URL('../holding/public/', import.meta.url), {
    withFileTypes: true,
  }).map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));

// The build ships the public folder as is, plus Vite's own `_astro/` files;
// a promo file copied there would be served by the asset router, which
// answers no byte ranges (#713).
describe('the holding page’s public folder', () => {
  it('holds files only, none of them a promo file', () => {
    const entries = publicEntries();
    expect(promoCopies(entries)).toEqual([]);
  });

  it('would name the media/ folder the files sat in before #713', () => {
    expect(promoCopies(['_headers', 'media/', 'robots.txt'])).toEqual([
      'media/',
    ]);
  });

  it('would name any other folder, which could hold a copy', () => {
    expect(promoCopies(['video/'])).toEqual(['video/']);
  });

  it('would name a promo file copied in by its name', () => {
    expect(
      promoCopies(['yawelo-idle-promo-poster.jpg', 'holding-video.js']),
    ).toEqual(['yawelo-idle-promo-poster.jpg']);
  });
});

/** A checklist table row's two cells; Prettier pads them to the widest. */
const rows = (): string[][] =>
  [
    ...readFileSync(new URL('README.md', FOLDER), 'utf8').matchAll(
      /^\| `([^`]+)` +\| `([^`]+)` +\|$/gm,
    ),
  ].map(([, file, type]) => [file ?? '', type ?? '']);

describe('the upload checklist', () => {
  it('lists every file with the content type it must be uploaded with, in order', () => {
    expect(rows()).toEqual(PROMO.map(({ file, type }) => [file, type]));
  });

  it('lists the three files the page shows', () => {
    expect(rows()).toHaveLength(3);
  });
});
