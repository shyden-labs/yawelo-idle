import { readFileSync } from 'node:fs';
import type { JSONReport } from '@playwright/test/reporter';
import { checkOneSuite, testsByTarget } from '@shyden-labs/playwright-devices';
import { desktopGroup } from '@shyden-labs/playwright-devices/desktop';
import { DESKTOP_BROWSERS, type Suite } from '../tests/desktop-targets.ts';

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

const SUITES: readonly Suite[] = ['engines', 'web', 'site'];

const isSuite = (name: string | undefined): name is Suite =>
  name !== undefined && (SUITES as readonly string[]).includes(name);

/** Where main reads, and where it prints. */
export interface Io {
  read: (file: string) => string;
  log: (line: string) => void;
  error: (line: string) => void;
}

/**
 * Checks one suite by its name alone, never a path: the folder is built here,
 * so no argument can point the reads elsewhere (SonarCloud tssecurity:S8707,
 * PR #1054). 0 passes, 1 is a problem found, 2 a wrong argument.
 */
export function main(argv: readonly string[], io: Io): number {
  const [suite] = argv;
  if (argv.length !== 1 || !isSuite(suite)) {
    io.error(
      'usage: node scripts/one-suite-check.ts <suite>, the suite being engines, web or site',
    );
    return 2;
  }
  const { totals, problems } = checkSuite(`one-suite/${suite}`, io.read);
  for (const line of totals) io.log(`one-suite: ${line}`);
  for (const line of problems) io.error(`one-suite: ${line}`);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(
    main(process.argv.slice(2), {
      read: (file) => readFileSync(file, 'utf8'),
      log: (line) => {
        console.log(line);
      },
      error: (line) => {
        console.error(line);
      },
    }),
  );
}
