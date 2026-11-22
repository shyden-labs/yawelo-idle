/**
 * Every route the sync Worker serves, in one table (#164 AC3; spec §12.9):
 * its method, the query it takes (strictly, so an unknown parameter is
 * refused with 422 naming it), and its request limit. The router serves
 * nothing the table does not list. A route that takes a body reads it through
 * `readBody` with its own size limit (validate.ts).
 *
 * The limits are enforced before a route's input is checked (#164 AC2), and
 * their counts are kept in D1 (#164 AC5, Shyden 2026-11-18; d1-counts.ts).
 */
import { z } from 'zod';
import { submitReport, type StoreReport } from './content-reports';
import { registerDevice, type SaveDevice } from './devices';
import {
  clientAddressOf,
  workerEqual,
  type Equal,
} from '../../door/worker/origin';
import { d1Counts } from './d1-counts';
import {
  checkLimit,
  networkKey,
  networkOf,
  type Counts,
  type Limit,
} from './limit';
import { readQuery } from './validate';

/** A prepared D1 statement, as far as the routes use one. */
interface Statement {
  bind(...values: unknown[]): Statement;
  run(): Promise<unknown>;
}

/**
 * What the routes read from the Worker's env: the generated `Env` fits it, and
 * a unit test can stand it in without the generated types (#164).
 */
export interface SyncEnv {
  readonly COMMIT: string;
  /** The key request counts are hashed under (#164 AC2); a deploy secret. */
  readonly RATE_KEY?: string;
  /** This environment's door secret, so the door's address is believed. */
  readonly DOOR_SECRET?: string;
  readonly DB: {
    prepare(query: string): Statement;
    batch(statements: Statement[]): Promise<unknown>;
  };
}

export interface Route {
  readonly method: 'GET' | 'POST';
  readonly query: z.ZodType;
  readonly limit: Limit;
  /**
   * What a request gets when its count cannot be made (D1 failing): `serve`
   * only for a route that changes nothing and reports D1 itself (/health),
   * `refuse` (503) for every other, so no route that writes runs unlimited.
   */
  readonly whenUncounted: 'serve' | 'refuse';
  readonly handle: (request: Request, env: SyncEnv) => Promise<Response>;
}

const json = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...headers },
  });

/**
 * `GET /health`: what the dev deploy's verify job reads to prove the live
 * Worker is the commit just deployed and its D1 binding answers a query.
 */
async function health(_request: Request, env: SyncEnv): Promise<Response> {
  try {
    await env.DB.prepare('SELECT 1').run();
  } catch (error) {
    // The response says only `unreachable`; the cause goes to the Worker logs.
    console.error('health: D1 query failed', error);
    return json({ ok: false, commit: env.COMMIT, db: 'unreachable' }, 503);
  }
  return json({ ok: true, commit: env.COMMIT, db: 'ok' }, 200);
}

/** Saves a registration: the player and its device, in one D1 batch. */
const saveDevice =
  (env: SyncEnv): SaveDevice =>
  async (device) => {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO players (id, created_at) VALUES (?, ?)').bind(
        device.playerId,
        device.createdAt,
      ),
      env.DB.prepare(
        'INSERT INTO devices (id, player_id, token_hash, created_at) VALUES (?, ?, ?, ?)',
      ).bind(
        device.deviceId,
        device.playerId,
        device.tokenHash,
        device.createdAt,
      ),
    ]);
  };

/** `POST /v1/devices` (#163): a new anonymous player and its first device. */
const devices = (request: Request, env: SyncEnv): Promise<Response> =>
  registerDevice(request, saveDevice(env), {
    uuid: () => crypto.randomUUID(),
    now: () => Date.now(),
  });

const NO_QUERY = z.strictObject({});

/** The CHECK on content_report_quota.n (migration 0003) refusing the 11th. */
const DAILY_LIMIT_CHECK = 'CHECK constraint failed: content_report_daily_limit';
/** SQLite's message when content_reports_one_per_item refuses a row. */
const ONE_PER_ITEM = 'UNIQUE constraint failed: content_reports.install_id';

/**
 * Stores a report in one D1 batch, which D1 runs as a transaction (§B.2): the
 * day's count rises by one, the report is inserted, and the install's quota
 * rows for earlier days go (AC6). The 11th of a day breaks the count's CHECK
 * and a second open report on an item breaks the unique index; either rolls
 * the whole batch back, so a refused report uses none of the quota.
 */
const storeReport =
  (env: SyncEnv): StoreReport =>
  async (report) => {
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO content_report_quota (install_id, utc_day, n) VALUES (?, ?, 1)
           ON CONFLICT (install_id, utc_day) DO UPDATE SET n = n + 1`,
        ).bind(report.installId, report.utcDay),
        env.DB.prepare(
          `INSERT INTO content_reports (id, created_at, course, kind, item_id,
             problem, suggestion, note, app_version, content_version, install_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          report.id,
          report.createdAt,
          report.course,
          report.kind,
          report.itemId,
          report.problem,
          report.suggestion,
          report.note,
          report.appVersion,
          report.contentVersion,
          report.installId,
        ),
        env.DB.prepare(
          'DELETE FROM content_report_quota WHERE install_id = ? AND utc_day < ?',
        ).bind(report.installId, report.utcDay),
      ]);
      return 'stored';
    } catch (error) {
      const message = String(error);
      if (message.includes(DAILY_LIMIT_CHECK)) return 'over_quota';
      if (message.includes(ONE_PER_ITEM)) return 'duplicate';
      throw error;
    }
  };

/** `POST /v1/content-reports` (#52). */
const contentReports = (request: Request, env: SyncEnv): Promise<Response> =>
  submitReport(request, storeReport(env), {
    uuid: () => crypto.randomUUID(),
    now: () => Date.now(),
  });

/** `GET /v1/content-reports/health` (#52 AC7): 200 when D1 answers. */
async function contentReportsHealth(
  _request: Request,
  env: SyncEnv,
): Promise<Response> {
  try {
    await env.DB.prepare('SELECT 1 FROM content_reports LIMIT 1').run();
  } catch (error) {
    console.error('content reports health: D1 query failed', error);
    return json({ ok: false }, 503);
  }
  return json({ ok: true }, 200);
}

export const ROUTES: Readonly<
  Record<
    | '/health'
    | '/v1/content-reports'
    | '/v1/content-reports/health'
    | '/v1/devices',
    Route
  >
> = {
  '/health': {
    method: 'GET',
    query: NO_QUERY,
    limit: { requests: 60, perSeconds: 60 },
    whenUncounted: 'serve',
    handle: health,
  },
  '/v1/content-reports': {
    method: 'POST',
    query: NO_QUERY,
    limit: { requests: 11, perSeconds: 60 },
    whenUncounted: 'refuse',
    handle: contentReports,
  },
  '/v1/content-reports/health': {
    method: 'GET',
    query: NO_QUERY,
    limit: { requests: 60, perSeconds: 60 },
    whenUncounted: 'refuse',
    handle: contentReportsHealth,
  },
  '/v1/devices': {
    method: 'POST',
    query: NO_QUERY,
    // Registration makes a new player each time: a few per hour per network.
    limit: { requests: 10, perSeconds: 3600 },
    whenUncounted: 'refuse',
    handle: devices,
  },
};

const isListed = (path: string): path is keyof typeof ROUTES =>
  Object.hasOwn(ROUTES, path);

/** What the router counts with: D1, the clock and the runtime's comparison by default. */
export interface RouteOptions {
  readonly counts?: Counts;
  readonly now?: () => number;
  readonly equal?: Equal;
}

/**
 * The key a request is counted under: the keyed hash of its network
 * (#164 AC2). An address that is not one counts under one shared network.
 */
async function requestKey(
  request: Request,
  secret: string,
  doorSecret: string | undefined,
  equal: Equal,
): Promise<string> {
  const address = await clientAddressOf(request, doorSecret, equal);
  const network = networkOf(address ?? '') ?? 'unknown';
  return networkKey(network, secret);
}

/**
 * Serves a request through the table: 404, 405, then the route's limit (429
 * with Retry-After), 422, or the route's answer. A request is counted before
 * its input is checked, so refused input still counts.
 */
export async function route(
  request: Request,
  env: SyncEnv,
  options: RouteOptions = {},
): Promise<Response> {
  const url = new URL(request.url);
  if (!isListed(url.pathname)) return json({ error: 'not_found' }, 404);
  const listed = ROUTES[url.pathname];
  if (request.method !== listed.method)
    return json({ error: 'method_not_allowed' }, 405, {
      allow: listed.method,
    });
  if (env.RATE_KEY === undefined || env.RATE_KEY.length === 0)
    return json({ error: 'not_configured', missing: 'RATE_KEY' }, 500);
  const {
    counts = d1Counts(env.DB),
    now = Date.now,
    equal = workerEqual,
  } = options;
  const key = await requestKey(request, env.RATE_KEY, env.DOOR_SECRET, equal);
  let wait: number | undefined;
  try {
    wait = await checkLimit(counts, url.pathname, key, listed.limit, now());
  } catch (error) {
    // The cause goes to the Worker logs; the answer says only `unavailable`.
    console.error('limit: the request count failed', error);
    if (listed.whenUncounted === 'refuse')
      return json({ error: 'unavailable' }, 503);
  }
  if (wait !== undefined)
    return json({ error: 'too_many_requests' }, 429, {
      'retry-after': String(wait),
    });
  const query = readQuery(url, listed.query);
  if (!query.ok) return query.response;
  return listed.handle(request, env);
}
