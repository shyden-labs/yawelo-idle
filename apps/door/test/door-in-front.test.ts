import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, type webcrypto } from 'node:crypto';
import { unstable_startWorker } from 'wrangler';
import { createTestHarness } from '../../../tests/support/create-covered-harness';
import { coveredStartWorker } from '../../../tests/support/covered-start-worker';
import { DOOR_SECRET_HEADER, DOORS } from '../worker/door';
import { PASS_HEADER, SIGNIN_ORIGIN } from '../worker/dev-pass/door';
import { mintPass, type SigningKey } from '../worker/dev-pass/pass';

/**
 * The real door in front of the real Workers, both in local workerd (#784
 * AC4; Shyden, 2026-11-09: "same as ShyTalk", the door proved on every pull
 * request). The origin requires its door (DOOR_REQUIRED "true") with a fresh
 * random secret, as the deploy gives it after the go-live; the door is given
 * the same secret. The door's outgoing fetch to `<worker>.<ORIGIN_DOMAIN>`
 * is handed to the local origin Worker by name, so nothing leaves the runner.
 * Door hosts come from DOORS, never written out (#784 AC1b).
 */

const SECRET = randomBytes(32).toString('hex');
const ORIGIN_DOMAIN = 'origins.invalid';
const SYNC_WORKER = 'yawelo-idle-sync-dev';
const SITE_WORKER = 'yawelo-idle-site-dev';
const HOLDING_WORKER = 'yawelo-idle-holding-dev';

const doorTo = (worker: string): string => {
  const found = [...DOORS].find(([, door]) => door.worker === worker);
  if (found === undefined) throw new Error(`no door reaches ${worker}`);
  return found[0];
};

interface Log {
  readonly level: string;
  readonly message: string;
}
const doorLogs: Log[] = [];

/** The origin itself, required to come through its door, with a fresh secret. */
const behindItsDoor = {
  vars: { DOOR_REQUIRED: 'true' },
  secrets: { DOOR_SECRET: SECRET },
} as const;

/**
 * The origins in one harness, from their real configs, so the site's GAME
 * and HOLDING service bindings resolve as they do in the account (as
 * apps/site/test/site.test.ts runs them). The pages and the game come from
 * the site's own harness build, which `npm run test:worker` runs first.
 */
const origins = createTestHarness({
  root: new URL('../..', import.meta.url).pathname,
  workers: [
    {
      configPath: './sync-worker/wrangler.jsonc',
      vars: behindItsDoor.vars,
      // The key request counts are hashed under (#164 AC2).
      secrets: { ...behindItsDoor.secrets, RATE_KEY: 'harness-rate-key' },
    },
    {
      configPath: './site/wrangler.jsonc',
      vars: behindItsDoor.vars,
      secrets: behindItsDoor.secrets,
    },
    { configPath: './web/wrangler.jsonc' },
    // The holding page's dev copy as its real config deploys it, but serving
    // the harness build's holding pages: the dev copy's own folder is made
    // only by the dev deploy (scripts/holding-dev.ts).
    {
      config: {
        name: HOLDING_WORKER,
        main: './site/worker/holding.ts',
        compatibility_date: '2026-10-20',
        assets: {
          directory: './site/dist-holding',
          binding: 'ASSETS',
          run_worker_first: true,
          not_found_handling: '404-page',
        },
      },
      ...behindItsDoor,
    },
  ],
});

/** A request straight to an origin Worker, past its door. */
const straightTo = (
  worker: string,
  path: string,
  init?: { headers: Record<string, string> },
) =>
  origins
    .getWorker(worker)
    .fetch(`https://${worker}.${ORIGIN_DOMAIN}${path}`, init);

type Door = Awaited<ReturnType<typeof unstable_startWorker>>;
let door: Door | undefined;

/**
 * The DEV pass signing key for this run (#1078): the door is given its public
 * half as DEV_PASS_KEYS, as the deploy gives it the sign-in's.
 */
let signing: SigningKey | undefined;
let publicKeys = '';

/** A request through a dev door, carrying a valid DEV pass for that door. */
const throughDoor = async (
  worker: string,
  path: string,
  headers: Record<string, string> = {},
) => {
  if (signing === undefined) throw new Error('no signing key');
  const host = doorTo(worker);
  const pass = await mintPass(
    { aud: host, sub: 'harness@example.com', kind: 'machine' },
    signing,
    Math.floor(Date.now() / 1000),
  );
  return started(door).fetch(`https://${host}${path}`, {
    headers: { ...headers, [PASS_HEADER]: pass },
  });
};

const started = (worker: Door | undefined): Door => {
  if (worker === undefined) throw new Error('the door did not start');
  return worker;
};

/** The origin the door's outgoing request names, served by its local Worker. */
const toOrigin = async (request: Request) => {
  const host = new URL(request.url).hostname;
  const worker = host.endsWith(`.${ORIGIN_DOMAIN}`)
    ? host.slice(0, -`.${ORIGIN_DOMAIN}`.length)
    : '';
  if (![SYNC_WORKER, SITE_WORKER, HOLDING_WORKER].includes(worker))
    throw new Error(`no local origin for ${host}`);
  const answer = await origins.getWorker(worker).fetch(request.url, {
    method: request.method,
    headers: Object.fromEntries(request.headers),
  });
  if (answer.status !== 101) return answer;
  // This handoff is Node's fetch, whose WebSocket client offers compression
  // that the door's own request never did, so the origin's 101 names an
  // extension and the door refuses it ("added Sec-WebSocket-Extensions when
  // client did not offer any", PR #940's run on 948ebee1). The 101 goes back
  // without that one header, as the origin answers the door's real request.
  const headers = Object.fromEntries(answer.headers);
  delete headers['sec-websocket-extensions'];
  const Answer = answer.constructor as new (
    body: null,
    init: {
      status: number;
      headers: Record<string, string>;
      webSocket: unknown;
    },
  ) => typeof answer;
  return new Answer(null, {
    status: 101,
    headers,
    webSocket: answer.webSocket,
  });
};

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey('Ed25519', true, [
    'sign',
    'verify',
  ])) as webcrypto.CryptoKeyPair;
  signing = { kid: 'harness', privateKey: pair.privateKey };
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  publicKeys = JSON.stringify({ harness: jwk.x });
  await origins.listen();
  // Counted under coverage from its instrumented build (#1093 AC2).
  door = await coveredStartWorker(
    {
      config: new URL('../wrangler.jsonc', import.meta.url).pathname,
      bindings: {
        ORIGIN_DOMAIN: { type: 'plain_text', value: ORIGIN_DOMAIN },
        DEV_PASS_KEYS: { type: 'plain_text', value: publicKeys },
        DEV_DOOR_SECRET: { type: 'secret_text', value: SECRET },
        TEST_DOOR_SECRET: {
          type: 'secret_text',
          value: randomBytes(32).toString('hex'),
        },
      },
      dev: {
        server: { port: 0 },
        inspector: false,
        watch: false,
        outboundService: toOrigin,
        // Keep each request's own host: by default wrangler rewrites every
        // request to the first route's host (dev.), measured in PR #940's run
        // on 105ad6ee, where a request to the sync Worker's door reached the
        // site's (installed wrangler, getUserWorkerInnerUrlOverrides).
        inferOriginFromRoutes: false,
        structuredLogsHandler: (log: Log) => doorLogs.push(log),
      },
    },
    { start: unstable_startWorker },
  );
});

afterAll(async () => {
  await door?.dispose();
  await origins.close();
});

describe('the sync Worker behind its door (#784 AC4)', () => {
  it('answers through its door, which adds the secret', async () => {
    const response = await throughDoor(SYNC_WORKER, '/health');
    // Status, body and the door's error logs in one comparison, so a
    // failure shows why the door answered as it did.
    expect({
      status: response.status,
      body: await response.text(),
      doorErrors: doorLogs.filter((log) => log.level === 'error'),
    }).toEqual({
      status: 200,
      body: expect.stringContaining('"ok":true') as unknown,
      doorErrors: [],
    });
  });

  it('refuses a request straight to it without the secret, 403', async () => {
    const response = await straightTo(SYNC_WORKER, '/health');
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('forbidden');
  });

  it('refuses a request straight to it with a wrong secret, 403', async () => {
    const response = await straightTo(SYNC_WORKER, '/health', {
      headers: { [DOOR_SECRET_HEADER]: 'not-the-secret' },
    });
    expect(response.status).toBe(403);
  });

  it('answers a request straight to it with the secret, as CI sends it', async () => {
    const response = await straightTo(SYNC_WORKER, '/health', {
      headers: { [DOOR_SECRET_HEADER]: SECRET },
    });
    expect(response.status).toBe(200);
  });
});

describe('the dev site Worker behind its door (#784 AC4)', () => {
  const HOOK = '/hooks/github';

  it('lets a request through its door past the door check', async () => {
    // The webhook path answers before the dev password: a GET is 405.
    const response = await throughDoor(SITE_WORKER, HOOK);
    expect({
      status: response.status,
      allow: response.headers.get('allow'),
    }).toEqual({ status: 405, allow: 'POST' });
  });

  it('refuses a request straight to it without the secret, 403', async () => {
    const response = await straightTo(SITE_WORKER, HOOK);
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('forbidden');
  });

  it('refuses a request straight to it with a wrong secret, 403', async () => {
    const response = await straightTo(SITE_WORKER, HOOK, {
      headers: { [DOOR_SECRET_HEADER]: 'not-the-secret' },
    });
    expect(response.status).toBe(403);
  });

  // No password: the door is the dev site's only gate (#1078).
  const upgrade = { Upgrade: 'websocket' };

  it('accepts the live roadmap’s WebSocket upgrade straight, with the secret', async () => {
    const response = await straightTo(SITE_WORKER, '/api/roadmap/live', {
      headers: { ...upgrade, [DOOR_SECRET_HEADER]: SECRET },
    });
    const socket = response.webSocket;
    socket?.accept();
    socket?.close(1000, 'done');
    expect({
      status: response.status,
      socket: socket !== null,
      body: response.status === 101 ? '' : await response.text(),
    }).toEqual({ status: 101, socket: true, body: '' });
  });

  it('passes the live roadmap’s WebSocket upgrade through its door', async () => {
    const response = await throughDoor(
      SITE_WORKER,
      '/api/roadmap/live',
      upgrade,
    );
    const socket = response.webSocket;
    socket?.accept();
    socket?.close(1000, 'done');
    expect({
      status: response.status,
      socket: socket !== null,
      body: response.status === 101 ? '' : await response.text(),
      doorErrors: doorLogs.filter((log) => log.level === 'error'),
    }).toEqual({ status: 101, socket: true, body: '', doorErrors: [] });
  });
});

describe('the holding page’s dev copy behind its door (#784 AC4)', () => {
  it('answers through its own door with the holding page', async () => {
    const response = await throughDoor(HOLDING_WORKER, '/');
    expect({
      status: response.status,
      page: (await response.text()).includes('<html'),
      doorErrors: doorLogs.filter((log) => log.level === 'error'),
    }).toEqual({ status: 200, page: true, doorErrors: [] });
  });

  it('leaves the dev site’s door to the site being built, no password asked (#1078)', async () => {
    const response = await throughDoor(SITE_WORKER, '/');
    const page = await response.text();
    expect({
      status: response.status,
      challenge: response.headers.get('WWW-Authenticate'),
      built: page.includes(' data-dev-strip>'),
      holding: page.includes(' data-coming-soon>'),
    }).toEqual({ status: 200, challenge: null, built: true, holding: false });
  });

  it('refuses a request straight to it without the secret, 403', async () => {
    const response = await straightTo(HOLDING_WORKER, '/');
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('forbidden');
  });

  it('refuses a request for a missing page straight to it without the secret, 403, never its 404 page', async () => {
    const response = await straightTo(HOLDING_WORKER, '/no-such-page');
    expect(response.status).toBe(403);
  });

  it('refuses a request straight to it with a wrong secret, 403', async () => {
    const response = await straightTo(HOLDING_WORKER, '/', {
      headers: { [DOOR_SECRET_HEADER]: 'not-the-secret' },
    });
    expect(response.status).toBe(403);
  });

  it('answers a request straight to it with the secret, as CI sends it', async () => {
    const response = await straightTo(HOLDING_WORKER, '/', {
      headers: { [DOOR_SECRET_HEADER]: SECRET },
    });
    expect(response.status).toBe(200);
  });
});

describe('the DEV pass at the dev doors (#1078 AC1)', () => {
  it('sends a page request with no pass to sign in, reaching no origin', async () => {
    const host = doorTo(SITE_WORKER);
    const response = await started(door).fetch(`https://${host}/play`, {
      headers: { accept: 'text/html' },
      redirect: 'manual',
    });
    expect({
      status: response.status,
      location: response.headers.get('location'),
    }).toEqual({
      status: 302,
      location: `${SIGNIN_ORIGIN}/pass?for=${host}&back=%2Fplay`,
    });
  });

  it('refuses an API request with no pass, 401', async () => {
    const response = await started(door).fetch(
      `https://${doorTo(SYNC_WORKER)}/health`,
    );
    expect(response.status).toBe(401);
  });

  it('refuses a pass made for another dev door, 401', async () => {
    if (signing === undefined) throw new Error('no signing key');
    const pass = await mintPass(
      { aud: doorTo(SITE_WORKER), sub: 'harness@example.com', kind: 'machine' },
      signing,
      Math.floor(Date.now() / 1000),
    );
    const response = await started(door).fetch(
      `https://${doorTo(SYNC_WORKER)}/health`,
      { headers: { [PASS_HEADER]: pass } },
    );
    expect(response.status).toBe(401);
  });
});
