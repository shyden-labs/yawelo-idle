/**
 * What each stage of the voyage brings (#1068 AC5), approved by Shyden on
 * 2026-11-22 (comment on #1068; option 1 of the island-features gallery).
 * Shipyard (M0) and The engine (M1) share one line. Indonesian with Google
 * Cloud Translation read-back: docs/translations/2026-11-22-roadmap-map-id.md.
 */
import type { Locale } from '../i18n';

export type Milestone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const BEHIND_EN =
  'Behind the scenes: the tools and the game engine everything else is built on.';
const BEHIND_ID =
  'Di balik layar: alat-alat dan mesin game yang menjadi dasar semua bagian lainnya.';

export const FEATURES: Record<Locale, Record<Milestone, readonly string[]>> = {
  en: {
    0: [BEHIND_EN],
    1: [BEHIND_EN],
    2: ['Learn real words while you play'],
    3: [
      'A cosy idle game to come back to',
      'Words that stick',
      'Journeys and culture',
      'Music and sound',
      'Play your way',
    ],
    4: ['Never lose your progress'],
    5: ['Leaderboards and friends'],
    6: [
      'More of the world',
      'Grammar, achievements and the finale',
      'Free to play in your browser',
    ],
    7: ['Desktop and phone apps'],
    8: ['In the stores'],
  },
  id: {
    0: [BEHIND_ID],
    1: [BEHIND_ID],
    2: ['Pelajari kata-kata sungguhan sambil bermain'],
    3: [
      'Game idle yang nyaman untuk dikunjungi lagi dan lagi',
      'Kata-kata yang melekat di ingatan',
      'Perjalanan dan budaya',
      'Musik dan suara',
      'Bermain sesuai cara Anda',
    ],
    4: ['Progres Anda tidak akan pernah hilang'],
    5: ['Papan peringkat dan teman'],
    6: [
      'Lebih banyak bagian dunia',
      'Tata bahasa, pencapaian, dan babak akhir',
      'Gratis dimainkan di peramban Anda',
    ],
    7: ['Aplikasi desktop dan ponsel'],
    8: ['Tersedia di toko aplikasi'],
  },
};
