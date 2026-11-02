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
import type { Locale, Page } from './i18n';

/**
 * The voyage map's labels (#827). Placeholder English, not yet approved by
 * Shyden; his approval, then the Indonesian with its D18 evidence, is #830.
 * Until then both locales carry this English: dev is password-gated and
 * production waits for #830. `{n}` and `{points}` are filled in by the page.
 */
export interface VoyageCopy {
  intro: string;
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

export interface Copy {
  /** The language's own name, shown on the switcher that leads to it. */
  languageName: string;
  devStrip: string;
  comingSoon: string;
  /** The hero tagline (#334), shown on the holding page (#621). */
  tagline: string;
  titles: Record<Page, string>;
  launchListSoon: string;
  privacySoon: string;
  notFoundTitle: string;
  notFoundBody: string;
  homeLink: string;
  voyage: VoyageCopy;
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
      privacy: COPY_EN.privacy.title.text,
    },
    launchListSoon: 'The launch list opens soon.',
    privacySoon:
      'The privacy notice will be published here before the launch list opens.',
    notFoundTitle: COPY_EN.notFound.title.text,
    notFoundBody: COPY_EN.notFound.body.text,
    homeLink: COPY_EN.notFound.home.text,
    voyage: VOYAGE_PLACEHOLDER,
  },
  id: {
    languageName: 'Bahasa Indonesia',
    devStrip:
      'Dalam pengembangan: yang Anda lihat bisa berubah, dan game yang dirilis bisa sangat berbeda.',
    comingSoon: 'Segera hadir',
    tagline: 'Petualangan idle menjelajahi bahasa sungguhan.',
    titles: { home: 'Yawelo Idle', roadmap: 'Peta jalan', privacy: 'Privasi' },
    launchListSoon: 'Daftar peluncuran segera dibuka.',
    privacySoon:
      'Pemberitahuan privasi akan diterbitkan di sini sebelum daftar peluncuran dibuka.',
    notFoundTitle: 'Halaman tidak ditemukan',
    notFoundBody: 'Tidak ada halaman di alamat ini.',
    homeLink: 'Kembali ke beranda',
    // English until #830 translates it with its D18 evidence.
    voyage: VOYAGE_PLACEHOLDER,
  },
};
