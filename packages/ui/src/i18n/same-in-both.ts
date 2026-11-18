import type { UiKey } from './catalogue';

/**
 * The keys whose Indonesian is the same as the English on purpose (#104 AC2),
 * each with its reason. Any other identical pair fails the catalogue's test.
 */
export const sameInBoth: Readonly<Partial<Record<UiKey, string>>> = {
  'game.name': 'The game’s name, never translated (DO_NOT_TRANSLATE).',
};
