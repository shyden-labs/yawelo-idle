import { describe, expect, it } from 'vitest';
import { COPY } from './copy';

/**
 * The roadmap page's own words (#830 AC1): the intro, what "launch" means
 * and how to read the percentage, approved by Shyden on 2026-11-13 as
 * drafted on the ticket, and their Indonesian with the note that ticket
 * titles and island summaries stay English. The Indonesian's evidence is in
 * docs/translations/2026-11-14-roadmap-id.md.
 */
describe('the roadmap page’s text in English (#830)', () => {
  it('opens with the approved intro', () => {
    expect(COPY.en.voyage.intro).toBe(
      'This is where the work on Yawelo Idle stands, read live from the development board. It updates by itself as work moves, with no need to reload.',
    );
  });

  it('says what launch means', () => {
    expect(COPY.en.voyage.launch).toBe(
      'Launch is the day Yawelo Idle opens to everyone, free to play in your browser.',
    );
  });

  it('says how to read the percentage', () => {
    expect(COPY.en.voyage.howToRead).toBe(
      'The percentage counts finished stories out of all the stories planned so far. A story is one piece of work. New stories are added as the game grows, so the figure can fall as well as rise. Points show the size of the work left: a bigger job has more points. The date is a forecast from the last seven days’ pace, not a promise.',
    );
  });

  it('carries no English-only note, since nothing on it is in another language', () => {
    expect(COPY.en.voyage.englishNote).toBeNull();
  });
});

describe('the roadmap page’s text in Indonesian (#830)', () => {
  it('opens with the intro', () => {
    expect(COPY.id.voyage.intro).toBe(
      'Inilah perkembangan pengerjaan Yawelo Idle, dibaca langsung dari papan pengembangan. Halaman ini diperbarui sendiri saat pekerjaan berjalan, tanpa perlu dimuat ulang.',
    );
  });

  it('says what launch means', () => {
    expect(COPY.id.voyage.launch).toBe(
      'Peluncuran adalah hari ketika Yawelo Idle dibuka untuk semua orang, gratis dimainkan di peramban Anda.',
    );
  });

  it('says how to read the percentage', () => {
    expect(COPY.id.voyage.howToRead).toBe(
      'Persentase ini menghitung cerita yang sudah selesai dari semua cerita yang direncanakan sejauh ini. Satu cerita adalah satu bagian pekerjaan. Cerita baru ditambahkan seiring game berkembang, jadi angkanya bisa turun maupun naik. Poin menunjukkan besarnya pekerjaan yang tersisa: pekerjaan yang lebih besar punya poin lebih banyak. Tanggalnya adalah perkiraan dari laju tujuh hari terakhir, bukan janji.',
    );
  });

  it('notes that ticket titles and island summaries stay English', () => {
    expect(COPY.id.voyage.englishNote).toBe(
      'Judul tiket dan ringkasan pulau di halaman ini tetap dalam bahasa Inggris.',
    );
  });
});
