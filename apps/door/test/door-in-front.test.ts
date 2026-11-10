import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unstable_startWorker } from 'wrangler';
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
const DEV_PASSWORD = randomBytes(16).toString('hex');

const doorTo = (worker: string): string => {
  const found = [...DOORS].find(([, door]) => door.worker === worker);
  if (found === undefined) throw new Error(`no door reaches ${worker}`);
  return found[0];
};

const config = (app: string): string =>
  new URL(`../../${app}/wrangler.jsonc`, import.meta.url).pathname;

const persist = mkdtempSync(join(tmpdir(), 'door-in-front-'));

interface Log {
  readonly level: string;
  readonly message: string;
}
const doorLogs: Log[] = [];

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;
let sync: Worker | undefined;
let site: Worker | undefined;
let door: Worker | undefined;

const started = (worker: Worker | undefined): Worker => {
  if (worker === undefined) throw new Error('the Workers did not start');
  return worker;
};

/** The origin the door's outgoing request names, served by its local Worker. */
const origins = async (request: Request) => {
  const host = new URL(request.url).hostname;
  const local = {
    [`${SYNC_WORKER}.${ORIGIN_DOMAIN}`]: sync,
    [`${SITE_WORKER}.${ORIGIN_DOMAIN}`]: site,
  }[host];
  if (local === undefined) throw new Error(`no local origin for ${host}`);
  return local.fetch(request.url, {
    method: request.method,
    headers: Object.fromEntries(request.headers),
  });
};

/** The origin itself, required to come through its door, with a fresh secret. */
const behindItsDoor = {
  DOOR_REQUIRED: { type: 'plain_text', value: 'true' },
  DOOR_SECRET: { type: 'secret_text', value: SECRET },
} as const;

beforeAll(async () => {
  sync = await unstable_startWorker({
    config: config('sync-worker'),
    bindings: behindItsDoor,
    dev: {
      persist,
      server: { port: 0 },
      inspector: false,
      watch: false,
    },
  });
  // The site's built pages come from the site's own harness build, which
  // `npm run test:worker` runs before this workspace's tests.
  site = await unstable_startWorker({
    config: config('site'),
    bindings: {
      ...behindItsDoor,
      DEV_PASSWORD: { type: 'secret_text', value: DEV_PASSWORD },
    },
    dev: {
      persist,
      server: { port: 0 },
      inspector: false,
      watch: false,
    },
  });
  door = await unstable_startWorker({
    config: config('door'),
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
      outboundService: origins,
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
  await site?.dispose();
  await sync?.dispose();
  rmSync(persist, { recursive: true, force: true });
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
    const response = await started(sync).fetch(
      `https://${SYNC_WORKER}.${ORIGIN_DOMAIN}/health`,
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('forbidden');
  });

  it('refuses a request straight to it with a wrong secret, 403', async () => {
    const response = await started(sync).fetch(
      `https://${SYNC_WORKER}.${ORIGIN_DOMAIN}/health`,
      { headers: { [DOOR_SECRET_HEADER]: 'not-the-secret' } },
    );
    expect(response.status).toBe(403);
  });

  it('answers a request straight to it with the secret, as CI sends it', async () => {
    const response = await started(sync).fetch(
      `https://${SYNC_WORKER}.${ORIGIN_DOMAIN}/health`,
      { headers: { [DOOR_SECRET_HEADER]: SECRET } },
    );
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
    const response = await started(site).fetch(
      `https://${SITE_WORKER}.${ORIGIN_DOMAIN}${HOOK}`,
    );
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('forbidden');
  });

  it('refuses a request straight to it with a wrong secret, 403', async () => {
    const response = await started(site).fetch(
      `https://${SITE_WORKER}.${ORIGIN_DOMAIN}${HOOK}`,
      { headers: { [DOOR_SECRET_HEADER]: 'not-the-secret' } },
    );
    expect(response.status).toBe(403);
  });

  it('passes the live roadmap’s WebSocket upgrade through its door', async () => {
    const response = await started(door).fetch(
      `https://${doorTo(SITE_WORKER)}/api/roadmap/live`,
      {
        headers: {
          Upgrade: 'websocket',
          Authorization: `Basic ${btoa(`dev:${DEV_PASSWORD}`)}`,
        },
      },
    );
    const socket = response.webSocket;
    socket?.accept();
    socket?.close(1000, 'done');
    expect({
      status: response.status,
      socket: socket !== null,
      doorErrors: doorLogs.filter((log) => log.level === 'error'),
    }).toEqual({ status: 101, socket: true, doorErrors: [] });
  });
});
