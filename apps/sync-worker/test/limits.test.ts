import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness } from '../../../tests/support/create-covered-harness';

/**
 * Request limits counted in D1 (#164 AC2, AC5; spec §12.9): exact at the
 * boundary, shared by every isolate because the count lives in D1, keyed by
 * a keyed hash of the caller's network, and a finished window's count is
 * deleted by the next request (Shyden, 2026-11-19). Served by wrangler's
 * harness from the real wrangler.jsonc, on a real local D1 (#506).
 */
const ROOT = new URL('..', import.meta.url).pathname;

const server = createTestHarness({
  root: ROOT,
  workers: [
    {
      configPath: './wrangler.jsonc',
      secrets: { RATE_KEY: 'harness-rate-key' },
    },
  ],
});

let db: D1Database;

beforeAll(async () => {
  await server.listen();
  const worker = server.getWorker<Env>();
  await worker.applyD1Migrations('DB');
  db = (await worker.getEnv()).DB;
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  await db.prepare('DELETE FROM rate_counts').run();
});

interface CountRow {
  readonly route: string;
  readonly key: string;
  readonly window_end: number;
  readonly count: number;
}

const countRows = async (): Promise<CountRow[]> =>
  (
    await db
      .prepare('SELECT * FROM rate_counts ORDER BY route, window_end')
      .all<CountRow>()
  ).results;

const register = () =>
  server.fetch('https://sync.test/v1/devices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });

const health = () => server.fetch('https://sync.test/health');

describe('request limits in D1 (#164 AC2, AC5)', () => {
  it('accepts the 10th registration in an hour and answers the 11th with 429 and the wait, in one row', async () => {
    const statuses: number[] = [];
    // one scenario: one network registers ten times
    for (let sent = 0; sent < 10; sent += 1)
      statuses.push((await register()).status);
    const refused = await register();
    const wait = Number(refused.headers.get('retry-after'));
    const rows = await countRows();
    expect({
      statuses: [...new Set(statuses)],
      refused: refused.status,
      body: await refused.json(),
      waitInRange: wait >= 1 && wait <= 3600,
      rows: rows.map((row) => ({
        route: row.route,
        count: row.count,
        keyIsHash: /^[\da-f]{64}$/.test(row.key),
        windowOnTheHour: row.window_end % 3600 === 0,
      })),
    }).toEqual({
      statuses: [201],
      refused: 429,
      body: { error: 'too_many_requests' },
      waitInRange: true,
      rows: [
        {
          route: '/v1/devices',
          count: 11,
          keyIsHash: true,
          windowOnTheHour: true,
        },
      ],
    });
  });

  it('reads the count from D1, so a count made elsewhere holds (#164 AC5)', async () => {
    await register();
    // Another isolate or location counted nine more in the same window.
    await db.prepare('UPDATE rate_counts SET count = 10').run();
    expect((await register()).status).toBe(429);
  });

  it('deletes a finished window’s count at the next request', async () => {
    await db
      .prepare(
        "INSERT INTO rate_counts (route, key, window_end, count) VALUES ('/health', 'finished', 60, 5)",
      )
      .run();
    await health();
    expect((await countRows()).map((row) => [row.route, row.count])).toEqual([
      ['/health', 1],
    ]);
  });

  it('counts each route on its own row', async () => {
    await health();
    await register();
    expect((await countRows()).map((row) => [row.route, row.count])).toEqual([
      ['/health', 1],
      ['/v1/devices', 1],
    ]);
  });
});
