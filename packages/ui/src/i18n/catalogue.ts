/**
 * The game's UI strings in English and Indonesian (#104; spec §6.3, §8). The
 * English is the source; `id` must hold every key `en` does, so a missing or
 * unknown key fails to compile. Each `id` string's evidence is in
 * ./review.ts, and a string the same in both is allow-listed in
 * ./same-in-both.ts. A `{slot}` is filled by `t` or split out by `parts`.
 */
export const en = {
  'game.name': 'Yawelo Idle',
  'shell.comingSoon': 'Coming soon.',
  'shell.next': '{roadmap} or {launchList}.',
  'shell.followRoadmap': 'Follow the roadmap',
  'shell.joinLaunchList': 'join the launch list',
} as const;

export type UiKey = keyof typeof en;
export type UiLocale = 'en' | 'id';

export const id: Record<UiKey, string> = {
  'game.name': 'Yawelo Idle',
  'shell.comingSoon': 'Segera hadir.',
  'shell.next': '{roadmap} atau {launchList}.',
  'shell.followRoadmap': 'Ikuti peta jalan',
  'shell.joinLaunchList': 'bergabung dengan daftar peluncuran',
};

export const catalogues: Readonly<Record<UiLocale, Record<UiKey, string>>> = {
  en,
  id,
};

/** One piece of a template: plain text, or the name of a slot. */
export type Part = { text: string } | { slot: string };

const SLOT = /\{([A-Za-z]+)\}/g;

/** The `{slot}` names in a template, in order. */
export function slots(template: string): string[] {
  return [...template.matchAll(SLOT)].map((match) => match[1] ?? '');
}

/** The string for `key` in `locale`, each `{slot}` filled from `values`. */
export function t(
  locale: UiLocale,
  key: UiKey,
  values: Readonly<Record<string, string>> = {},
): string {
  return catalogues[locale][key].replace(SLOT, (_, name: string) => {
    const value = values[name];
    if (value === undefined)
      throw new Error(`t: ${key} (${locale}) needs a value for {${name}}`);
    return value;
  });
}

/** The string for `key` in `locale`, split into text and slots. */
export function parts(locale: UiLocale, key: UiKey): Part[] {
  const template = catalogues[locale][key];
  const result: Part[] = [];
  let at = 0;
  for (const match of template.matchAll(SLOT)) {
    if (match.index > at)
      result.push({ text: template.slice(at, match.index) });
    result.push({ slot: match[1] ?? '' });
    at = match.index + match[0].length;
  }
  if (at < template.length) result.push({ text: template.slice(at) });
  return result;
}
