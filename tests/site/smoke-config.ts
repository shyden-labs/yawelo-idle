import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import { desktopSuite } from '../desktop-targets';
import { SITE_DOOR } from '../../apps/site/worker/routes';
import { devPassState } from '../dev-pass-cookie';

/**
 * The site's browser suite (#827): the roadmap page as deployed on dev, the
 * real site Worker reading the real board, driven with real presses (a tap on a
 * phone, a click on a desktop) and key presses on every supported target. Nothing is stood in: deploy-dev runs it
 * after its verify jobs have seen this commit served (`SITE_SMOKE_URL`, the
 * site's dev door, where the site being built is seen, #673, #1078). The DEV
 * pass is its only key: the door is the dev site's only gate (#1078 AC3).
 */

export function siteSmokeConfig(
  env: Readonly<Record<string, string | undefined>>,
): ReturnType<typeof defineConfig> {
  const target = env['SITE_SMOKE_URL'];
  if (target === undefined)
    throw new Error(
      'SITE_SMOKE_URL is not set: the site suite runs against the deployed dev site only (deploy-dev)',
    );
  const devPass = env['DEV_PASS'];
  if (devPass === undefined)
    throw new Error(
      'SITE_SMOKE_URL is set but DEV_PASS is not: the site’s dev door lets no request through without one (#1078)',
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
      storageState: devPassState(SITE_DOOR, devPass),
      // A failing test leaves a screenshot beside Playwright's page snapshot
      // in test-results, which deploy-dev uploads (#864). Never a trace or a
      // video: a trace records each request's headers, the DEV pass cookie
      // among them, and the upload is public.
      screenshot: 'only-on-failure',
      trace: 'off',
      video: 'off',
    },
  });
}
