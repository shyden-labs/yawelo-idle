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
let door: Worker | undefined;

const started = (worker: Worker | undefined): Worker => {
  if (worker === undefined) throw new Error('the Workers did not start');
  return worker;
};

/** The origin the door's outgoing request names, served by its local Worker. */
const origins = async (request: Request) => {
  const host = new URL(request.url).hostname;
  if (host !== `${SYNC_WORKER}.${ORIGIN_DOMAIN}`)
    throw new Error(`no local origin for ${host}`);
  return started(sync).fetch(request.url, {
    method: request.method,
    headers: Object.fromEntries(request.headers),
  });
};

beforeAll(async () => {
  sync = await unstable_startWorker({
    config: config('sync-worker'),
    bindings: {
      DOOR_REQUIRED: { type: 'plain_text', value: 'true' },
      DOOR_SECRET: { type: 'secret_text', value: SECRET },
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
      structuredLogsHandler: (log: Log) => doorLogs.push(log),
    },
  });
});

afterAll(async () => {
  await door?.dispose();
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
