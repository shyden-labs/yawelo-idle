/**
 * Whether a file's text calls Google Cloud Translation (#638 AC1): it names
 * the API's host, in any case, or Google's client library. Needles are built
 * from parts, so this file is not one.
 */
const NEEDLES = [
  ['translation', 'googleapis', 'com'].join('.'),
  ['@google-cloud', 'translate'].join('/'),
];

export function googleCallsIn(text: string): boolean {
  const lower = text.toLowerCase();
  return NEEDLES.some((needle) => lower.includes(needle));
}
