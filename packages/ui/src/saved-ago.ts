import type { UiLocale } from './i18n/catalogue';

/**
 * How long before `now` a backup was saved, in the largest whole unit that
 * fits, as the player's language says it (#160 AC3): "5 minutes ago",
 * "5 menit yang lalu". A copy stamped after `now` (the clock moved back)
 * reads as saved just now.
 */
const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

export function savedAgo(
  locale: UiLocale,
  savedAt: number,
  now: number,
): string {
  const age = Math.max(0, now - savedAt);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
  for (const [unit, size] of UNITS) {
    if (age >= size) return format.format(-Math.floor(age / size), unit);
  }
  return format.format(-Math.floor(age / 1000), 'second');
}
