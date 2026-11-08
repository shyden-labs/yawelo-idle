import { describe, expect, it } from 'vitest';
import {
  alternates,
  LEGAL_LOCALES,
  LEGAL_PAGES,
  LOCALES,
  localesOf,
  otherLocale,
  pagePath,
  PAGES,
  SITE,
  type Locale,
  type Page,
} from './i18n';

describe('the site’s languages and pages (#332 AC1)', () => {
  it('has English and Indonesian, and the three pages with addresses', () => {
    expect(LOCALES).toEqual(['en', 'id']);
    expect(PAGES).toEqual(['home', 'roadmap', 'privacy']);
  });

  it('indexes production only', () => {
    expect(SITE).toBe('https://yawelo-idle.shyden.co.uk');
  });

  it.each([
    ['en', 'home', '/'],
    ['en', 'roadmap', '/roadmap'],
    ['en', 'privacy', '/privacy'],
    ['id', 'home', '/id/'],
    ['id', 'roadmap', '/id/roadmap'],
    ['id', 'privacy', '/id/privacy'],
  ] as [Locale, Page, string][])('puts %s %s at %s', (locale, page, path) => {
    expect(pagePath(locale, page)).toBe(path);
  });

  it.each([
    ['en', 'id'],
    ['id', 'en'],
  ] as [Locale, Locale][])('offers %s readers %s', (locale, other) => {
    expect(otherLocale(locale)).toBe(other);
  });

  it.each(PAGES)(
    'lists %s in every language and x-default, as absolute URLs',
    (page) => {
      expect(alternates(page)).toEqual([
        { hreflang: 'en', href: `${SITE}${pagePath('en', page)}` },
        { hreflang: 'id', href: `${SITE}${pagePath('id', page)}` },
        { hreflang: 'x-default', href: `${SITE}${pagePath('en', page)}` },
      ]);
    },
  );
});

/**
 * Legal pages exist in English and Indonesian only (Shyden, 2026-11-08,
 * global rule; #928): Indonesian governs for Indonesian residents, English for
 * everyone else. A language outside the two links to the English page.
 */
describe('legal pages are English and Indonesian only (#928)', () => {
  it('counts the privacy notice as the one legal page', () => {
    expect(LEGAL_PAGES).toEqual(['privacy']);
  });

  it('writes legal text in English and Indonesian alone', () => {
    expect(LEGAL_LOCALES).toEqual(['en', 'id']);
  });

  it.each(LOCALES)(
    'has a legal page in %s only when it is a legal language',
    (locale) => {
      expect(localesOf('privacy').includes(locale)).toBe(
        (LEGAL_LOCALES as readonly Locale[]).includes(locale),
      );
    },
  );

  it.each(['home', 'roadmap'] as Page[])('has %s in every language', (page) => {
    expect(localesOf(page)).toEqual(LOCALES);
  });
});
