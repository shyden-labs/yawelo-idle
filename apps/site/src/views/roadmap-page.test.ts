import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The roadmap page stands alone (#827 AC4, #342 AC9): it imports the site's
 * base layout and the voyage map, and none of the home page's sections
 * (#335), so it can be released ahead of the rest of the site (Shyden,
 * 2026-10-24).
 */
const importsOf = (path: string): string[] =>
  [
    ...readFileSync(new URL(path, import.meta.url), 'utf8').matchAll(
      /^\s*import\s[^'"]*['"]([^'"]+)['"]/gm,
    ),
  ].map((match) => match[1] ?? '');

describe('the roadmap page’s imports (#827)', () => {
  it('are the base layout, the voyage map, the copy and the locale type', () => {
    expect(importsOf('./Roadmap.astro')).toEqual([
      '../layouts/Base.astro',
      '../roadmap/VoyageMap.svelte',
      '../copy',
      '../i18n',
    ]);
  });

  it('reach nothing of the home page from the voyage map', () => {
    expect(importsOf('../roadmap/VoyageMap.svelte')).toEqual([
      '@yawelo-idle/progress',
      '../copy',
      './Island.svelte',
      './voyage',
    ]);
  });

  it('reach nothing of the home page from an island', () => {
    expect(importsOf('../roadmap/Island.svelte')).toEqual([
      '../copy',
      './voyage',
    ]);
  });
});
