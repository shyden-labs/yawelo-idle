import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from '../../../tests/support/create-covered-harness';
import { SECRETS } from './door';

/**
 * The first server tables (#162, spec §6.6 and §6.7): the migrations in
 * ../migrations, applied in order by wrangler's own migration runner to the
 * real local D1 of the real wrangler.jsonc (spec §12.4, nothing stood in), and the
 * schema read back from SQLite itself.
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

afterAll(async () => {
  await server.close();
});

interface Column {
  readonly name: string;
  readonly type: string;
  readonly notnull: number;
  readonly pk: number;
}

interface ForeignKey {
  readonly table: string;
  readonly from: string;
  readonly to: string;
  readonly on_delete: string;
}

const rows = async <T>(sql: string, ...bind: unknown[]): Promise<T[]> =>
  (
    await db
      .prepare(sql)
      .bind(...bind)
      .all<T>()
  ).results;

const columnsOf = (table: string) =>
  rows<Column>(
    'SELECT name, type, "notnull", pk FROM pragma_table_info(?) ORDER BY cid',
    table,
  );

const foreignKeysOf = (table: string) =>
  rows<ForeignKey>(
    'SELECT "table", "from", "to", on_delete FROM pragma_foreign_key_list(?) ORDER BY "from"',
    table,
  );

/** Every column an index covers, as `index: a,b`, unique ones marked. */
const indexesOf = async (table: string): Promise<string[]> => {
  const list = await rows<{ name: string; unique: number }>(
    'SELECT name, "unique" FROM pragma_index_list(?) ORDER BY name',
    table,
  );
  return Promise.all(
    list.map(async ({ name, unique }) => {
      const cols = await rows<{ name: string }>(
        'SELECT name FROM pragma_index_info(?) ORDER BY seqno',
        name,
      );
      return `${unique ? 'unique ' : ''}${cols.map((c) => c.name).join(',')}`;
    }),
  );
};

const col = (name: string, type: string, notnull: 0 | 1, pk = 0): Column => ({
  name,
  type,
  notnull,
  pk,
});

const cascadeTo = (table: string, from: string): ForeignKey => ({
  table,
  from,
  to: 'id',
  on_delete: 'CASCADE',
});

const HASH = (byte: number): Uint8Array => new Uint8Array(32).fill(byte);

const addPlayer = (id: string) =>
  db
    .prepare('INSERT INTO players (id, created_at) VALUES (?, 0)')
    .bind(id)
    .run();

describe('the migrations create exactly these tables (#162 AC1, AC2; #164 AC5; #52)', () => {
  it('and no others', async () => {
    const tables = await rows<{ name: string }>(
      `SELECT name FROM sqlite_schema WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
         AND name <> 'd1_migrations'
       ORDER BY name`,
    );
    expect(tables.map((t) => t.name)).toEqual([
      'content_report_quota',
      'content_reports',
      'devices',
      'pairings',
      'players',
      'rate_counts',
      'save_versions',
      'saves',
    ]);
  });

  it('content_reports (#52 AC4: no IP, user agent, name or email column)', async () => {
    expect
      .soft(await columnsOf('content_reports'))
      .toEqual([
        col('id', 'TEXT', 1, 1),
        col('created_at', 'INTEGER', 1),
        col('course', 'TEXT', 1),
        col('kind', 'TEXT', 1),
        col('item_id', 'TEXT', 1),
        col('problem', 'TEXT', 1),
        col('suggestion', 'TEXT', 0),
        col('note', 'TEXT', 0),
        col('app_version', 'TEXT', 1),
        col('content_version', 'TEXT', 1),
        col('install_id', 'TEXT', 1),
      ]);
    expect.soft(await foreignKeysOf('content_reports')).toEqual([]);
    expect
      .soft((await indexesOf('content_reports')).sort())
      .toEqual([
        'created_at',
        'unique id',
        'unique install_id,course,kind,item_id',
      ]);
  });

  it('content_report_quota', async () => {
    expect
      .soft(await columnsOf('content_report_quota'))
      .toEqual([
        col('install_id', 'TEXT', 1, 1),
        col('utc_day', 'TEXT', 1, 2),
        col('n', 'INTEGER', 1),
      ]);
    expect.soft(await foreignKeysOf('content_report_quota')).toEqual([]);
    expect
      .soft((await indexesOf('content_report_quota')).sort())
      .toEqual(['unique install_id,utc_day']);
  });

  it('players', async () => {
    expect
      .soft(await columnsOf('players'))
      .toEqual([col('id', 'TEXT', 1, 1), col('created_at', 'INTEGER', 1)]);
    expect.soft(await foreignKeysOf('players')).toEqual([]);
  });

  it('devices', async () => {
    expect
      .soft(await columnsOf('devices'))
      .toEqual([
        col('id', 'TEXT', 1, 1),
        col('player_id', 'TEXT', 1),
        col('token_hash', 'BLOB', 1),
        col('name', 'TEXT', 0),
        col('created_at', 'INTEGER', 1),
        col('revoked_at', 'INTEGER', 0),
      ]);
    expect
      .soft(await foreignKeysOf('devices'))
      .toEqual([cascadeTo('players', 'player_id')]);
    expect
      .soft((await indexesOf('devices')).sort())
      .toEqual(['player_id', 'unique id', 'unique token_hash']);
  });

  it('saves', async () => {
    expect
      .soft(await columnsOf('saves'))
      .toEqual([
        col('id', 'TEXT', 1, 1),
        col('player_id', 'TEXT', 1),
        col('course', 'TEXT', 1),
        col('version', 'INTEGER', 1),
        col('updated_at', 'INTEGER', 1),
      ]);
    expect
      .soft(await foreignKeysOf('saves'))
      .toEqual([cascadeTo('players', 'player_id')]);
    expect
      .soft((await indexesOf('saves')).sort())
      .toEqual(['unique id', 'unique player_id,course']);
  });

  it('save_versions', async () => {
    expect
      .soft(await columnsOf('save_versions'))
      .toEqual([
        col('save_id', 'TEXT', 1, 1),
        col('version', 'INTEGER', 1, 2),
        col('ciphertext', 'BLOB', 1),
        col('created_at', 'INTEGER', 1),
      ]);
    expect
      .soft(await foreignKeysOf('save_versions'))
      .toEqual([cascadeTo('saves', 'save_id')]);
    expect
      .soft(await indexesOf('save_versions'))
      .toEqual(['unique save_id,version']);
  });

  it('pairings', async () => {
    expect
      .soft(await columnsOf('pairings'))
      .toEqual([
        col('id', 'TEXT', 1, 1),
        col('player_id', 'TEXT', 1),
        col('kind', 'TEXT', 1),
        col('secret_hash', 'BLOB', 1),
        col('save_key', 'BLOB', 0),
        col('attempts', 'INTEGER', 1),
        col('expires_at', 'INTEGER', 1),
        col('created_at', 'INTEGER', 1),
      ]);
    expect
      .soft(await foreignKeysOf('pairings'))
      .toEqual([cascadeTo('players', 'player_id')]);
    expect
      .soft((await indexesOf('pairings')).sort())
      .toEqual(['expires_at', 'player_id', 'unique id', 'unique secret_hash']);
  });
});

describe('a save keeps its last five versions (#162 AC3)', () => {
  it('the sixth evicts the oldest in the same statement, and no save ever holds more than five', async () => {
    await addPlayer('p-versions');
    await db
      .prepare(
        "INSERT INTO saves (id, player_id, course, version, updated_at) VALUES ('s-1', 'p-versions', 'en-id', 1, 0)",
      )
      .run();
    const insert = db.prepare(
      "INSERT INTO save_versions (save_id, version, ciphertext, created_at) VALUES ('s-1', ?, x'00', 0)",
    );
    const heldAfter: number[][] = [];
    for (let version = 1; version <= 7; version += 1) {
      // runtime population: each insert's effect depends on every earlier one
      await insert.bind(version).run();
      const held = await rows<{ version: number }>(
        "SELECT version FROM save_versions WHERE save_id = 's-1' ORDER BY version",
      );
      heldAfter.push(held.map((r) => r.version));
    }
    expect(heldAfter).toEqual([
      [1],
      [1, 2],
      [1, 2, 3],
      [1, 2, 3, 4],
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 6],
      [3, 4, 5, 6, 7],
    ]);
  });

  it("evicts only that save's versions", async () => {
    await addPlayer('p-two-saves');
    await db.batch([
      db.prepare(
        "INSERT INTO saves (id, player_id, course, version, updated_at) VALUES ('s-a', 'p-two-saves', 'en-id', 1, 0)",
      ),
      db.prepare(
        "INSERT INTO saves (id, player_id, course, version, updated_at) VALUES ('s-b', 'p-two-saves', 'id-en', 1, 0)",
      ),
      ...[1, 2, 3, 4, 5].map((v) =>
        db
          .prepare(
            "INSERT INTO save_versions (save_id, version, ciphertext, created_at) VALUES ('s-a', ?, x'00', 0)",
          )
          .bind(v),
      ),
      ...[1, 2, 3, 4, 5, 6].map((v) =>
        db
          .prepare(
            "INSERT INTO save_versions (save_id, version, ciphertext, created_at) VALUES ('s-b', ?, x'00', 0)",
          )
          .bind(v),
      ),
    ]);
    const held = await rows<{ save_id: string; n: number; low: number }>(
      "SELECT save_id, count(*) AS n, min(version) AS low FROM save_versions WHERE save_id IN ('s-a', 's-b') GROUP BY save_id ORDER BY save_id",
    );
    expect(held).toEqual([
      { save_id: 's-a', n: 5, low: 1 },
      { save_id: 's-b', n: 5, low: 2 },
    ]);
  });

  it('refuses a course that does not exist', async () => {
    await addPlayer('p-course');
    await expect(
      db
        .prepare(
          "INSERT INTO saves (id, player_id, course, version, updated_at) VALUES ('s-x', 'p-course', 'en-fr', 1, 0)",
        )
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe('device tokens are stored only as SHA-256 hashes (#162 AC4)', () => {
  it('no devices column holds a token but token_hash', async () => {
    const names = (await columnsOf('devices')).map((c) => c.name);
    expect(names.filter((n) => n.includes('token'))).toEqual(['token_hash']);
  });

  it('a 32-byte hash is stored and read back as those bytes', async () => {
    await addPlayer('p-hash');
    await db
      .prepare(
        "INSERT INTO devices (id, player_id, token_hash, created_at) VALUES ('d-hash', 'p-hash', ?, 0)",
      )
      .bind(HASH(7))
      .run();
    const [row] = await rows<{ kind: string; n: number }>(
      "SELECT typeof(token_hash) AS kind, length(token_hash) AS n FROM devices WHERE id = 'd-hash'",
    );
    expect(row).toEqual({ kind: 'blob', n: 32 });
  });

  it.each([
    ['a raw token as text', 'tok_abcdefghijklmnopqrstuvwxyz012345'],
    ['a hash as hex text', 'ab'.repeat(32)],
    ['31 bytes', new Uint8Array(31)],
    ['33 bytes', new Uint8Array(33)],
  ])('refuses %s', async (label, token) => {
    await addPlayer(`p-refuse-${label}`);
    await expect(
      db
        .prepare(
          'INSERT INTO devices (id, player_id, token_hash, created_at) VALUES (?, ?, ?, 0)',
        )
        .bind(`d-${label}`, `p-refuse-${label}`, token)
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe('pairings hold what spec §6.6 allows (#162 AC1)', () => {
  it('a QR pairing carries no save key, and a code pairing carries a 32-byte one', async () => {
    await addPlayer('p-pair');
    const pair = (id: string, kind: string, secret: number, key: unknown) =>
      db
        .prepare(
          "INSERT INTO pairings (id, player_id, kind, secret_hash, save_key, expires_at, created_at) VALUES (?, 'p-pair', ?, ?, ?, 600000, 0)",
        )
        .bind(id, kind, HASH(secret), key)
        .run();
    await expect.soft(pair('qr-ok', 'qr', 1, null)).resolves.toBeDefined();
    await expect
      .soft(pair('code-ok', 'code', 2, HASH(9)))
      .resolves.toBeDefined();
    await expect
      .soft(pair('qr-key', 'qr', 3, HASH(9)))
      .rejects.toThrow(/CHECK constraint failed/);
    await expect
      .soft(pair('code-nokey', 'code', 4, null))
      .rejects.toThrow(/CHECK constraint failed/);
    await expect
      .soft(pair('code-short', 'code', 5, new Uint8Array(16)))
      .rejects.toThrow(/CHECK constraint failed/);
    await expect
      .soft(pair('other-kind', 'nfc', 6, null))
      .rejects.toThrow(/CHECK constraint failed/);
  });

  it('refuses a sixth claim attempt', async () => {
    await addPlayer('p-attempts');
    await db
      .prepare(
        "INSERT INTO pairings (id, player_id, kind, secret_hash, save_key, attempts, expires_at, created_at) VALUES ('pa', 'p-attempts', 'code', ?, ?, 5, 600000, 0)",
      )
      .bind(HASH(11), HASH(12))
      .run();
    await expect(
      db
        .prepare("UPDATE pairings SET attempts = attempts + 1 WHERE id = 'pa'")
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe('a player owns their rows (#162 AC1 foreign keys)', () => {
  it('a device of no player is refused', async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO devices (id, player_id, token_hash, created_at) VALUES ('d-orphan', 'nobody', ?, 0)",
        )
        .bind(HASH(3))
        .run(),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
  });

  it('deleting a player deletes their devices, saves, save versions and pairings', async () => {
    await addPlayer('p-gone');
    await db.batch([
      db
        .prepare(
          "INSERT INTO devices (id, player_id, token_hash, created_at) VALUES ('d-gone', 'p-gone', ?, 0)",
        )
        .bind(HASH(21)),
      db.prepare(
        "INSERT INTO saves (id, player_id, course, version, updated_at) VALUES ('s-gone', 'p-gone', 'en-id', 1, 0)",
      ),
      db.prepare(
        "INSERT INTO save_versions (save_id, version, ciphertext, created_at) VALUES ('s-gone', 1, x'00', 0)",
      ),
      db
        .prepare(
          "INSERT INTO pairings (id, player_id, kind, secret_hash, expires_at, created_at) VALUES ('pr-gone', 'p-gone', 'qr', ?, 600000, 0)",
        )
        .bind(HASH(22)),
    ]);
    await db.prepare("DELETE FROM players WHERE id = 'p-gone'").run();
    const [left] = await rows<Record<string, number>>(
      `SELECT
         (SELECT count(*) FROM devices WHERE id = 'd-gone') AS devices,
         (SELECT count(*) FROM saves WHERE id = 's-gone') AS saves,
         (SELECT count(*) FROM save_versions WHERE save_id = 's-gone') AS save_versions,
         (SELECT count(*) FROM pairings WHERE id = 'pr-gone') AS pairings`,
    );
    expect(left).toEqual({
      devices: 0,
      saves: 0,
      save_versions: 0,
      pairings: 0,
    });
  });
});
