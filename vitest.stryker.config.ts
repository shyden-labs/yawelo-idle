import { defineConfig } from 'vitest/config';

/**
 * The core mutation run (#36): Stryker (stryker.config.json) drives Vitest
 * over packages/core's unit tests and counts the mutants they kill.
 *
 * It is a non-unit suite, so its one limit is its CI step's and it sets none
 * of its own (#476). Stryker times out a mutant that hangs by its own
 * measure of a normal run and classifies it, which is how a mutation run
 * detects an infinite loop; that is a verdict on the mutant, not a limit on
 * a test.
 *
 * The unit setup (tests/unit/setup.ts) is left out. Its 0.1 s CPU check
 * judges the unit step, and Stryker's instrumented code is slower by
 * design, so the check would fail tests that pass. These same tests run
 * under that setup in the unit step, which is where their limits and their
 * refusals of processes and sockets are held.
 *
 * The properties suite is left out too. Its properties draw fresh cases on
 * every run (#543), so a mutant could be killed on one run and survive the
 * next, and the score would move with no change to the code.
 */
export default defineConfig({
  test: {
    include: ['packages/core/test/**/*.test.ts'],
    testTimeout: 0,
    hookTimeout: 0,
  },
});
