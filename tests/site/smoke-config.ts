import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from '@playwright/test';

/**
 * The site's browser suite (#827): the roadmap page as deployed on dev, the
 * real site Worker reading the real board, driven with real clicks and key
 * presses in each browser engine. Nothing is stood in: deploy-dev runs it
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
  const shared: PlaywrightTestConfig = {
    testDir: 'tests/site',
    workers: 1,
    // One limit, at the CI step (#476): none per test.
    timeout: 0,
    forbidOnly: true,
    retries: 0,
    reporter: 'list',
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
  };
  return defineConfig({
    ...shared,
    use: {
      baseURL: target,
      httpCredentials: { username: USERNAME, password },
    },
  });
}
