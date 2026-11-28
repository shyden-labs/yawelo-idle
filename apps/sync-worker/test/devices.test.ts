import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness } from '../../../tests/support/create-covered-harness';
import { SECRETS, throughDoor } from './door';

/**
 * POST /v1/devices (#163; spec §6.6, D6): an anonymous device registers and
 * gets `playerId` and a token, returned once; D1 keeps only the token's
 * SHA-256. Served by wrangler's harness from the real wrangler.jsonc, on a
 * real local D1 (#506).
 */
const ROOT = new URL('..', import.meta.url).pathname;

const server = createTestHarness({
  root: ROOT,
  // The key request counts are hashed under (#164 AC2), as the deploy sets it.
  workers: [
    {
      configPath: './wrangler.jsonc',
      secrets: SECRETS,
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

// Registration is limited to 10 an hour per network (#164 AC2); every test
// here starts from no counts, so the limit never decides a registration test.
beforeEach(async () => {
  await db.prepare('DELETE FROM rate_counts').run();
});

afterAll(async () => {
  await server.close();
});

const register = (body: string, method = 'POST') =>
  server.fetch(
    'https://sync.test/v1/devices',
    throughDoor({
      method,
      headers: { 'content-type': 'application/json' },
      ...(method === 'GET' ? {} : { body }),
    }),
  );

interface Registered {
  readonly playerId: string;
  readonly token: string;
}

const registered = async (): Promise<Registered> => {
  const response = await register('{}');
  if (response.status !== 201)
    throw new Error(`registration answered ${String(response.status)}`);
  return (await response.json()) as Registered;
};

interface DeviceRow {
  readonly id: string;
  readonly player_id: string;
  readonly token_hash: ArrayBuffer;
  readonly name: string | null;
  readonly created_at: number;
  readonly revoked_at: number | null;
}

const deviceOf = async (playerId: string): Promise<DeviceRow | null> =>
  db
    .prepare('SELECT * FROM devices WHERE player_id = ?')
    .bind(playerId)
    .first<DeviceRow>();

const count = async (table: 'players' | 'devices'): Promise<number> =>
  (
    await db
      .prepare(`SELECT count(*) AS n FROM ${table}`)
      .first<{ n: number }>()
  )?.n ?? -1;

describe('POST /v1/devices (#163 AC1, AC4)', () => {
  it('answers 201 with a playerId and a 43-character token, never cached', async () => {
    const response = await register('{}');
    const body = (await response.json()) as Record<string, unknown>;
    expect({
      status: response.status,
      cache: response.headers.get('cache-control'),
      keys: Object.keys(body).sort(),
      token: body.token,
    }).toEqual({
      status: 201,
      cache: 'no-store',
      keys: ['playerId', 'token'],
      token: expect.stringMatching(/^[\w-]{43}$/) as unknown,
    });
  });

  it('stores the token only as its SHA-256', async () => {
    const { playerId, token } = await registered();
    const row = await deviceOf(playerId);
    expect(Buffer.from(row?.token_hash ?? new ArrayBuffer(0))).toEqual(
      createHash('sha256').update(token, 'utf8').digest(),
    );
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('creates the player and one live, unnamed device for it', async () => {
    const { playerId } = await registered();
    const player = await db
      .prepare('SELECT id FROM players WHERE id = ?')
      .bind(playerId)
      .first<{ id: string }>();
    const device = await deviceOf(playerId);
    expect({
      player: player?.id,
      name: device?.name,
      revoked: device?.revoked_at,
    }).toEqual({ player: playerId, name: null, revoked: null });
  });

  it('gives each registration its own player and token', async () => {
    const [first, second] = [await registered(), await registered()];
    expect(second.playerId).not.toBe(first.playerId);
    expect(second.token).not.toBe(first.token);
  });
});

describe('POST /v1/devices refuses (#163 AC3)', () => {
  it('a body with any field, adding no row', async () => {
    const before = [await count('players'), await count('devices')];
    const response = await register('{"name":"Ana"}');
    expect([response.status, await response.json()]).toEqual([
      422,
      { error: 'invalid_field', field: 'name' },
    ]);
    expect([await count('players'), await count('devices')]).toEqual(before);
  });

  it('a body that is not JSON', async () => {
    expect((await register('{not json')).status).toBe(400);
  });

  it('any method but POST, naming POST', async () => {
    const response = await register('', 'GET');
    expect([response.status, response.headers.get('allow')]).toEqual([
      405,
      'POST',
    ]);
  });
});
