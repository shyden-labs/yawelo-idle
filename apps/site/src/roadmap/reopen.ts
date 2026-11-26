/**
 * How long the roadmap page waits before reopening a dropped live socket
 * (#1104 AC3): 1 s after the first drop, twice as long after each try that
 * drops before it opens, never more than a minute. A socket that opens starts
 * the count again. No tight loop: every try waits at least the first delay.
 */
export const REOPEN_FIRST_MS = 1_000;
export const REOPEN_MAX_MS = 60_000;

/** The wait before try `attempt` (0 for the first reopening). */
export function reopenDelay(attempt: number): number {
  return Math.min(REOPEN_FIRST_MS * 2 ** attempt, REOPEN_MAX_MS);
}
