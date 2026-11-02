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
    afterLaunch: string;
  };
  ship: string;
  built: string;
  left: string;
  nothingYet: string;
  points: string;
  behindTheScenes: string;
  beyond: string;
  other: string;
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
    afterLaunch: 'After launch',
  },
  ship: 'The ship is here',
  built: 'What’s built',
  left: 'What’s left',
  nothingYet: 'Nothing yet.',
  points: '{n} points',
  behindTheScenes: 'plus {n} behind-the-scenes improvements',
  beyond: 'Beyond launch',
  other: 'Other work, on no island: {n} stories and {points} points left',
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
