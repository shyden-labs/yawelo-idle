import type { PlaywrightTestConfig } from '@playwright/test';
import { desktopProjects } from '@shyden-labs/playwright-devices/desktop';

/**
 * The desktop browsers every browser suite runs on (#883, #1003), listed in
 * the design spec §12. Their setup and the one-suite checks are
 * shyden-labs/playwright-devices', shared by every project; Yawelo names only
 * which of its browsers it runs. Edge is downloaded at the start of each CI
 * run, since Playwright's image lacks it (Shyden, 2026-11-20). Phones and
 * tablets are their own group, run on the real devices and their simulators.
 */
export const DESKTOP_BROWSERS = [
  'chromium',
  'firefox',
  'webkit',
  'msedge',
] as const;

/** Where each suite's run leaves what the shared check reads. */
export type Suite = 'engines' | 'web' | 'site';

/**
 * A suite's desktop projects, unfiltered, and the reporters whose output the
 * shared check reads (scripts/browser-suite.sh): Playwright's JSON report and
 * each test's assertion count per browser.
 */
export function desktopSuite(
  suite: Suite,
): Required<Pick<PlaywrightTestConfig, 'projects' | 'reporter'>> {
  return {
    projects: desktopProjects(DESKTOP_BROWSERS),
    reporter: [
      ['list'],
      ['json', { outputFile: `one-suite/${suite}/report.json` }],
      [
        '@shyden-labs/playwright-devices/assertion-counter',
        {
          outputFile: `one-suite/${suite}/assertions.json`,
          unnamedTarget: 'desktop',
        },
      ],
    ],
  };
}
