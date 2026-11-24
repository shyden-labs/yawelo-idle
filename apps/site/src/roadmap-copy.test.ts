import { describe, expect, it } from 'vitest';
import { COPY } from './copy';

/**
 * The roadmap page's own words (#830 AC1) for the voyage map (#1068): the
 * intro and how to read the bar, approved by Shyden on 2026-11-24, and what
 * "launch" means, approved on 2026-11-13. The Indonesian page carries no note
 * about ticket titles: the map shows none, its summaries are Indonesian, and
 * the map's own note says island names stay English. The Indonesian's
 * evidence is in docs/translations/2026-11-24-roadmap-words-id.md and
 * docs/translations/2026-11-14-roadmap-id.md.
 */
describe('the roadmap page’s text in English (#830)', () => {
  it('opens by saying what the map shows', () => {
    expect(COPY.en.voyage.intro).toBe(
      'This map shows how far Yawelo Idle has come on its way to launch. Each island is one stage of building the game. Tap or click an island to see what it brings.',
    );
  });

  it('says what launch means', () => {
    expect(COPY.en.voyage.launch).toBe(
      'Launch is the day Yawelo Idle opens to everyone, free to play in your browser.',
    );
  });

  it('says how to read the bar', () => {
    expect(COPY.en.voyage.howToRead).toBe(
      'The bar shows how much of the planned work is done. New work is added as the game grows, so the bar can move back as well as forward.',
    );
  });

  it('carries no English-only note, since nothing on it is in another language', () => {
    expect(COPY.en.voyage.englishNote).toBeNull();
  });
});

describe('the roadmap page’s text in Indonesian (#830)', () => {
  it('opens by saying what the map shows', () => {
    expect(COPY.id.voyage.intro).toBe(
      'Peta ini menunjukkan sejauh mana Yawelo Idle telah berjalan menuju peluncuran. Setiap pulau adalah satu tahap pembuatan game. Ketuk atau klik sebuah pulau untuk melihat apa yang dibawanya.',
    );
  });

  it('says what launch means', () => {
    expect(COPY.id.voyage.launch).toBe(
      'Peluncuran adalah hari ketika Yawelo Idle dibuka untuk semua orang, gratis dimainkan di peramban Anda.',
    );
  });

  it('says how to read the bar', () => {
    expect(COPY.id.voyage.howToRead).toBe(
      'Bilah ini menunjukkan berapa banyak pekerjaan yang direncanakan sudah selesai. Pekerjaan baru ditambahkan seiring game berkembang, jadi bilahnya bisa mundur maupun maju.',
    );
  });

  it('carries no note about ticket titles, since the map shows none', () => {
    expect(COPY.id.voyage.englishNote).toBeNull();
  });
});
