import { expect } from 'vitest';
import { meanRetrievability, retrievability } from '../src/memory';

/**
 * What FSRS-6's mean retrievability must satisfy at one window (#28 AC3).
 * The unit suite checks chosen windows (memory.test.ts) and the properties
 * suite random ones (properties/memory.test.ts, #543), through the same
 * check.
 *
 * The mean lies between R at the window's ends exactly; the computed values
 * meet that to the accuracy AC3 pins, since over a window of nanoseconds
 * R(from), the mean and R(from + span) agree to an ulp or two.
 */
const ROUNDING = 1e-14;

/** The mean over [from, from + span] lies between R at its end and at its start. */
export function checkMeanBetween(s: number, from: number, span: number): void {
  const mean = meanRetrievability(s, from, span);
  expect(mean).toBeLessThanOrEqual(retrievability(s, from) * (1 + ROUNDING));
  expect(mean).toBeGreaterThanOrEqual(
    retrievability(s, from + span) * (1 - ROUNDING),
  );
}
