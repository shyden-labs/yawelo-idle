import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import config from '../../playwright.engines.config';
import { desktopProjects } from '@shyden-labs/playwright-devices/desktop';
import { runOf } from './workflow-steps';
import { DESKTOP_BROWSERS } from '../desktop-targets';
import { expectEdgeInstalledBefore } from './edge-install';

/**
 * The cross-engine check stays wired (#26 AC10). A Playwright project dropped
 * from the config, or a CI step removed, would let the check pass by not
 * running; this suite fails instead. The workflow is read as parsed YAML, so
 * a comment naming a command cannot stand in for the step.
 */

interface Step {
  name?: string;
  // YAML may type it otherwise: read it through runOf.
  run?: unknown;
}

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
  jobs: Record<
    string,
    { container?: { image?: string; options?: string }; steps: Step[] }
  >;
};

describe('the cross-engine harness', () => {
  it('runs on every desktop browser (#883, #1003)', () => {
    expect(config.projects).toEqual(desktopProjects(DESKTOP_BROWSERS));
  });

  it('runs in CI’s browsers job, in the Playwright image, with Edge installed first (#44, #1003)', () => {
    const job = ci.jobs['browsers'];
    expect(job?.container?.image ?? '', 'the job’s image').toBe(
      ci.jobs['build-and-test']?.container?.image,
    );
    expect(job?.container?.image ?? '').toMatch(
      /^mcr\.microsoft\.com\/playwright:v/,
    );
    const steps = job?.steps ?? [];
    expect(
      steps.filter((s) => runOf(s) === 'npm run test:engines'),
      'test:engines step',
    ).toHaveLength(1);
    expectEdgeInstalledBefore(job, 'npm run test:engines');
  });

  it('leaves build-and-test, which runs as the runner’s user and installs nothing', () => {
    const steps = ci.jobs['build-and-test']?.steps ?? [];
    const runs = steps.map((s) => runOf(s));
    expect(
      runs.filter((r) => /test:engines|test:web|playwright install/.test(r)),
    ).toEqual([]);
    expect(ci.jobs['build-and-test']?.container?.options).toBe('--user 1001');
  });

  it('is what npm run test:engines runs', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:engines']).toBe(
      'scripts/browser-suite.sh engines playwright.engines.config.ts',
    );
  });
});
