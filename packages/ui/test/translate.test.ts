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
