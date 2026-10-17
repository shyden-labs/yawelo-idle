import { defineConfig } from 'vitest/config';

/**
 * The properties suite (#543): every fast-check property, at its full count.
 * A property drawing more than a primitive cannot hold its count inside the
 * unit suite's 0.1 s of CPU, so each runs here, and the unit suite keeps a
 * stand-in of it on chosen cases (global rule, 2026-10-12). It runs as its
 * own CI step under one measured limit there, and none per test or per hook
 * (#476).
 *
 * Each property runs at its count from before any cut to fit the unit limit,
 * and draws fresh cases on every run (Shyden, 2026-10-12: "revert to
 * original", "don't repeat."). So a property can go red on a pull request
 * that did not touch it: that is a real defect, never a re-run. File it,
 * reproduce it from the seed and path fast-check prints, fix it, and keep
 * the shrunk case as a named stand-in in the unit suite.
 *
 * The setup file picks each file's fresh seed, the suite's one seeding home,
 * so a reach count under its measured minimum names the seed that replays it
 * as a failing property does (#84).
 */
export default defineConfig({
  test: {
    include: ['packages/*/properties/**/*.test.ts'],
    setupFiles: ['tests/properties-setup.ts'],
    testTimeout: 0,
    hookTimeout: 0,
  },
});
