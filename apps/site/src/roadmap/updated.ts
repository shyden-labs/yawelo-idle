/**
 * The roadmap's one "Last updated" line (#1074; Shyden, 2026-11-23): the
 * snapshot's read time as date and time in the visitor's own time zone, each
 * language formatting them its own way. The zone's name never depends on the
 * page's language (Shyden, 2026-11-23): a visitor sees the same name on every
 * page, its local name where one is known, its offset where none is.
 */
import type { Locale } from '../i18n';
import { fill } from './voyage';

const FORMAT_LOCALE: Record<Locale, string> = { en: 'en-GB', id: 'id-ID' };

/**
 * The locales asked, in this order, for a zone's local name: browsers give a
 * zone's own short name (WIB, EST, BST, IST, AEDT) only under the locales
 * that use it, and an offset under the rest. Fixed, so the page's language
 * plays no part.
 */
const ZONE_NAME_LOCALES = [
  'id-ID',
  'en-US',
  'en-GB',
  'en-IN',
  'en-AU',
  'en-NZ',
  'en-CA',
  'en-ZA',
  'en-SG',
] as const;

/** An offset name such as "GMT+7" or "UTC-5", not a local one. */
const OFFSET = /^(?:GMT|UTC)[+\-−]/;

const zoneName = (
  at: Date,
  timeZone: string | undefined,
  locale: string,
  style: 'short' | 'shortOffset',
): string =>
  new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: style })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value ?? '';

/** The zone's local name where one is known, else its offset. */
function zoneLabel(at: Date, timeZone: string | undefined): string {
  for (const locale of ZONE_NAME_LOCALES) {
    const name = zoneName(at, timeZone, locale, 'short');
    if (!OFFSET.test(name)) return name;
  }
  return zoneName(at, timeZone, 'en-US', 'shortOffset');
}

/** `template` with `{date}`, `{time}` and `{zone}` filled from `readAt`. */
export function updatedLine(
  readAt: string,
  template: string,
  locale: Locale,
  timeZone?: string,
): string {
  const at = new Date(readAt);
  const lang = FORMAT_LOCALE[locale];
  const date = new Intl.DateTimeFormat(lang, {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(at);
  const time = new Intl.DateTimeFormat(lang, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
  return fill(template, { date, time, zone: zoneLabel(at, timeZone) });
}
