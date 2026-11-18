import { expect } from 'vitest';
import {
  meanRetrievability,
  retrievability,
  type MemoryState,
} from '../src/memory';

/**
 * What FSRS-7's mean retrievability must satisfy at one window (#874 AC3,
 * first #28 AC3). The unit suite checks chosen windows (memory.test.ts) and
 * the properties suite random ones (properties/memory.test.ts, #543),
 * through the same check.
 *
 * R falls with time, so the mean lies between R at the window's ends
 * exactly; the computed values meet that to the accuracy AC3 pins, since
 * over a window of nanoseconds R(from), the mean and R(from + span) agree
 * to an ulp or two.
 */
const ROUNDING = 1e-14;

/** The mean over [from, from + span] lies between R at its end and at its start. */
export function checkMeanBetween(
  state: MemoryState,
  from: number,
  span: number,
): void {
  const mean = meanRetrievability(state, from, span);
  expect(mean).toBeLessThanOrEqual(
    retrievability(state, from) * (1 + ROUNDING),
  );
  expect(mean).toBeGreaterThanOrEqual(
    retrievability(state, from + span) * (1 - ROUNDING),
  );
}
