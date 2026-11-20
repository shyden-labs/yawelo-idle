import { readFileSync } from 'node:fs';
import type { JSONReport } from '@playwright/test/reporter';
import { checkOneSuite, testsByTarget } from '@shyden-labs/playwright-devices';
import { desktopGroup } from '@shyden-labs/playwright-devices/desktop';
import { DESKTOP_BROWSERS } from '../tests/desktop-targets.ts';

/**
 * The shared one-suite check on one suite's run (#1003): every desktop
 * browser ran every listed test, with nothing skipped, failed or flaky, the
 * same assertions on each, and a group-only test tagged with its reason.
 * scripts/browser-suite.sh leaves in <dir> what Playwright listed
 * (list.json), what it ran (report.json) and each test's assertion count
 * (assertions.json).
 */
export function checkSuite(
  dir: string,
  read: (file: string) => string,
): { totals: string[]; problems: string[] } {
  const json = (name: string): unknown => {
    const file = `${dir}/${name}`;
    try {
      return JSON.parse(read(file));
    } catch (error) {
      throw new Error(`cannot read ${file}: ${String(error)}`, {
        cause: error,
      });
    }
  };
  return checkOneSuite({
    listed: testsByTarget(json('list.json') as JSONReport, 'desktop'),
    ran: testsByTarget(json('report.json') as JSONReport, 'desktop'),
    groups: desktopGroup(DESKTOP_BROWSERS),
    assertions: json('assertions.json') as Record<
      string,
      Record<string, number>
    >,
  });
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (dir === undefined) {
    console.error('usage: node scripts/one-suite-check.ts <dir>');
    process.exit(2);
  }
  const { totals, problems } = checkSuite(dir, (file) =>
    readFileSync(file, 'utf8'),
  );
  for (const line of totals) console.log(`one-suite: ${line}`);
  for (const line of problems) console.error(`one-suite: ${line}`);
  process.exit(problems.length === 0 ? 0 : 1);
}
