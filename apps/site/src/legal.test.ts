import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COPY, LEGAL } from './copy';
import { LEGAL_PAGES, LOCALES } from './i18n';

/**
 * Legal pages are English only (Shyden, 2026-11-08: "legal pages can only be
 * in English. any translated pages need to be removed"; #925). A legal page
 * has no file under a language folder, and no language's copy holds its text:
 * that text lives in `LEGAL`, which is English and is never translated.
 */
const LANGUAGE_FOLDERS = LOCALES.filter((locale) => locale !== 'en');

describe('no translated copy of a legal page exists (#925)', () => {
  it.each(
    LANGUAGE_FOLDERS.flatMap((locale) =>
      LEGAL_PAGES.map((page) => [locale, page] as const),
    ),
  )('pages/%s has no %s page', (locale, page) => {
    const folder = new URL(`./pages/${locale}/`, import.meta.url);
    expect(readdirSync(folder)).not.toContain(`${page}.astro`);
  });

  it.each(LOCALES)('%s copy has no title for a legal page', (locale) => {
    for (const page of LEGAL_PAGES)
      expect(Object.keys(COPY[locale].titles)).not.toContain(page);
  });

  it.each(LOCALES)('%s copy holds no legal text', (locale) => {
    expect(Object.keys(COPY[locale])).not.toContain('privacySoon');
  });

  it('keeps the privacy page’s own text, in English', () => {
    expect(LEGAL.privacy.title).toBe('Privacy');
    expect(LEGAL.privacy.soon).toBe(
      'The privacy notice will be published here before the launch list opens.',
    );
  });

  it.each([
    ['en', 'This page is available in English only.'],
    ['id', 'Halaman ini hanya tersedia dalam bahasa Inggris.'],
  ] as const)(
    'gives %s readers the one translated note a legal page may carry',
    (locale, note) => {
      expect(COPY[locale].englishOnlyNote).toBe(note);
    },
  );
});
