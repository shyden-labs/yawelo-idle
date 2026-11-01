import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { createTestHarness } from 'wrangler';
import {
  FIXTURE_REPO,
  FIXTURE_TITLE,
} from '../../../../packages/progress/test/board-fixture';
import {
  FAKE_APP_ID,
  FAKE_BOARD_ID,
  type FakeConfig,
  type Seen,
} from '../github-fake/contract';
import { fakeGitHub } from '../github-fake/fake-github';
import { serveFake } from './github-server';

/**
 * One roadmap test file's world (#341), in wrangler's own harness (#506):
 * the site Worker as wrangler.roadmap-test.jsonc runs it (the real handler and
 * `Roadmap`, its GitHub requests forwarded to a fake GitHub in this process),
 * a stand-in game, and a fresh RSA key pair for the App, so no private key is
 * ever committed. Each file makes its own, so no state crosses files.
 */
export const PASSWORD = 'test-only-password';
export const WEBHOOK_SECRET = 'test-webhook-secret';

export type RoadmapWorld = ReturnType<typeof roadmapWorld>;

/** `appKey: false` starts the Worker as a deploy whose key secret never arrived. */
export function roadmapWorld({ appKey = true }: { appKey?: boolean } = {}) {
  const keys = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const pkcs8 = createPrivateKey(keys.privateKey).export({
    type: 'pkcs8',
    format: 'pem',
  });
  const github = fakeGitHub(keys.publicKey);
  const server = createTestHarness();
  let served: Awaited<ReturnType<typeof serveFake>> | undefined;

  const control = (path: string, init?: RequestInit) =>
    github(new Request(`https://fake-github.test${path}`, init));

  return {
    server,
    /** The App key as GitHub hands it out (PKCS#1 PEM), and in PKCS#8. */
    appKey: { pkcs1: keys.privateKey, pkcs8 },
    /** The fake GitHub itself, for tests of worker/github.ts run in Node. */
    github,
    async start(): Promise<void> {
      served = await serveFake(github);
      await server.update({
        root: new URL('../..', import.meta.url).pathname,
        workers: [
          {
            configPath: './wrangler.roadmap-test.jsonc',
            vars: {
              ROADMAP_APP_ID: FAKE_APP_ID,
              ROADMAP_BOARD_ID: FAKE_BOARD_ID,
              ROADMAP_BOARD_TITLE: FIXTURE_TITLE,
              ROADMAP_REPO: FIXTURE_REPO,
              TEST_FAKE_GITHUB: served.url,
            },
            secrets: {
              DEV_PASSWORD: PASSWORD,
              ROADMAP_WEBHOOK_SECRET: WEBHOOK_SECRET,
              ...(appKey ? { ROADMAP_APP_KEY: keys.privateKey } : {}),
            },
            // The roadmap's tests ask the front door for no page (#673), so
            // the holding binding takes the real game too, the one other
            // Worker this harness runs (#815).
            bindingOverrides: { HOLDING: 'yawelo-idle-web-dev' },
          },
          // The real game Worker, the service the GAME binding names (#815).
          { configPath: '../web/wrangler.jsonc' },
        ],
      });
      await server.listen();
    },
    async stop(): Promise<void> {
      await server.close();
      await served?.close();
    },
    // Arrow properties: test files take these out of the object.
    resetFake: async (): Promise<void> => {
      await control('/reset', { method: 'POST' });
    },
    configureFake: async (config: Partial<FakeConfig>): Promise<void> => {
      await control('/configure', {
        method: 'POST',
        body: JSON.stringify(config),
      });
    },
    seenByFake: async (): Promise<Seen[]> =>
      (await (await control('/seen')).json()) as Seen[],
  };
}
