import { describe, expect, it } from 'vitest';
import { COPY } from '../copy';
import { updatedLine } from './updated';

/**
 * The roadmap's one "Last updated" line (#1074; Shyden, 2026-11-23): the
 * snapshot's read time as date and time in the visitor's own time zone, with
 * the zone named. Each language formats the date and time its own way, but
 * the page's language never decides the zone's name (Shyden, 2026-11-23:
 * "language is not to be considered a way of determining location"): a
 * visitor sees the same name on every page, its local name where one is
 * known ("Local names where known"), its offset where none is.
 */
const READ_AT = '2026-11-23T01:05:00.000Z';

describe('the last updated line (#1074)', () => {
  it('reads in English, in a visitor’s zone in Jakarta', () => {
    expect(
      updatedLine(READ_AT, COPY.en.map.lastUpdated, 'en', 'Asia/Jakarta'),
    ).toBe('Last updated 23 November 2026, 08:05 WIB');
  });

  it('reads in Indonesian, naming the Indonesian zone', () => {
    expect(
      updatedLine(READ_AT, COPY.id.map.lastUpdated, 'id', 'Asia/Jakarta'),
    ).toBe('Terakhir diperbarui 23 November 2026, 08.05 WIB');
  });

  it('moves the date with the visitor’s zone', () => {
    expect(
      updatedLine(READ_AT, COPY.en.map.lastUpdated, 'en', 'America/New_York'),
    ).toBe('Last updated 22 November 2026, 20:05 EST');
  });

  it('uses the browser’s own zone when none is given', () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(updatedLine(READ_AT, COPY.en.map.lastUpdated, 'en')).toBe(
      updatedLine(READ_AT, COPY.en.map.lastUpdated, 'en', zone),
    );
  });

  it('names each zone the same on the English and the Indonesian page', () => {
    const zone = (locale: 'en' | 'id', timeZone: string): string =>
      updatedLine(READ_AT, '{zone}', locale, timeZone);
    expect(
      ['Asia/Makassar', 'Asia/Jayapura', 'Europe/London', 'Asia/Kolkata'].map(
        (tz) => [zone('en', tz), zone('id', tz)],
      ),
    ).toEqual([
      ['WITA', 'WITA'],
      ['WIT', 'WIT'],
      ['GMT', 'GMT'],
      ['IST', 'IST'],
    ]);
  });

  it('names a zone’s summer time by its own name', () => {
    expect(
      updatedLine('2026-07-01T01:05:00.000Z', '{zone}', 'id', 'Europe/London'),
    ).toBe('BST');
  });

  it('gives the offset where no local name is known, the same in both languages', () => {
    expect([
      updatedLine(READ_AT, '{zone}', 'en', 'Asia/Tokyo'),
      updatedLine(READ_AT, '{zone}', 'id', 'Asia/Tokyo'),
    ]).toEqual(['GMT+9', 'GMT+9']);
  });
});
