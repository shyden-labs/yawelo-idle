import { expect } from 'vitest';
import { runOf } from './workflow-steps';

/**
 * As root, git refuses a workspace the runner's own user checked out ("not in
 * a git directory", PR #1054's first run), and npm ci's `prepare` runs git.
 */
export const SAFE_WORKSPACE =
  'git config --global --add safe.directory "$GITHUB_WORKSPACE"';

/** The one command that installs Edge, the browser Playwright's image lacks. */
export const EDGE_INSTALL = 'npx --no playwright install --with-deps msedge';

/**
 * The browsers job's form (#1136): no `--with-deps`. In run 45770365466 that
 * flag's `apt-get update` fetched 34.2 MB of Ubuntu lists and then installed
 * nothing, every package being "already the newest version" in Playwright's
 * image, so a mirror outage could fail the job for no package at all.
 */
export const EDGE_INSTALL_NO_DEPS = 'npx --no playwright install msedge';

interface Step {
  run?: unknown;
  'timeout-minutes'?: unknown;
}

interface Job {
  container?: { image?: string; options?: string };
  env?: Record<string, unknown>;
  steps?: Step[];
}

/**
 * A job that runs a browser suite installs Edge once, before the suite, as
 * root, inside one limit (#1003). Playwright's image carries Chromium, Firefox
 * and WebKit only (its v1.65.1 Dockerfile.noble), and Edge's installer needs
 * root, so the job sets no `--user`. Its download is cached between runs
 * (#1092, tests/unit/edge-install-ci.test.ts), so the step runs the command
 * inside a timeout that names a stalled download.
 */
export function expectEdgeInstalledBefore(
  job: Job | undefined,
  suite: string,
  command: string = EDGE_INSTALL,
): void {
  expect(job?.container?.options, 'the job runs as root').toBeUndefined();
  // Firefox refuses to start as root in a home another user owns (PR #1054's
  // second run): Playwright's own advice is HOME=/root.
  expect(job?.env?.['HOME'], 'root runs with its own home').toBe('/root');
  const steps = job?.steps ?? [];
  const runs = steps.map((s) => runOf(s));
  const installs = runs.flatMap((run, i) =>
    /playwright install/.test(run) ? [i] : [],
  );
  expect(installs, 'one step installs a browser').toHaveLength(1);
  const install = installs[0] ?? -1;
  expect(
    runs[install]?.split('\n').filter((line) => line.includes(command)),
    'and it runs the Edge install once',
  ).toHaveLength(1);
  const safe = runs.indexOf(SAFE_WORKSPACE);
  expect(safe, 'the workspace is marked safe for root').toBeGreaterThan(-1);
  expect(safe, 'before the install runs git').toBeLessThan(
    runs.findIndex((run) => /npm ci$/.test(run)),
  );
  expect(install, 'Edge is installed before the suite').toBeLessThan(
    runs.indexOf(suite),
  );
  expect(
    steps[install]?.['timeout-minutes'],
    'one limit on the install',
  ).toEqual(expect.any(Number));
}
