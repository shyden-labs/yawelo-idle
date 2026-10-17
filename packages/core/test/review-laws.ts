import { expect } from 'vitest';
import { wallMs, type WallMs } from '../src/clock';
import { newWordMemory, RANKS, rankForStability, review } from '../src/memory';

/**
 * What a review history must satisfy at every step (#28 AC5). The unit suite
 * checks chosen histories (review.test.ts) and the properties suite random
 * ones (properties/review.test.ts, #543), through the same check.
 */

export const T0: WallMs = wallMs(Date.UTC(2027, 0, 4, 9));

export interface ReviewStep {
  readonly correct: boolean;
  /** How long after the word fell due it is answered. */
  readonly lateMs: number;
}

/**
 * Reviews a new word through `steps`: a correct answer never lowers its rank
 * and lifts it to the rank its stability earns, a wrong one drops it one
 * rank. Returns how many correct steps were checked.
 */
export function checkHistory(steps: readonly ReviewStep[]): number {
  let correctSteps = 0;
  let w = newWordMemory(T0);
  // one scenario: each step reviews the word the step before left.
  for (const step of steps) {
    const now = wallMs(w.card.due + step.lateMs);
    const next = review(w, now, step.correct);
    const before = RANKS.indexOf(w.rank);
    const after = RANKS.indexOf(next.rank);
    if (step.correct) {
      correctSteps++;
      expect(after).toBeGreaterThanOrEqual(before);
      expect(after).toBe(
        Math.max(before, RANKS.indexOf(rankForStability(next.card.stability))),
      );
    } else {
      expect(after).toBe(Math.max(before - 1, 0));
    }
    w = next;
  }
  return correctSteps;
}
