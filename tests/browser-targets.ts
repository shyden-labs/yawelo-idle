import { fileURLToPath } from 'node:url';
import { devices, type Project } from '@playwright/test';

/**
 * The two device groups (Shyden, 2026-11-17, #996): phones and tablets, and
 * desktop browsers. Every target in a group runs the identical set. A test
 * runs in one group only when tagged `@phone` or `@desktop` with a
 * `group-only` annotation naming the input or feature that differs; an
 * untagged test runs on every target.
 */
export type DeviceGroup = 'phone' | 'desktop';

/** A desktop target runs untagged and `@desktop` tests, never `@phone` ones. */
const DESKTOP = {
  metadata: { group: 'desktop' as const },
  grepInvert: /@phone\b/,
};

/**
 * Every target each browser suite runs on (#883 AC1), listed in the design
 * spec §12: the three desktop engines. No desktop browser emulates a phone
 * (Shyden, 2026-11-17, #995): phones and tablets are the real devices and
 * their simulators and emulators. Every suite runs unchanged on each, so a
 * target carries its name, its device and its group's filter only: never
 * another grep, testIgnore or testMatch.
 */
export const BROWSER_TARGETS: (Project & {
  name: string;
  metadata: { group: DeviceGroup };
})[] = [
  { name: 'chromium', use: devices['Desktop Chrome'], ...DESKTOP },
  { name: 'firefox', use: devices['Desktop Firefox'], ...DESKTOP },
  { name: 'webkit', use: devices['Desktop Safari'], ...DESKTOP },
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
