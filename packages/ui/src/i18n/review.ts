import type { Review } from '@yawelo-idle/content';
import type { UiKey } from './catalogue';

/**
 * Each Indonesian UI string's review block (#104 AC4, AC6), #51's shape and
 * evidence rule: two sources, a Google back-translation, and a label audit
 * for text of three words or fewer. The English is the source text.
 */
const AT = '2026-11-14T06:25:00Z';

/** A block Claude checked on 2026-11-14 (docs/translations/2026-11-14-ui-catalogue-id.md). */
const checked = (
  sources: readonly string[],
  backTranslation: string,
  labelAudit: string | null,
  notes: string,
): Review => ({
  status: 'claude-checked',
  reviewer: 'claude',
  reviewedAt: AT,
  notes,
  sources: [...sources],
  backTranslation,
  labelAudit,
  history: [{ at: AT, by: 'claude', change: 'Drafted and checked (#104).' }],
});

export const review: Readonly<Record<UiKey, Review>> = {
  'game.name': checked(
    ['operator:do-not-translate', 'site-copy:titles.home'],
    'Yawelo Idle',
    'The game’s name: never translated, and the site’s Indonesian title already uses it unchanged.',
    'A name, the same in both languages (same-in-both.ts).',
  ),
  'shell.comingSoon': checked(
    ['kbbi:segera', 'kbbi:hadir', 'site-copy:comingSoon'],
    'Coming soon.',
    '“Segera hadir” is the usual Indonesian “coming soon” on a page; the site and the holding page already ship it, approved by Shyden 2026-10-16 (#621).',
    'KBBI: segera “lekas, cepat”; hadir “ada, datang”.',
  ),
  'shell.next': checked(
    ['kbbi:atau', 'wiktionary:atau'],
    '{roadmap} or {launchList} .',
    'Only “atau” (or) is text; the two slots are the links, each checked as its own key. Google spaced the full stop; the text has none.',
    'KBBI: atau “kata penghubung untuk menandai pilihan”.',
  ),
  'shell.followRoadmap': checked(
    ['kbbi:ikut', 'kbbi:peta-jalan', 'site-copy:titles.roadmap'],
    'Follow the road map',
    'A link label opening the roadmap page, whose Indonesian title is already “Peta jalan”; “Ikuti” is the imperative of mengikuti, as in “Ikuti kami”.',
    'KBBI: peta jalan “peta panduan”; ikut “melakukan sesuatu sebagaimana dikerjakan orang lain”.',
  ),
  'shell.joinLaunchList': checked(
    [
      'kbbi:bergabung',
      'kbbi:daftar',
      'kbbi:peluncuran',
      'site-copy:privacy.soon',
    ],
    'join the launch list',
    null,
    'Lower case: it follows “atau” mid-sentence. “Daftar peluncuran” is the site’s shipped term for the launch list.',
  ),
};
