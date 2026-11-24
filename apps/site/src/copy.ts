/**
 * The scaffold's words, in both languages. The English the operator approved
 * (#334) is read from `COPY_EN`, its one home; the rest are placeholders
 * until the home page is built from that copy (#335), and the Indonesian
 * until it is translated with its D18 evidence (#338). Dev is
 * password-gated until then, and production waits for both (epic #331).
 *
 * The production holding page (#621) shows only `comingSoon`, `tagline`, the
 * 404 lines and `homeLink`. Their Indonesian was read back by Google Cloud
 * Translation and approved by the operator on 2026-10-16
 * (docs/translations/2026-10-16-holding-page-id.md).
 */
import { COPY_EN } from './copy-en';
import type { LegalLocale, LegalPage, Locale, LocalisedPage } from './i18n';

/**
 * The voyage map's labels (#827). Placeholder English, not yet approved by
 * Shyden; his approval, then the Indonesian with its D18 evidence, is #830.
 * Until then both locales carry this English: dev is password-gated and
 * production waits for #830. `{n}` and `{points}` are filled in by the page.
 */
export interface VoyageCopy {
  intro: string;
  /** What "launch" means (#830). */
  launch: string;
  /** How to read the percentage, the points and the date (#830). */
  howToRead: string;
  /**
   * On a page whose board text stays English, a line saying so in the
   * page's language (#830); null where nothing is in another language.
   */
  englishNote: string | null;
  loading: string;
  failed: string;
  islandsLabel: string;
  status: {
    done: string;
    partDone: string;
    notStarted: string;
  };
  ship: string;
  built: string;
  left: string;
  nothingYet: string;
  points: string;
  behindTheScenes: string;
  other: string;
  /** An island whose epic has no Public title yet (#844). */
  unnamedIsland: string;
  unnamedNoMilestone: string;
  /** Whether the page is kept current over the live socket (#829). */
  live: string;
  notLive: string;
  summary: SummaryCopy;
}

/** The roadmap's summary (#828): placeholders until #830's approved copy. */
export interface SummaryCopy {
  heading: string;
  byTickets: string;
  byEffort: string;
  effortUnavailable: string;
  eta: string;
  noEta: string;
  confidence: { high: string; medium: string; low: string };
  measured: string;
  assumedClosed: string;
  left: string;
  island: string;
  stories: string;
  points: string;
  other: string;
  total: string;
  shipped: string;
  nothingShipped: string;
  waiting: string;
  waitingUnnamed: string;
  nothingWaiting: string;
  updated: string;
}

const VOYAGE_PLACEHOLDER: VoyageCopy = {
  intro: COPY_EN.roadmap.intro.text,
  launch: COPY_EN.roadmap.launch.text,
  howToRead: COPY_EN.roadmap.howToRead.text,
  englishNote: null,
  loading: 'Reading the board…',
  failed: 'The roadmap could not be read just now.',
  islandsLabel: 'The voyage to launch',
  status: {
    done: 'Done',
    partDone: 'Part done',
    notStarted: 'Not started',
  },
  ship: 'The ship is here',
  built: 'What’s built',
  left: 'What’s left',
  nothingYet: 'Nothing yet.',
  points: '{n} points',
  behindTheScenes: 'plus {n} behind-the-scenes improvements',
  other: 'Other work, on no island: {n} stories and {points} points left',
  unnamedIsland: 'Milestone {n}',
  unnamedNoMilestone: 'More to come',
  live: 'Live: changes on the board show here as they happen.',
  notLive: 'Not live: this is the board as it was when the page loaded.',
  summary: {
    heading: 'Where the voyage stands',
    byTickets: '{percent}% of stories done ({closed} of {total})',
    byEffort: '{points} points of work left',
    effortUnavailable:
      'Points left: not every story is sized yet ({scored} of {open})',
    eta: 'At the last week’s pace, done around {date} ({confidence} confidence)',
    noEta: 'No date yet: nothing was finished in the last week',
    confidence: { high: 'high', medium: 'medium', low: 'low' },
    measured:
      'Measured: what is done, and the pace of the last 7 days. Assumed: that pace holds, before any outside waits.',
    assumedClosed:
      '{n} finished stories were never sized; each counts as the average, {mean} points.',
    left: 'What’s left, by island',
    island: 'Island',
    stories: 'Stories',
    points: 'Points',
    other: 'Other work',
    total: 'Total',
    shipped: 'Recently shipped',
    nothingShipped: 'Nothing shipped yet.',
    waiting: 'Waiting on decisions',
    waitingUnnamed: '{n} not yet described',
    nothingWaiting: 'Nothing is waiting on a decision.',
    updated: 'Updated {n} s ago',
  },
};

/** The voyage map's words (#1068): `{percent}` and `{year}` are filled by `fill`. */
export interface MapCopy {
  label: string;
  done: string;
  underWay: string;
  notStarted: string;
  brings: string;
  close: string;
  bar: string;
  season1: string;
  season2: string;
  seasonNote: string;
  /** The Indonesian page's note that island names stay English; null in English. */
  islandNamesNote: string | null;
}

export interface Copy {
  /** The language's own name, shown on the switcher that leads to it. */
  languageName: string;
  devStrip: string;
  comingSoon: string;
  /** The hero tagline (#334), shown on the holding page (#621). */
  tagline: string;
  titles: Record<LocalisedPage, string>;
  launchListSoon: string;
  /**
   * The one translated line the English legal page carries for readers of
   * this language when it has no legal text of its own (#925, #928).
   */
  englishOnlyNote: string;
  notFoundTitle: string;
  notFoundBody: string;
  homeLink: string;
  voyage: VoyageCopy;
  support: SupportCopy;
  map: MapCopy;
}

/** The support and ticket pages' own words around ShyDesk's piece (#860). */
export interface SupportCopy {
  intro: string;
  /** Shown when ShyDesk's piece did not load. */
  failed: string;
  ticketIntro: string;
}

export const COPY: Record<Locale, Copy> = {
  en: {
    languageName: 'English',
    devStrip: COPY_EN.devStrip.text,
    comingSoon: COPY_EN.hero.badge.text,
    tagline: COPY_EN.hero.tagline.text,
    titles: {
      home: 'Yawelo Idle',
      roadmap: COPY_EN.roadmap.title.text,
      support: COPY_EN.support.title.text,
      supportTicket: COPY_EN.support.ticketTitle.text,
    },
    launchListSoon: 'The launch list opens soon.',
    englishOnlyNote: 'This page is available in English only.',
    notFoundTitle: COPY_EN.notFound.title.text,
    notFoundBody: COPY_EN.notFound.body.text,
    homeLink: COPY_EN.notFound.home.text,
    voyage: VOYAGE_PLACEHOLDER,
    support: {
      intro: COPY_EN.support.intro.text,
      failed: COPY_EN.support.failed.text,
      ticketIntro: COPY_EN.support.ticketIntro.text,
    },
    map: {
      label: COPY_EN.map.label.text,
      done: COPY_EN.map.done.text,
      underWay: COPY_EN.map.underWay.text,
      notStarted: COPY_EN.map.notStarted.text,
      brings: COPY_EN.map.brings.text,
      close: COPY_EN.map.close.text,
      bar: COPY_EN.map.bar.text,
      season1: COPY_EN.map.season1.text,
      season2: COPY_EN.map.season2.text,
      seasonNote: COPY_EN.map.seasonNote.text,
      islandNamesNote: null,
    },
  },
  id: {
    languageName: 'Bahasa Indonesia',
    // Each line read back by Google Cloud Translation
    // (docs/translations/2026-11-22-roadmap-map-id.md, #1068).
    map: {
      label: 'Pelayaran menuju peluncuran',
      done: 'Selesai',
      underWay: 'Sedang berjalan, {percent}% selesai',
      notStarted: 'Belum dimulai',
      brings: 'Yang dihadirkan tahap ini',
      close: 'Tutup',
      bar: '{percent}% pekerjaan menuju peluncuran sudah selesai',
      season1: 'Perkiraan peluncuran: paruh pertama {year}',
      season2: 'Perkiraan peluncuran: paruh kedua {year}',
      seasonNote:
        'Ini perkiraan, bukan janji. Perkiraan ini bisa berubah selama game dibangun: beberapa bagian memakan waktu lebih lama dari rencana, dan ide dari pemain bisa menambah pekerjaan baru.',
      islandNamesNote: 'Nama pulau di halaman ini tetap dalam bahasa Inggris.',
    },
    // Google read-back 2026-11-12 (#957): "In development: what you see may
    // change, and the released game may be completely different."
    devStrip:
      'Dalam pengembangan: yang Anda lihat bisa berubah, dan game yang dirilis bisa sama sekali berbeda.',
    comingSoon: 'Segera hadir',
    tagline: 'Petualangan idle menjelajahi bahasa sungguhan.',
    titles: {
      home: 'Yawelo Idle',
      roadmap: 'Peta jalan',
      // docs/translations/2026-11-22-support-id.md (#860): Google read-back
      // "Help" and "Your support ticket".
      support: 'Bantuan',
      supportTicket: 'Tiket bantuan Anda',
    },
    launchListSoon: 'Daftar peluncuran segera dibuka.',
    // Google read-back 2026-11-08: "This page is available in English only."
    englishOnlyNote: 'Halaman ini hanya tersedia dalam bahasa Inggris.',
    notFoundTitle: 'Halaman tidak ditemukan',
    notFoundBody: 'Tidak ada halaman di alamat ini.',
    homeLink: 'Kembali ke beranda',
    // The page's own text is Indonesian, each line read back by Google
    // Cloud Translation (docs/translations/2026-11-24-roadmap-words-id.md and
    // docs/translations/2026-11-14-roadmap-id.md, #830). No ticket-titles
    // note: the map shows none, and its own note says island names stay
    // English.
    voyage: {
      ...VOYAGE_PLACEHOLDER,
      intro:
        'Peta ini menunjukkan sejauh mana Yawelo Idle telah berjalan menuju peluncuran. Setiap pulau adalah satu tahap pembuatan game. Ketuk atau klik sebuah pulau untuk melihat apa yang dibawanya.',
      launch:
        'Peluncuran adalah hari ketika Yawelo Idle dibuka untuk semua orang, gratis dimainkan di peramban Anda.',
      howToRead:
        'Bilah ini menunjukkan berapa banyak pekerjaan yang direncanakan sudah selesai. Pekerjaan baru ditambahkan seiring game berkembang, jadi bilahnya bisa mundur maupun maju.',
      englishNote: null,
    },
    // Each line read back by Google Cloud Translation
    // (docs/translations/2026-11-22-support-id.md, #860).
    support: {
      intro:
        'Ajukan pertanyaan atau laporkan masalah tentang Yawelo Idle. Anda dapat menambahkan foto atau video. Balasan dikirim lewat email, beserta tautan kembali ke tiket Anda.',
      failed:
        'Formulir bantuan tidak dapat dimuat. Periksa koneksi Anda, lalu muat ulang halaman ini.',
      ticketIntro:
        'Baca balasan dan tanggapi di sini. Jaga kerahasiaan tautan dari email Anda: siapa pun yang memilikinya dapat membuka tiket ini.',
    },
  },
};

/** One legal page's text in one language. */
export interface LegalText {
  title: string;
  soon: string;
  /** Says, in this text's own language, which text governs for whom (#928 AC2). */
  governs: string;
  /** How the sync server counts requests to stop abuse (#164 AC2). */
  requestCounts: string;
}

/**
 * The legal pages' text, written in English and Indonesian alone (Shyden,
 * 2026-11-08, global rule; #928). It sits outside `COPY`, so no general copy
 * holds legal text. Each Indonesian line is written from the approved English,
 * read back by Google Cloud Translation (tables on #928 and #164); Shyden
 * does not read Indonesian, so nothing waits for his reading (global rule,
 * 2026-11-17).
 */
export const LEGAL: Record<LegalLocale, Record<LegalPage, LegalText>> = {
  en: {
    privacy: {
      title: COPY_EN.privacy.title.text,
      soon: 'The privacy notice will be published here before the launch list opens.',
      governs:
        'For residents of Indonesia, the Indonesian text of this page governs. For everyone else, the English text governs.',
      // Approved by Shyden 2026-11-19 (#164 AC2).
      requestCounts:
        "To stop abuse, the game's server counts requests. Requests made without a device code are counted under a scrambled code made from the network part of the internet address, never the address itself, and each count is deleted the next time the server is used after its time window ends.",
    },
  },
  id: {
    privacy: {
      // Google read-back 2026-11-08: "Privacy"
      title: 'Privasi',
      // Google read-back 2026-11-08: "A privacy notice will be published here before the launch listing opens."
      soon: 'Pemberitahuan privasi akan diterbitkan di sini sebelum daftar peluncuran dibuka.',
      // Google read-back 2026-11-08: "For Indonesian residents, the Indonesian text on this page applies. For everyone else, the English text applies."
      governs:
        'Bagi penduduk Indonesia, yang berlaku adalah teks halaman ini dalam bahasa Indonesia. Bagi semua orang lainnya, yang berlaku adalah teks dalam bahasa Inggris.',
      // Google read-back 2026-11-19: "To prevent abuse, this game server counts requests. Requests without a device code are counted using a pseudonym generated from the network portion of the internet address, never the address itself, and each count is cleared when the server is used again after its count period has expired."
      requestCounts:
        'Untuk mencegah penyalahgunaan, server permainan ini menghitung permintaan. Permintaan tanpa kode perangkat dihitung dengan kode samaran yang dibuat dari bagian jaringan alamat internet, tidak pernah dari alamat itu sendiri, dan setiap hitungan dihapus saat server digunakan lagi setelah periode hitungannya berakhir.',
    },
  },
};
