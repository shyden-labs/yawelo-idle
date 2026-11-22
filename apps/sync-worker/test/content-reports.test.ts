import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from 'wrangler';

/**
 * POST /v1/content-reports against real local D1 (#52 AC1 to AC4, AC6 to AC8;
 * design §B): the daily quota, the one open report per item, the rollback of a
 * refused report and the limit under concurrency, all measured, none assumed.
 * Served by wrangler's harness from the real wrangler.jsonc (#506). Each test
 * uses its own install id, so tests share the database without meeting.
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

const report = (installId: string, itemId: string) => ({
  course: 'en-id',
  kind: 'lexicon',
  itemId,
  problem: 'wrong-translation',
  suggestion: 'Good morning',
  note: 'Said before about 11:00.',
  appVersion: '0.1.0',
  contentVersion: 'c1',
  installId,
  website: '',
});

/**
 * The route's own request limit (#1046: 10 a minute per network) runs before
 * the install's daily quota, and the harness keeps its counts across tests.
 * So each request comes from its own /24 network unless a test names one,
 * and the quota tests below measure the quota alone.
 */
let networks = 0;
const nextAddress = () => {
  networks += 1;
  return `10.${String(networks >> 8)}.${String(networks & 255)}.1`;
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  server.fetch('https://sync.test/v1/content-reports', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': nextAddress(),
      ...headers,
    },
    body: JSON.stringify(body),
  });

const reportsOf = async (installId: string) =>
  (
    await db
      .prepare(
        'SELECT * FROM content_reports WHERE install_id = ? ORDER BY item_id',
      )
      .bind(installId)
      .all()
  ).results;

const quotaOf = async (installId: string) =>
  (
    await db
      .prepare(
        'SELECT utc_day, n FROM content_report_quota WHERE install_id = ? ORDER BY utc_day',
      )
      .bind(installId)
      .all<{ utc_day: string; n: number }>()
  ).results;

const today = () => new Date().toISOString().slice(0, 10);

/** Sends `count` reports on items item-0, item-1, … one after another. */
const sendInOrder = async (installId: string, count: number) => {
  const statuses: number[] = [];
  for (let index = 0; index < count; index += 1)
    statuses.push(
      (await post(report(installId, `item-${String(index)}`))).status,
    );
  return statuses;
};

describe('a report is stored (#52 AC1, AC4)', () => {
  it('201 with its id, and the row holds what was sent and no IP or user agent', async () => {
    const response = await post(report('install-stored', 'lex.a'), {
      'cf-connecting-ip': '203.0.113.7',
      'user-agent': 'TestAgent/1.0',
    });
    expect.soft(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    const rows = await reportsOf('install-stored');
    expect.soft(rows).toEqual([
      {
        id,
        created_at: expect.any(Number) as number,
        course: 'en-id',
        kind: 'lexicon',
        item_id: 'lex.a',
        problem: 'wrong-translation',
        suggestion: 'Good morning',
        note: 'Said before about 11:00.',
        app_version: '0.1.0',
        content_version: 'c1',
        install_id: 'install-stored',
      },
    ]);
    const stored = JSON.stringify(rows);
    expect.soft(stored).not.toContain('203.0.113.7');
    expect.soft(stored).not.toContain('TestAgent');
    expect
      .soft(await quotaOf('install-stored'))
      .toEqual([{ utc_day: today(), n: 1 }]);
  });
});

describe('refusals write nothing (#52 AC2)', () => {
  it('an unknown field: 422, no report and no quota', async () => {
    const response = await post({
      ...report('install-422', 'lex.a'),
      email: 'a@example.com',
    });
    expect.soft(response.status).toBe(422);
    expect.soft(await reportsOf('install-422')).toEqual([]);
    expect.soft(await quotaOf('install-422')).toEqual([]);
  });

  it('a filled honeypot: 201, no report and no quota', async () => {
    const response = await post({
      ...report('install-honeypot', 'lex.a'),
      website: 'http://spam.example',
    });
    expect.soft(response.status).toBe(201);
    expect.soft(await reportsOf('install-honeypot')).toEqual([]);
    expect.soft(await quotaOf('install-honeypot')).toEqual([]);
  });
});

describe('the route limit (#1046, #1086) applies to reports', () => {
  it('fifty a day from one network, the 51st answers 429 with Retry-After before the quota is read', async () => {
    const statuses: number[] = [];
    // one scenario: one network sends 51 reports from 51 installs, so the
    // per-install quota never binds and only the network's day window does
    for (let index = 0; index < 50; index += 1)
      statuses.push(
        (
          await post(report(`install-net-${String(index)}`, 'lex.a'), {
            'cf-connecting-ip': '198.51.100.20',
          })
        ).status,
      );
    const refused = await post(report('install-net-50', 'lex.a'), {
      'cf-connecting-ip': '198.51.100.21',
    });
    expect.soft(statuses).toEqual(Array<number>(50).fill(201));
    expect.soft(refused.status).toBe(429);
    expect.soft(refused.headers.get('retry-after')).toMatch(/^[1-9]\d*$/);
    expect.soft(Number(refused.headers.get('retry-after'))).toBeGreaterThan(60);
    expect.soft(await refused.json()).toEqual({ error: 'too_many_requests' });
    expect.soft(await reportsOf('install-net-50')).toEqual([]);
    expect.soft(await quotaOf('install-net-50')).toEqual([]);
  });
});

describe('ten a day per install (#52 AC3)', () => {
  it('the 10th is accepted and the 11th answers 429', async () => {
    const statuses = await sendInOrder('install-limit', 11);
    expect.soft(statuses).toEqual([...Array<number>(10).fill(201), 429]);
    expect.soft(await reportsOf('install-limit')).toHaveLength(10);
    expect
      .soft(await quotaOf('install-limit'))
      .toEqual([{ utc_day: today(), n: 10 }]);
  });

  it('the 11th answers 429 although every earlier report was resolved', async () => {
    await sendInOrder('install-resolved', 10);
    await db
      .prepare('DELETE FROM content_reports WHERE install_id = ?')
      .bind('install-resolved')
      .run();
    const response = await post(report('install-resolved', 'item-new'));
    expect.soft(response.status).toBe(429);
    expect.soft(await response.json()).toEqual({ error: 'daily_limit' });
    expect.soft(await reportsOf('install-resolved')).toEqual([]);
  });

  it('20 at once from one install store exactly 10 (AC8)', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        post(report('install-burst', `item-${String(index)}`)),
      ),
    );
    const statuses = responses.map((response) => response.status).sort();
    expect
      .soft(statuses)
      .toEqual([
        ...Array<number>(10).fill(201),
        ...Array<number>(10).fill(429),
      ]);
    const refusals = await Promise.all(
      responses
        .filter((response) => response.status === 429)
        .map((response) => response.json()),
    );
    expect
      .soft(refusals)
      .toEqual(Array.from({ length: 10 }, () => ({ error: 'daily_limit' })));
    expect.soft(await reportsOf('install-burst')).toHaveLength(10);
    expect
      .soft(await quotaOf('install-burst'))
      .toEqual([{ utc_day: today(), n: 10 }]);
  });
});

describe('one open report per install and item (#52 AC3)', () => {
  it("a second answers 409 and leaves the day's quota as it was", async () => {
    expect.soft((await post(report('install-dup', 'lex.a'))).status).toBe(201);
    const second = await post(report('install-dup', 'lex.a'));
    expect.soft(second.status).toBe(409);
    expect.soft(await reportsOf('install-dup')).toHaveLength(1);
    expect
      .soft(await quotaOf('install-dup'))
      .toEqual([{ utc_day: today(), n: 1 }]);
  });

  it('the same item from another install is its own report', async () => {
    expect
      .soft((await post(report('install-other-a', 'lex.b'))).status)
      .toBe(201);
    expect
      .soft((await post(report('install-other-b', 'lex.b'))).status)
      .toBe(201);
  });

  it('can be reported again once resolved', async () => {
    await post(report('install-again', 'lex.a'));
    await db
      .prepare('DELETE FROM content_reports WHERE install_id = ?')
      .bind('install-again')
      .run();
    expect((await post(report('install-again', 'lex.a'))).status).toBe(201);
  });
});

describe("a new report clears the install's earlier days (#52 AC6)", () => {
  it("deletes quota rows for days before today and keeps today's", async () => {
    await db
      .prepare(
        'INSERT INTO content_report_quota (install_id, utc_day, n) VALUES (?, ?, ?)',
      )
      .bind('install-days', '2026-01-01', 10)
      .run();
    expect((await post(report('install-days', 'lex.a'))).status).toBe(201);
    expect(await quotaOf('install-days')).toEqual([{ utc_day: today(), n: 1 }]);
  });
});

describe('GET /v1/content-reports/health (#52 AC7)', () => {
  it('answers 200 when D1 answers', async () => {
    const response = await server.fetch(
      'https://sync.test/v1/content-reports/health',
    );
    expect.soft(response.status).toBe(200);
    expect.soft(await response.json()).toEqual({ ok: true });
  });
});
