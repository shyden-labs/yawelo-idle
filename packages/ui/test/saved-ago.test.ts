import { describe, expect, it } from 'vitest';
import { savedAgo } from '../src/saved-ago';

/**
 * How long ago a restored backup was saved, in the player's language (#160
 * AC3), in the largest whole unit that fits.
 */
const NOW = Date.UTC(2026, 10, 17, 12, 0, 0);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('savedAgo', () => {
  it.each([
    ['en', 30 * SECOND, '30 seconds ago'],
    ['en', 59 * SECOND, '59 seconds ago'],
    ['en', MINUTE, '1 minute ago'],
    ['en', 59 * MINUTE + 59 * SECOND, '59 minutes ago'],
    ['en', HOUR, '1 hour ago'],
    ['en', 23 * HOUR + 59 * MINUTE, '23 hours ago'],
    ['en', DAY, '1 day ago'],
    ['en', 9 * DAY, '9 days ago'],
    ['id', 30 * SECOND, '30 detik yang lalu'],
    ['id', 2 * MINUTE, '2 menit yang lalu'],
    ['id', 3 * HOUR, '3 jam yang lalu'],
    ['id', 4 * DAY, '4 hari yang lalu'],
  ] as const)('in %s, %d ms back reads "%s"', (locale, age, text) => {
    expect(savedAgo(locale, NOW - age, NOW)).toBe(text);
  });

  it('reads a copy saved this instant as 0 seconds ago', () => {
    expect(savedAgo('en', NOW, NOW)).toBe('0 seconds ago');
  });

  it('reads a copy stamped in the future (a clock moved back) as 0 seconds ago', () => {
    expect(savedAgo('en', NOW + HOUR, NOW)).toBe('0 seconds ago');
  });
});
