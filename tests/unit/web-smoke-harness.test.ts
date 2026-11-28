import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { webSmokeConfig } from '../../playwright.web.config';
import { siteSmokeConfig } from '../site/smoke-config';
import { desktopProjects } from '@shyden-labs/playwright-devices/desktop';
import { runOf } from './workflow-steps';
import { DESKTOP_BROWSERS } from '../desktop-targets';
import { expectEdgeInstalledBefore } from './edge-install';

/**
 * The web smoke suite stays wired (#123 AC3), locally and against dev (#123
 * DoD: "the journey re-run against dev"). A Playwright project dropped from
 * the config, a server that is not the built game, a retry, or a CI step
 * removed would let the suite pass by not running what it claims; this fails
 * instead. The workflows are read as parsed YAML, so a comment naming the
 * command cannot stand in for the step. The build-and-test job's Playwright
 * image is held by tests/unit/cross-engine-harness.test.ts.
 */

interface Step {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  with?: Record<string, unknown>;
  // YAML may type it otherwise: read it through runOf.
  run?: unknown;
  env?: Record<string, unknown>;
}

interface Job {
  needs?: string | string[];
  container?: { image?: string; options?: string };
  environment?: unknown;
  // A reusable-workflow call (`uses:`) has no steps of its own.
  steps?: Step[];
}

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as {
  jobs: Record<string, Job>;
};
const deployDev = parse(
  readFileSync('.github/workflows/deploy-dev.yml', 'utf8'),
) as { jobs: Record<string, Job> };

/** The suite as `npm run test:web` runs it: no dev URL in the environment. */
const local = () => webSmokeConfig({});
/** The suite as deploy-dev runs it against dev. */
const DEV_URL = 'https://dev.yaweloidle.com/';
const dev = () =>
  webSmokeConfig({
    WEB_SMOKE_URL: DEV_URL,
    DEV_PASS: 'the machine pass',
  });

/**
 * The DEV pass as the door reads it on a page and on its embed route: the
 * `__Host-devpass` cookie, host-only on the door (#1078 AC1, shyden.co.uk's
 * reading of the door, 2026-11-27). Never a header: Playwright would send an
 * extra header to every host a page reaches, outside services included.
 */
const passCookie = (domain: string) => ({
  cookies: [
    {
      name: '__Host-devpass',
      value: 'the machine pass',
      domain,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ],
  origins: [],
});

const needsOf = (job: Job | undefined): string[] =>
  job?.needs === undefined
    ? []
    : Array.isArray(job.needs)
      ? job.needs
      : [job.needs];

/** The deploy-dev jobs with a step that runs `run`, by name. */
const jobsRunning = (run: string): [string, Job][] =>
  Object.entries(deployDev.jobs).filter(([, job]) =>
    (job.steps ?? []).some((step) => runOf(step) === run),
  );

describe('the web smoke suite (#123 AC3)', () => {
  it('runs on every desktop browser (#883, #1003)', () => {
    expect(local().projects).toEqual(desktopProjects(DESKTOP_BROWSERS));
  });

  it('loads the built game from its own Worker config, started fresh', () => {
    const { webServer } = local();
    const server = Array.isArray(webServer) ? undefined : webServer;
    expect(server?.command).toMatch(
      /^npx wrangler dev --config apps\/web\/wrangler\.jsonc --ip 127\.0\.0\.1 --port \d+$/,
    );
    expect(server?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/play\/$/);
    expect(server?.reuseExistingServer).toBe(false);
    expect(local().use?.baseURL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(local().use?.httpCredentials).toBeUndefined();
  });

  it('retries nothing and refuses a focused test', () => {
    expect(local().retries).toBe(0);
    expect(local().forbidOnly).toBe(true);
  });

  it('builds the game, then runs the suite, as npm run test:web', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:web']).toBe(
      'npm run build --workspace @yawelo-idle/web && scripts/browser-suite.sh web playwright.web.config.ts',
    );
  });

  it('runs in CI’s browsers job, once, after the cross-engine check', () => {
    const steps = ci.jobs['browsers']?.steps ?? [];
    const runs = steps.map((s) => runOf(s));
    expect(runs.filter((run) => run === 'npm run test:web')).toHaveLength(1);
    expect(runs.indexOf('npm run test:web')).toBe(
      runs.indexOf('npm run test:engines') + 1,
    );
  });
});

describe('the web smoke suite against dev (#123 DoD)', () => {
  it('targets the address it is given, sends no password, and starts no server: the door is the gate (#1078 AC3)', () => {
    expect(dev().use?.baseURL).toBe(DEV_URL);
    expect(dev().use?.httpCredentials).toBeUndefined();
    expect(dev().webServer).toBeUndefined();
  });

  it('carries the DEV pass as a cookie on the door it tests, and in no header (#1078 AC1)', () => {
    expect(dev().use?.storageState).toEqual(passCookie('dev.yaweloidle.com'));
    expect(dev().use?.extraHTTPHeaders).toBeUndefined();
  });

  it('refuses a dev address without a DEV pass (#1078 AC1)', () => {
    expect(() => webSmokeConfig({ WEB_SMOKE_URL: DEV_URL })).toThrow(
      /WEB_SMOKE_URL is set but DEV_PASS is not/,
    );
  });

  it('runs on every desktop browser (#883, #1003), retrying nothing', () => {
    expect(dev().projects).toEqual(desktopProjects(DESKTOP_BROWSERS));
    expect(dev().retries).toBe(0);
    expect(dev().forbidOnly).toBe(true);
  });

  it('is npm run test:web:dev, which builds nothing: dev already serves the build', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:web:dev']).toBe(
      'scripts/browser-suite.sh web playwright.web.config.ts',
    );
  });

  it('runs once in deploy-dev, after verify, in CI’s Playwright image, with no password (#1078 AC3)', () => {
    const running = jobsRunning('npm run test:web:dev');
    expect(running.map(([name]) => name)).toEqual(['smoke']);
    const job = deployDev.jobs['smoke'];
    expect(needsOf(job)).toEqual(['verify']);
    expect(job?.container?.image).toBe(
      ci.jobs['build-and-test']?.container?.image,
    );
    expect(job?.environment).toEqual(deployDev.jobs['verify']?.environment);
    expect(job?.environment).toMatchObject({ name: 'dev' });
    const steps = job?.steps ?? [];
    const smoke = steps.filter((s) => runOf(s) === 'npm run test:web:dev');
    expect(smoke).toHaveLength(1);
    expect(smoke[0]?.env).toEqual({ WEB_SMOKE_URL: DEV_URL });
    expectEdgeInstalledBefore(job, 'npm run test:web:dev');
  });

  it('posts dev-verified only once the dev smoke, the site suite (#827), the holding page’s dev copy (#621) and the roadmap (#708) have passed', () => {
    const posting = Object.entries(deployDev.jobs).filter(([, job]) =>
      (job.steps ?? []).some((step) =>
        /context=dev-verified\b/.test(runOf(step)),
      ),
    );
    expect(posting.map(([name]) => name)).toEqual(['dev-verified']);
    expect(needsOf(deployDev.jobs['dev-verified'])).toEqual([
      'smoke',
      'site-smoke',
      'verify-holding',
      'verify-roadmap',
    ]);
  });

  it('keeps a screenshot of each failing test (#888)', () => {
    expect(dev().use?.screenshot).toBe('only-on-failure');
  });

  // A trace records each request's headers, the dev password's
  // Authorization among them, and test-results is uploaded to a public
  // repository's run (#888).
  it('records no trace and no video against dev, which would carry the dev password', () => {
    expect(dev().use?.trace).toBe('off');
    expect(dev().use?.video).toBe('off');
  });

  it('uploads test-results when the dev smoke itself fails, and only then (#888)', () => {
    const steps = deployDev.jobs['smoke']?.steps ?? [];
    const suiteAt = steps.findIndex((s) => runOf(s) === 'npm run test:web:dev');
    const suite = steps[suiteAt];
    expect(suite?.id).toBe('suite');
    const uploads = steps.filter((s) =>
      (s.uses ?? '').startsWith('actions/upload-artifact@'),
    );
    expect(uploads).toHaveLength(1);
    const upload = uploads[0];
    expect(steps.indexOf(upload as Step)).toBe(suiteAt + 1);
    expect(upload?.if).toBe(
      "${{ failure() && steps.suite.outcome == 'failure' }}",
    );
    expect(upload?.with).toEqual({
      name: 'smoke-failures',
      path: 'test-results/',
      'retention-days': 14,
      'if-no-files-found': 'error',
    });
  });

  it('pins the dev smoke upload action to the commit ci.yml pins', () => {
    const pinned = (job: Job | undefined) =>
      (job?.steps ?? [])
        .map((s) => s.uses ?? '')
        .filter((u) => u.startsWith('actions/upload-artifact@'));
    const ciPins = Object.values(ci.jobs).flatMap(pinned);
    expect(ciPins.length).toBeGreaterThan(0);
    expect(pinned(deployDev.jobs['smoke'])).toEqual([ciPins[0]]);
  });
});

const SITE_URL =
  'https://yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev/';
const site = () =>
  siteSmokeConfig({
    SITE_SMOKE_URL: SITE_URL,
    DEV_BASIC_AUTH_PASSWORD: 'the dev password',
    DEV_PASS: 'the machine pass',
  });

describe('the site suite against dev (#827)', () => {
  it('carries the DEV pass as a cookie on the site’s dev door, where the support pages load ShyDesk, and in no header (#1078 AC1)', () => {
    expect(site().use?.storageState).toEqual(passCookie('dev.yaweloidle.com'));
    expect(site().use?.extraHTTPHeaders).toBeUndefined();
  });

  it('refuses a dev address without a DEV pass (#1078 AC1)', () => {
    expect(() =>
      siteSmokeConfig({
        SITE_SMOKE_URL: SITE_URL,
        DEV_BASIC_AUTH_PASSWORD: 'the dev password',
      }),
    ).toThrow(/SITE_SMOKE_URL is set but DEV_PASS is not/);
  });

  it('targets the address it is given and answers its password challenge', () => {
    expect(site().use?.baseURL).toBe(SITE_URL);
    expect(site().use?.httpCredentials).toEqual({
      username: 'site-smoke',
      password: 'the dev password',
    });
    expect(site().webServer).toBeUndefined();
  });

  it('runs the specs in tests/site', () => {
    expect(site().testDir).toBe('tests/site');
  });

  it('refuses to run with no address: it runs against dev only', () => {
    expect(() => siteSmokeConfig({})).toThrow(/SITE_SMOKE_URL is not set/);
  });

  it('refuses a dev address without the dev password', () => {
    expect(() => siteSmokeConfig({ SITE_SMOKE_URL: SITE_URL })).toThrow(
      /SITE_SMOKE_URL is set but DEV_BASIC_AUTH_PASSWORD is not/,
    );
  });

  it('runs on every desktop browser (#883, #1003), retrying nothing', () => {
    expect(site().projects).toEqual(desktopProjects(DESKTOP_BROWSERS));
    expect(site().retries).toBe(0);
    expect(site().forbidOnly).toBe(true);
  });

  it('is npm run test:site:dev', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:site:dev']).toBe(
      'scripts/browser-suite.sh site playwright.site.config.ts',
    );
  });

  it('runs once in deploy-dev, after verify and the roadmap’s first read, in CI’s Playwright image, with the dev password', () => {
    const running = jobsRunning('npm run test:site:dev');
    expect(running.map(([name]) => name)).toEqual(['site-smoke']);
    const job = deployDev.jobs['site-smoke'];
    expect(needsOf(job)).toEqual(['verify', 'verify-roadmap']);
    expect(job?.container?.image).toBe(
      ci.jobs['build-and-test']?.container?.image,
    );
    expect(job?.environment).toMatchObject({ name: 'dev' });
    const steps = job?.steps ?? [];
    const suite = steps.filter((s) => runOf(s) === 'npm run test:site:dev');
    expect(suite).toHaveLength(1);
    expect(suite[0]?.env).toEqual({
      SITE_SMOKE_URL: SITE_URL,
      DEV_BASIC_AUTH_PASSWORD: '${{ secrets.DEV_BASIC_AUTH_PASSWORD }}',
    });
    expectEdgeInstalledBefore(job, 'npm run test:site:dev');
  });

  it('keeps a screenshot of each failing test (#864)', () => {
    expect(site().use?.screenshot).toBe('only-on-failure');
  });

  // A trace records each request's headers, the dev password's
  // Authorization among them, and test-results is uploaded to a public
  // repository's run (#864).
  it('records no trace and no video, which would carry the dev password', () => {
    expect(site().use?.trace).toBe('off');
    expect(site().use?.video).toBe('off');
  });

  it('uploads test-results when the suite itself fails, and only then (#864)', () => {
    const steps = deployDev.jobs['site-smoke']?.steps ?? [];
    const suiteAt = steps.findIndex(
      (s) => runOf(s) === 'npm run test:site:dev',
    );
    const suite = steps[suiteAt];
    expect(suite?.id).toBe('suite');
    const uploads = steps.filter((s) =>
      (s.uses ?? '').startsWith('actions/upload-artifact@'),
    );
    expect(uploads).toHaveLength(1);
    const upload = uploads[0];
    expect(steps.indexOf(upload as Step)).toBe(suiteAt + 1);
    expect(upload?.if).toBe(
      "${{ failure() && steps.suite.outcome == 'failure' }}",
    );
    expect(upload?.with).toEqual({
      name: 'site-smoke-failures',
      path: 'test-results/',
      'retention-days': 14,
      'if-no-files-found': 'error',
    });
  });

  it('pins the upload action to the commit ci.yml pins', () => {
    const pinned = (job: Job | undefined) =>
      (job?.steps ?? [])
        .map((s) => s.uses ?? '')
        .filter((u) => u.startsWith('actions/upload-artifact@'));
    const ciPins = Object.values(ci.jobs).flatMap(pinned);
    expect(ciPins.length).toBeGreaterThan(0);
    expect(pinned(deployDev.jobs['site-smoke'])).toEqual([ciPins[0]]);
  });
});
