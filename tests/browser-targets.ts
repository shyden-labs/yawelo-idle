import { fileURLToPath } from 'node:url';
import { devices, type Project } from '@playwright/test';

/**
 * Every target each browser suite runs on (#883 AC1), listed in the design
 * spec §12: the three desktop engines. No desktop browser emulates a phone
 * (Shyden, 2026-11-17, #995): phones and tablets are the real devices and
 * their simulators and emulators. Every suite runs unchanged on each, so a
 * target carries its name and its device only: never a grep, testIgnore or
 * testMatch.
 */
export const BROWSER_TARGETS: (Project & { name: string })[] = [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'firefox', use: devices['Desktop Firefox'] },
  { name: 'webkit', use: devices['Desktop Safari'] },
];

/**
 * The reporter that prints each target's total and fails a run whose totals
 * differ (#883 AC3), by absolute path: the site suite's config is built in
 * tests/site but loaded from the repository root.
 */
export const TARGET_TOTALS_REPORTER = fileURLToPath(
  new URL('target-totals-reporter.ts', import.meta.url),
);

/** Prints each test's count of assertions made in the run (#933 AC6). */
export const ASSERTION_COUNTS_REPORTER = fileURLToPath(
  new URL('assertion-counts-reporter.ts', import.meta.url),
);
