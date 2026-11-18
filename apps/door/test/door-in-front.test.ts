import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createTestHarness, unstable_startWorker } from 'wrangler';
import { DOOR_SECRET_HEADER, DOORS } from '../worker/door';

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
const DEV_PASSWORD = randomBytes(16).toString('hex');

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
    { configPath: './sync-worker/wrangler.jsonc', ...behindItsDoor },
    {
      configPath: './site/wrangler.jsonc',
      vars: behindItsDoor.vars,
      secrets: { ...behindItsDoor.secrets, DEV_PASSWORD },
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
  await origins.listen();
  door = await unstable_startWorker({
    config: new URL('../wrangler.jsonc', import.meta.url).pathname,
    bindings: {
      ORIGIN_DOMAIN: { type: 'plain_text', value: ORIGIN_DOMAIN },
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
  });
});

afterAll(async () => {
  await door?.dispose();
  await origins.close();
});

describe('the sync Worker behind its door (#784 AC4)', () => {
  it('answers through its door, which adds the secret', async () => {
    const response = await started(door).fetch(
      `https://${doorTo(SYNC_WORKER)}/health`,
    );
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
    const response = await started(door).fetch(
      `https://${doorTo(SITE_WORKER)}${HOOK}`,
    );
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

  const upgrade = {
    Upgrade: 'websocket',
    Authorization: `Basic ${btoa(`dev:${DEV_PASSWORD}`)}`,
  };

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
    const response = await started(door).fetch(
      `https://${doorTo(SITE_WORKER)}/api/roadmap/live`,
      { headers: upgrade },
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
    const response = await started(door).fetch(
      `https://${doorTo(HOLDING_WORKER)}/`,
    );
    expect({
      status: response.status,
      page: (await response.text()).includes('<html'),
      doorErrors: doorLogs.filter((log) => log.level === 'error'),
    }).toEqual({ status: 200, page: true, doorErrors: [] });
  });

  it('answers through the dev site’s door with the holding page, the site passing the secret on', async () => {
    const response = await started(door).fetch(
      `https://${doorTo(SITE_WORKER)}/`,
      { headers: { Authorization: `Basic ${btoa(`dev:${DEV_PASSWORD}`)}` } },
    );
    expect({
      status: response.status,
      page: (await response.text()).includes('<html'),
    }).toEqual({ status: 200, page: true });
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
