import { defineConfig } from 'vitest/config';

/**
 * The logs suite (#84, spec §5.12): the checks of the code that writes,
 * keeps or replays the game's logs and audit trails, at their full sizes.
 * Shyden, 2026-10-16: "separate test suite for logging and auditing. run in
 * ci as a pre-requisite to a release". It runs in CI before a release
 * (.github/workflows/logs.yml), never on a pull request; the unit suite
 * keeps stand-ins of each check on chosen cases.
 *
 * Its properties draw fresh cases from the properties suite's one seeding
 * home, so a reach count under its measured minimum names the seed that
 * replays it. It keeps one measured limit, at its CI step, and none per test
 * or per hook (#476).
 */
export default defineConfig({
  test: {
    include: ['packages/*/logs/**/*.test.ts'],
    setupFiles: ['tests/properties-setup.ts'],
    testTimeout: 0,
    hookTimeout: 0,
  },
});
