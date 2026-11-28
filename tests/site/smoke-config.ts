import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import { desktopSuite } from '../desktop-targets';
import { HOLDING_DOOR } from '../../apps/site/worker/routes';
import { devPassState } from '../dev-pass-cookie';

/**
 * The site's browser suite (#827): the roadmap page as deployed on dev, the
 * real site Worker reading the real board, driven with real presses (a tap on a
 * phone, a click on a desktop) and key presses on every supported target. Nothing is stood in: deploy-dev runs it
 * after its verify jobs have seen this commit served (`SITE_SMOKE_URL`, the
 * site Worker's own address, where the site being built is seen, #673).
 *
 * The credentials carry no `origin` and no `send`, for the reasons
 * playwright.web.config.ts records (#123): WebKit refuses a password scoped
 * to an origin on HTTPS's default port.
 */
const USERNAME = 'site-smoke';

export function siteSmokeConfig(
  env: Readonly<Record<string, string | undefined>>,
): ReturnType<typeof defineConfig> {
  const target = env['SITE_SMOKE_URL'];
  if (target === undefined)
    throw new Error(
      'SITE_SMOKE_URL is not set: the site suite runs against the deployed dev site only (deploy-dev)',
    );
  const password = env['DEV_BASIC_AUTH_PASSWORD'];
  if (password === undefined)
    throw new Error(
      'SITE_SMOKE_URL is set but DEV_BASIC_AUTH_PASSWORD is not: dev answers every request with its password gate',
    );
  const devPass = env['DEV_PASS'];
  if (devPass === undefined)
    throw new Error(
      'SITE_SMOKE_URL is set but DEV_PASS is not: the support pages load through the site’s dev door, which lets no request through without one (#1078)',
    );
  const shared: PlaywrightTestConfig = {
    testDir: 'tests/site',
    workers: 1,
    // One limit, at the CI step (#476): none per test.
    timeout: 0,
    forbidOnly: true,
    retries: 0,
    ...desktopSuite('site'),
  };
  return defineConfig({
    ...shared,
    use: {
      baseURL: target,
      storageState: devPassState(HOLDING_DOOR, devPass),
      httpCredentials: { username: USERNAME, password },
      // A failing test leaves a screenshot beside Playwright's page snapshot
      // in test-results, which deploy-dev uploads (#864). Never a trace or a
      // video: a trace records each request's headers, the dev password's
      // Authorization among them, and the upload is public.
      screenshot: 'only-on-failure',
      trace: 'off',
      video: 'off',
    },
  });
}
