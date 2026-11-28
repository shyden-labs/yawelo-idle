import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import { desktopSuite } from './tests/desktop-targets';
import { devPassState } from './tests/dev-pass-cookie';

/**
 * The web app's smoke suite (#123 AC3): the BUILT game, loaded in each
 * browser engine.
 *
 * `npm run test:web` builds first and serves the game through its own Worker
 * in local workerd (`wrangler dev`). Locally the game runs alone, without the
 * site Worker in front: local workerd serves static assets for one Worker per
 * process (measured with wrangler 4.145.0, #332), so the forwarding is proved
 * by the site harness and by verify-dev on dev.
 *
 * `npm run test:web:dev` runs the same tests against the address in
 * `WEB_SMOKE_URL` (deploy-dev sets it to dev, after verify has seen this
 * commit served there; #123 DoD). It builds and starts nothing. Dev's door
 * is its gate (#1078): the suite carries the CI-minted DEV pass as a cookie on
 * the door it tests, and sends no password.
 */
const PORT = 8791;

export function webSmokeConfig(
  env: Readonly<Record<string, string | undefined>>,
): ReturnType<typeof defineConfig> {
  const shared: PlaywrightTestConfig = {
    testDir: 'tests/web',
    workers: 1,
    // One limit, at the CI step (#476): none per test.
    timeout: 0,
    forbidOnly: true,
    retries: 0,
    ...desktopSuite('web'),
  };
  const target = env['WEB_SMOKE_URL'];
  if (target === undefined) {
    const local = `http://127.0.0.1:${String(PORT)}`;
    return defineConfig({
      ...shared,
      use: { baseURL: local },
      webServer: {
        command: `npx wrangler dev --config apps/web/wrangler.jsonc --ip 127.0.0.1 --port ${String(PORT)}`,
        url: `${local}/play/`,
        reuseExistingServer: false,
      },
    });
  }
  const devPass = env['DEV_PASS'];
  if (devPass === undefined)
    throw new Error(
      'WEB_SMOKE_URL is set but DEV_PASS is not: the dev door lets no request through without one (#1078)',
    );
  return defineConfig({
    ...shared,
    use: {
      baseURL: target,
      storageState: devPassState(new URL(target).hostname, devPass),
      // A failing test leaves a screenshot beside Playwright's page snapshot
      // in test-results, which deploy-dev uploads (#888). Never a trace or a
      // video: a trace records each request's headers, the DEV pass's
      // cookie among them, and the upload is public.
      screenshot: 'only-on-failure',
      trace: 'off',
      video: 'off',
    },
  });
}

export default webSmokeConfig(process.env);
