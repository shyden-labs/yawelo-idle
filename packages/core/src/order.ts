/**
 * Compares two strings by UTF-16 code unit: the order `Array.prototype.sort()`
 * uses when given no compare function, written out so a reader (and
 * SonarCloud's typescript:S2871, #1007) can see it is meant. Never
 * `localeCompare`: that order changes with the runtime's locale, and a hash or
 * a report must read the same on every machine.
 */
export function byCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
