import { describe, expect, it } from 'vitest';
import { licenceCheck } from '@yawelo-idle/content';
import { en, type UiKey } from '../src/i18n/catalogue';
import { licences } from '../src/i18n/licences';

/**
 * UI strings are licensed per string like content (#102 AC3; spec §5.3, D17):
 * each key records its source and licence, and the same guard judges them.
 */
const keys = Object.keys(en) as UiKey[];
const sorted = (list: readonly string[]): string[] => [...list].sort();

describe('the UI strings’ licences (#102 AC3)', () => {
  it('every key has a licence record, and no record names a key the catalogue lacks', () => {
    expect(sorted(Object.keys(licences))).toEqual(sorted(keys));
  });

  it('the guard judges every key and refuses none', () => {
    const items = keys.map((key) => ({ id: key, ...licences[key] }));
    expect(licenceCheck('ui', items)).toEqual({
      name: 'licences: ui',
      judged: keys.length,
      errors: [],
      message: `licences: ui: ${String(keys.length)} judged, 0 refused`,
    });
  });

  it.each(keys)('%s is original work under CC-BY-NC-SA-4.0', (key) => {
    expect(licences[key]).toEqual({
      source: 'original',
      licence: 'CC-BY-NC-SA-4.0',
    });
  });
});
