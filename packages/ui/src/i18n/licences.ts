import type { Licence } from '@yawelo-idle/content';
import type { UiKey } from './catalogue';

/**
 * Each UI string's source and licence (#102 AC3; spec §5.3, D17), judged by
 * the content licence guard. Every string so far was written for the game,
 * so it is original work under CC BY-NC-SA 4.0 (LICENSE-CONTENT.md). The
 * game's name is a reserved trademark either way (TRADEMARKS.md).
 */
const ORIGINAL = { source: 'original', licence: 'CC-BY-NC-SA-4.0' } as const;

export const licences: Readonly<
  Record<UiKey, { readonly source: string; readonly licence: Licence }>
> = {
  'game.name': ORIGINAL,
  'shell.comingSoon': ORIGINAL,
  'shell.next': ORIGINAL,
  'shell.followRoadmap': ORIGINAL,
  'shell.joinLaunchList': ORIGINAL,
};
