import { expect } from 'vitest';
import { runOf } from './workflow-steps';

/** The one command that installs Edge, the browser Playwright's image lacks. */
export const EDGE_INSTALL = 'npx playwright install --with-deps msedge';

interface Step {
  run?: unknown;
  'timeout-minutes'?: unknown;
}

interface Job {
  container?: { image?: string; options?: string };
  steps?: Step[];
}

/**
 * A job that runs a browser suite installs Edge once, before the suite, as
 * root, inside one limit (#1003). Playwright's image carries Chromium, Firefox
 * and WebKit only (its v1.65.1 Dockerfile.noble), and Edge's installer needs
 * root, so the job sets no `--user` (Shyden, 2026-11-20: download Edge each run).
 */
export function expectEdgeInstalledBefore(job: Job | undefined, suite: string): void {
  expect(job?.container?.options, 'the job runs as root').toBeUndefined();
  const steps = job?.steps ?? [];
  const runs = steps.map((s) => runOf(s));
  expect(runs.filter((run) => /playwright install/.test(run))).toEqual([EDGE_INSTALL]);
  const install = runs.indexOf(EDGE_INSTALL);
  expect(install, 'Edge is installed before the suite').toBeLessThan(runs.indexOf(suite));
  expect(steps[install]?.['timeout-minutes'], 'one limit on the install').toEqual(
    expect.any(Number),
  );
}
