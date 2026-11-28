/**
 * The roadmap page's carried board (#1104 AC1): the element the site Worker
 * writes the held snapshot into at request time, and the map reads on mount.
 */
export const CARRIED_ID = 'roadmap-snapshot';

/**
 * The snapshot as the element's text: JSON with every `<` written `<`
 * (still the same JSON), so no title can end the script or open a comment.
 */
export function carriedText(snapshot: unknown): string {
  return JSON.stringify(snapshot).replaceAll('<', '\\u003c');
}
