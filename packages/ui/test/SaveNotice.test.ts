import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SaveNotice from '../src/SaveNotice.svelte';

/**
 * What the player is told when the latest save does not load (#160 AC3): a
 * restored backup names how far back it went; when every copy is damaged the
 * player is offered the choice, never a silent reset.
 */
const NOW = Date.UTC(2026, 10, 17, 12, 0, 0);
const noop = (): void => undefined;

const restored = (locale: 'en' | 'id'): string =>
  render(SaveNotice, {
    props: {
      locale,
      notice: { kind: 'restored', savedAt: NOW - 5 * 60_000 },
      now: NOW,
    },
  }).body;

const damaged = (locale: 'en' | 'id'): string =>
  render(SaveNotice, {
    props: {
      locale,
      notice: { kind: 'allDamaged' },
      now: NOW,
      onStartNew: noop,
      onKeepAndClose: noop,
    },
  }).body;

describe('the restored-backup notice', () => {
  it.each([
    [
      'en',
      'Your latest save was damaged, so the backup saved 5 minutes ago was loaded.',
    ],
    [
      'id',
      'Data simpanan terakhir Anda rusak, jadi cadangan yang disimpan 5 menit yang lalu telah dimuat.',
    ],
  ] as const)('in %s, names how far back it went', (locale, text) => {
    expect(restored(locale)).toContain(text);
  });

  it('is announced politely, marked with its language and offers no choice', () => {
    const body = restored('id');
    expect([
      body.includes('role="status"'),
      body.includes('lang="id"'),
      body.includes('<button'),
    ]).toEqual([true, true, false]);
  });
});

describe('the every-copy-damaged choice', () => {
  it.each([
    [
      'en',
      'Your save and all its backups are damaged.',
      'Start a new game',
      'Keep the damaged save and close',
    ],
    [
      'id',
      'Data simpanan Anda dan semua cadangannya rusak.',
      'Mulai permainan baru',
      'Pertahankan data simpanan yang rusak dan tutup',
    ],
  ] as const)(
    'in %s, says so and offers both choices',
    (locale, text, start, keep) => {
      const body = damaged(locale);
      expect([
        body.includes(text),
        body.includes(`>${start}</button>`),
        body.includes(`>${keep}</button>`),
      ]).toEqual([true, true, true]);
    },
  );

  it('is an alert dialog, marked with its language, whose buttons submit nothing', () => {
    const body = damaged('id');
    expect([
      body.includes('role="alertdialog"'),
      body.includes('lang="id"'),
      (body.match(/<button type="button"/g) ?? []).length,
    ]).toEqual([true, true, 2]);
  });
});
