import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COPY, LEGAL } from './copy';
import { LEGAL_LOCALES, LEGAL_PAGES, LOCALES, type Locale } from './i18n';

/**
 * Legal pages exist in English and Indonesian only (Shyden, 2026-11-08,
 * global rule; #928). Their text lives in `LEGAL`, apart from every
 * language's general copy; no other language's legal text is written, and
 * a page file exists only in a legal language's folder.
 */
const folderOf = (locale: Locale): URL =>
  new URL(locale === 'en' ? './pages/' : `./pages/${locale}/`, import.meta.url);

const isLegalLocale = (locale: Locale): boolean =>
  (LEGAL_LOCALES as readonly Locale[]).includes(locale);

describe('legal pages exist in English and Indonesian only (#928)', () => {
  it.each(
    LOCALES.flatMap((locale) =>
      LEGAL_PAGES.map((page) => [locale, page] as const),
    ),
  )('pages for %s hold a %s page only in a legal language', (locale, page) => {
    expect(readdirSync(folderOf(locale)).includes(`${page}.astro`)).toBe(
      isLegalLocale(locale),
    );
  });

  it('writes legal text in English and Indonesian alone', () => {
    expect(Object.keys(LEGAL)).toEqual(['en', 'id']);
  });

  it.each(LOCALES)('%s copy has no title for a legal page', (locale) => {
    for (const page of LEGAL_PAGES)
      expect(Object.keys(COPY[locale].titles)).not.toContain(page);
  });

  it.each(LOCALES)('%s copy holds no legal text', (locale) => {
    expect(Object.keys(COPY[locale])).not.toContain('privacySoon');
  });
});

describe('the privacy page’s text (#928)', () => {
  it('keeps the English text', () => {
    expect(LEGAL.en.privacy).toEqual({
      title: 'Privacy',
      soon: 'The privacy notice will be published here before the launch list opens.',
      governs:
        'For residents of Indonesia, the Indonesian text of this page governs. For everyone else, the English text governs.',
    });
  });

  it('keeps the Indonesian text', () => {
    expect(LEGAL.id.privacy).toEqual({
      title: 'Privasi',
      soon: 'Pemberitahuan privasi akan diterbitkan di sini sebelum daftar peluncuran dibuka.',
      governs:
        'Bagi penduduk Indonesia, yang berlaku adalah teks halaman ini dalam bahasa Indonesia. Bagi semua orang lainnya, yang berlaku adalah teks dalam bahasa Inggris.',
    });
  });

  it.each([
    ['en', 'This page is available in English only.'],
    ['id', 'Halaman ini hanya tersedia dalam bahasa Inggris.'],
  ] as const)(
    'keeps the %s note a legal page carries for a language without its text',
    (locale, note) => {
      expect(COPY[locale].englishOnlyNote).toBe(note);
    },
  );
});
