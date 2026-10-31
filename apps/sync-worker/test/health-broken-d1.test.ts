import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unstable_startWorker } from 'wrangler';

/**
 * The real sync Worker against a really broken D1 (#817; Shyden's ruling on
 * #813: try a real failure, no injected throw).
 *
 * wrangler's test harness keeps D1 in memory, so this file starts the real
 * Worker from the real wrangler.jsonc with its local D1 on disk instead. A
 * first start answers healthy and writes the database file; the file is then
 * overwritten with text that is not SQLite, and a second start is asked
 * again. workerd's own D1 fails on it (measured 2026-11-01: `internal error;
 * reference = …`), and what the Worker logs is read from workerd's
 * structured logs, as Cloudflare would record them.
 */
const CONFIG = new URL('../wrangler.jsonc', import.meta.url).pathname;
const D1_DIR = 'v3/d1/miniflare-D1DatabaseObject';
/** How long the error log may trail the 503 (it arrived within 500 ms locally). */
const LOG_CEILING_MS = 5_000;

interface Log {
  readonly level: string;
  readonly message: string;
}

/**
 * The Worker's own error lines. workerd also logs its SQLite failure at error
 * level on Linux (`SQLITE_NOTADB`, CI 2026-11-01) but not on macOS, so the
 * runtime's lines are not counted.
 */
const workerErrors = (all: readonly Log[]): Log[] =>
  all.filter(
    (log) => log.level === 'error' && log.message.startsWith('health:'),
  );

const persist = mkdtempSync(join(tmpdir(), 'sync-broken-d1-'));
const logs: Log[] = [];

const start = () =>
  unstable_startWorker({
    config: CONFIG,
    dev: {
      persist,
      server: { port: 0 },
      inspector: false,
      watch: false,
      structuredLogsHandler: (log: Log) => logs.push(log),
    },
  });

/** What a /health answer said, read before its Worker is disposed. */
interface Answer {
  readonly status: number;
  readonly cacheControl: string | null;
  readonly body: unknown;
}

const health = async (
  worker: Awaited<ReturnType<typeof start>>,
): Promise<Answer> => {
  const response = await worker.fetch('http://sync.test/health');
  return {
    status: response.status,
    cacheControl: response.headers.get('cache-control'),
    body: await response.json(),
  };
};

let healthy: Answer;
let broken: Answer;

beforeAll(async () => {
  const first = await start();
  healthy = await health(first);
  await first.dispose();

  // The database files are every file but miniflare's own metadata store.
  const files = readdirSync(join(persist, D1_DIR)).filter(
    (name) => !name.startsWith('metadata.sqlite'),
  );
  const databases = files.filter((name) => name.endsWith('.sqlite'));
  if (databases.length !== 1) {
    throw new Error(
      `expected one D1 database file in ${D1_DIR}, found: ${files.join(', ') || 'none'}`,
    );
  }
  for (const name of files) rmSync(join(persist, D1_DIR, name));
  writeFileSync(
    join(persist, D1_DIR, databases[0] as string),
    'this is not a SQLite database (#817)\n'.repeat(200),
  );

  logs.length = 0;
  const second = await start();
  try {
    broken = await health(second);
    // workerd delivers its logs after the answer: wait for the error line,
    // up to a stated ceiling, before disposing the Worker that writes it.
    const ceiling = Date.now() + LOG_CEILING_MS;
    while (workerErrors(logs).length === 0) {
      if (Date.now() > ceiling) {
        throw new Error(
          `no "health:" error log within ${String(LOG_CEILING_MS)} ms of the 503; logs: ${JSON.stringify(logs)}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } finally {
    await second.dispose();
  }
});

afterAll(() => {
  rmSync(persist, { recursive: true, force: true });
});

describe('GET /health against a really broken D1 (#817)', () => {
  it('answers healthy before the database file is broken', () => {
    expect(healthy.status).toBe(200);
    expect(healthy.body).toEqual({
      ok: true,
      commit: 'local',
      db: 'ok',
    });
  });

  it('answers 503, saying only that D1 is unreachable', () => {
    expect(broken.status).toBe(503);
    expect(broken.cacheControl).toBe('no-store');
    expect(broken.body).toEqual({
      ok: false,
      commit: 'local',
      db: 'unreachable',
    });
  });

  it("logs D1's own error once, so a 503 can be diagnosed from the Worker logs", () => {
    const errors = workerErrors(logs);
    expect(errors, JSON.stringify(logs)).toHaveLength(1);
    expect(errors[0]?.message).toMatch(
      /^health: D1 query failed Error: internal error; reference = /,
    );
  });
});
