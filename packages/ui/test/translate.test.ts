import { describe, expect, it } from 'vitest';
import { parts, slots, t } from '../src/i18n/catalogue';

/** Reading the catalogue (#104 AC1): `t` fills slots, `parts` splits them. */
describe('slots', () => {
  it('lists each {slot} in order', () => {
    expect(slots('{roadmap} or {launchList}.')).toEqual([
      'roadmap',
      'launchList',
    ]);
  });

  it('lists none in plain text', () => {
    expect(slots('Coming soon.')).toEqual([]);
  });
});

describe('t', () => {
  // AC1: an unknown key is a compile error. The directive below fails the
  // typecheck once it is unused, so the build breaks if `t` ever accepts any
  // string; at run time the key finds no template and `t` throws.
  it('refuses an unknown key at compile time (AC1)', () => {
    // @ts-expect-error 'shell.unknown' is not a key of the catalogue
    expect(() => t('en', 'shell.unknown')).toThrow();
  });

  it('returns a plain string as it is', () => {
    expect(t('id', 'shell.comingSoon')).toBe('Segera hadir.');
  });

  it('fills every slot from the values', () => {
    expect(
      t('en', 'shell.next', { roadmap: 'Roadmap', launchList: 'the list' }),
    ).toBe('Roadmap or the list.');
  });

  it('refuses a slot it has no value for, naming it', () => {
    expect(() => t('en', 'shell.next', { roadmap: 'Roadmap' })).toThrow(
      't: shell.next (en) needs a value for {launchList}',
    );
  });
});

describe('parts', () => {
  it('splits a template into slots and text', () => {
    expect(parts('id', 'shell.next')).toEqual([
      { slot: 'roadmap' },
      { text: ' atau ' },
      { slot: 'launchList' },
      { text: '.' },
    ]);
  });

  it('returns plain text as one part', () => {
    expect(parts('en', 'shell.comingSoon')).toEqual([{ text: 'Coming soon.' }]);
  });
});
