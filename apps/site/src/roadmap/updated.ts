/**
 * The roadmap's one "Last updated" line (#1074; Shyden, 2026-11-23): the
 * snapshot's read time as date and time in the visitor's own time zone, with
 * the zone's short name, each language formatting them its own way.
 */
import type { Locale } from '../i18n';
import { fill } from './voyage';

const FORMAT_LOCALE: Record<Locale, string> = { en: 'en-GB', id: 'id-ID' };

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
  const zone =
    new Intl.DateTimeFormat(lang, { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';
  return fill(template, { date, time, zone });
}
