/**
 * The site's languages and pages (website spec §3, W8): English at `/…` and
 * Indonesian at `/id/…`. Every link between pages and every `hreflang`
 * alternate is built here, from one table, so a page added later has its
 * address in both languages or in neither.
 */
import { PROD_HOSTNAME } from '@yawelo-idle/lockdown';

export const LOCALES = ['en', 'id'] as const;
export type Locale = (typeof LOCALES)[number];

/** English has no prefix (spec §3). */
export const DEFAULT_LOCALE: Locale = 'en';

/** The pages that have an address of their own; the 404 has none. */
export const PAGES = ['home', 'roadmap', 'privacy'] as const;
export type Page = (typeof PAGES)[number];

/**
 * Legal pages are written in English and Indonesian alone (Shyden,
 * 2026-11-08, global rule; #928). For Indonesian residents the Indonesian
 * text governs, for everyone else the English. Any other language links to
 * the English address. The text lives in `LEGAL` (copy.ts), apart from the
 * general copy.
 */
export const LEGAL_PAGES = ['privacy'] as const satisfies readonly Page[];
export type LegalPage = (typeof LEGAL_PAGES)[number];
export const LEGAL_LOCALES = ['en', 'id'] as const satisfies readonly Locale[];
export type LegalLocale = (typeof LEGAL_LOCALES)[number];
/** The pages whose text sits in each language's general copy. */
export type LocalisedPage = Exclude<Page, LegalPage>;

export function isLegal(page: Page): page is LegalPage {
  return (LEGAL_PAGES as readonly Page[]).includes(page);
}

function hasLegalText(locale: Locale): boolean {
  return (LEGAL_LOCALES as readonly Locale[]).includes(locale);
}

/** The languages a page exists in: a legal page only in a legal language. */
export function localesOf(page: Page): readonly Locale[] {
  return isLegal(page) ? LOCALES.filter(hasLegalText) : LOCALES;
}

const SLUGS: Record<Page, string> = {
  home: '',
  roadmap: 'roadmap',
  privacy: 'privacy',
};

/**
 * The production origin. `hreflang` alternates must be absolute URLs, and
 * production is the only address meant to be indexed: dev answers with
 * noindex on every response (packages/lockdown).
 */
export const SITE = `https://${PROD_HOSTNAME}`;

/**
 * A page's path in a language; a legal page has its English path in a
 * language without legal text. The home page ends in a slash (`/`, `/id/`)
 * because it is a directory index; the others do not (`/roadmap`,
 * `/id/roadmap`), which is how Cloudflare serves `roadmap.html` without a
 * redirect (measured in the asset router, #332).
 */
export function pagePath(locale: Locale, page: Page): string {
  const shown = localesOf(page).includes(locale) ? locale : DEFAULT_LOCALE;
  const prefix = shown === DEFAULT_LOCALE ? '' : `/${shown}`;
  const slug = SLUGS[page];
  return slug === '' ? `${prefix}/` : `${prefix}/${slug}`;
}

export interface Alternate {
  hreflang: Locale | 'x-default';
  href: string;
}

/** One alternate per language the page exists in, plus `x-default` pointing at English. */
export function alternates(page: Page): Alternate[] {
  return [
    ...localesOf(page).map((locale) => ({
      hreflang: locale,
      href: `${SITE}${pagePath(locale, page)}`,
    })),
    { hreflang: 'x-default', href: `${SITE}${pagePath(DEFAULT_LOCALE, page)}` },
  ];
}

/** The language a switcher on a page in `locale` offers. */
export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'id' : 'en';
}
