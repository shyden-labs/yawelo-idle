import { fileURLToPath } from 'node:url';
import { devices, type Project } from '@playwright/test';

/**
 * Every target each browser suite runs on (#883 AC1), listed in the design
 * spec §12: the three desktop engines, and a touch phone in each mobile
 * engine (#323 AC13). Every suite runs unchanged on each, so a target carries
 * its name and its device only: never a grep, testIgnore or testMatch.
 */
export const BROWSER_TARGETS: (Project & { name: string })[] = [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'firefox', use: devices['Desktop Firefox'] },
  { name: 'webkit', use: devices['Desktop Safari'] },
  { name: 'chromium-phone', use: devices['Pixel 7'] },
  { name: 'webkit-phone', use: devices['iPhone 14'] },
];

/**
 * The reporter that prints each target's total and fails a run whose totals
 * differ (#883 AC3), by absolute path: the site suite's config is built in
 * tests/site but loaded from the repository root.
 */
export const TARGET_TOTALS_REPORTER = fileURLToPath(
  new URL('target-totals-reporter.ts', import.meta.url),
);
