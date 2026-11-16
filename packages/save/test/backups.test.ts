import { sha256 } from '@noble/hashes/sha2.js';
import { deflateSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  BACKUPS,
  save,
  saveBackups,
  type Save,
  type BackupStorage,
} from '../src/index.ts';
import { newGame } from './states.ts';

/**
 * The latest save and its 5 rotating backups (#160 AC1, AC3 to AC5), over a
 * storage in memory whose failures are injected. Real IndexedDB on every
 * target is tests/engines/save-backups.spec.ts (AC6); when the writes happen,
 * packages/ui's backup scheduler (AC2).
 */

/** The n-th save of a run, told apart by its content build. */
const nth = (n: number): Save => save(newGame(), {}, `build-${String(n)}`);

type Hook = (key: string, bytes?: Uint8Array) => void;

/** A storage in memory; each hook runs before its call and may throw. */
function memory(hooks: { set?: Hook; delete?: Hook; get?: Hook } = {}) {
  const held = new Map<string, Uint8Array>();
  const storage: BackupStorage = {
    get(key) {
      hooks.get?.(key);
      return Promise.resolve(held.get(key));
    },
    set(key, bytes) {
      hooks.set?.(key, bytes);
      held.set(key, Uint8Array.from(bytes));
      return Promise.resolve();
    },
    delete(key) {
      hooks.delete?.(key);
      held.delete(key);
      return Promise.resolve();
    },
    keys() {
      return Promise.resolve([...held.keys()].sort());
    },
  };
  return { storage, held };
}

/** The content build of what `read` loaded, or what it found instead. */
async function readBuild(storage: BackupStorage): Promise<unknown> {
  const read = await saveBackups(storage).read();
  return read.kind === 'loaded'
    ? { build: read.save.contentVersion, back: read.back }
    : read;
}

async function writeAll(storage: BackupStorage, from: number, to: number) {
  const copies = saveBackups(storage);
  for (let n = from; n <= to; n += 1) {
    // runtime population: each write's effect depends on the ones before it
    const result = await copies.write(nth(n));
    expect(result.written, `write ${String(n)}`).toBe(true);
  }
}

/** Spoils the copy under `key` in place, as a damaged disk would. */
function spoil(held: Map<string, Uint8Array>, key: string) {
  const bytes = held.get(key);
  if (bytes === undefined) throw new Error(`no copy ${key}`);
  bytes[bytes.byteLength - 1] = (bytes[bytes.byteLength - 1] ?? 0) ^ 0xff;
}

/**
 * A copy's key: `save/`, a 12-digit counter, so string order is write order,
 * then `.` and the time it was written, in ms since the epoch.
 */
const COPY_KEY = /^save\/\d{12}\.\d+$/;

/** The key the next write would take after `keys`. */
const nextKey = (keys: readonly string[]): string =>
  `save/${String(Number(keys.at(-1)?.slice(5, 17) ?? '0') + 1).padStart(12, '0')}.0`;

/** A clock that reads each of `times` in turn, then stays on the last. */
const clock = (...times: number[]) => {
  let i = 0;
  return () => times[Math.min(i++, times.length - 1)] ?? 0;
};

const copyKeys = (held: Map<string, Uint8Array>) =>
  [...held.keys()].filter((k) => k.startsWith('save/')).sort();

const QUOTA = (): never => {
  throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
};

describe('the latest save and its backups (#160 AC1)', () => {
  it('nothing written reads as empty', async () => {
    expect(await readBuild(memory().storage)).toEqual({ kind: 'empty' });
  });

  it('a written save reads back as the latest, 0 copies back', async () => {
    const { storage } = memory();
    const saved = nth(1);
    expect(await saveBackups(storage).write(saved)).toMatchObject({
      written: true,
    });
    expect(await saveBackups(storage).read()).toMatchObject({
      kind: 'loaded',
      save: saved,
      back: 0,
    });
  });

  it('a loaded save carries the time its copy was written', async () => {
    const { storage } = memory();
    await saveBackups(storage, undefined, clock(1_700_000_000_000)).write(
      nth(1),
    );
    expect(await saveBackups(storage).read()).toMatchObject({
      kind: 'loaded',
      savedAt: 1_700_000_000_000,
    });
  });

  it('keeps the latest save and 5 backups: the sixth write keeps all six', async () => {
    const { storage, held } = memory();
    await writeAll(storage, 1, 1 + BACKUPS);
    expect.soft(copyKeys(held)).toHaveLength(1 + BACKUPS);
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-6', back: 0 });
  });

  it('the seventh write drops the oldest, and only it', async () => {
    const { storage, held } = memory();
    await writeAll(storage, 1, 6);
    const before = copyKeys(held);
    await writeAll(storage, 7, 7);
    const after = copyKeys(held);
    expect.soft(after).toHaveLength(6);
    expect.soft(after).toEqual([...before.slice(1), after[5]]);
    expect.soft(after).not.toContain(before[0]);
  });

  it('each write takes a key no copy has held, in order', async () => {
    const { storage } = memory();
    const keys: string[] = [];
    const copies = saveBackups(storage);
    for (let n = 1; n <= 8; n += 1) {
      // runtime population: each key depends on the writes before it
      const result = await copies.write(nth(n));
      if (result.written) keys.push(result.key);
    }
    expect.soft(new Set(keys).size).toBe(8);
    expect.soft([...keys].sort()).toEqual(keys);
    expect.soft(keys.filter((k) => !COPY_KEY.test(k))).toEqual([]);
  });

  it('leaves other keys in the storage alone and does not read them as saves', async () => {
    const { storage, held } = memory();
    held.set('settings', strToU8('not a save'));
    await writeAll(storage, 1, 8);
    expect.soft(held.get('settings')).toEqual(strToU8('not a save'));
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-8', back: 0 });
  });

  it('a new set of copies over the same storage carries on from its keys', async () => {
    const { storage, held } = memory();
    await writeAll(storage, 1, 3);
    await writeAll(storage, 4, 4);
    expect.soft(copyKeys(held)).toHaveLength(4);
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-4', back: 0 });
  });
});

describe('a damaged save falls back to the newest backup that loads (#160 AC3)', () => {
  it('the latest damaged: the backup before it, 1 copy back', async () => {
    const { storage, held } = memory();
    await writeAll(storage, 1, 3);
    spoil(held, copyKeys(held)[2] ?? '');
    expect(await readBuild(storage)).toEqual({ build: 'build-2', back: 1 });
  });

  it('a fall-back carries the write time of the backup it loaded', async () => {
    const { storage, held } = memory();
    const copies = saveBackups(
      storage,
      undefined,
      clock(1_000, 31_000, 61_000),
    );
    for (let n = 1; n <= 3; n += 1) {
      // runtime population: each copy's time is the clock's next reading
      await copies.write(nth(n));
    }
    spoil(held, copyKeys(held)[2] ?? '');
    expect(await saveBackups(storage).read()).toMatchObject({
      back: 1,
      savedAt: 31_000,
    });
  });

  it('the latest and two backups damaged: 3 copies back', async () => {
    const { storage, held } = memory();
    await writeAll(storage, 1, 6);
    for (const key of copyKeys(held).slice(3)) spoil(held, key);
    expect(await readBuild(storage)).toEqual({ build: 'build-3', back: 3 });
  });

  it('every copy damaged: allCorrupt, naming how many, and nothing is reset', async () => {
    const { storage, held } = memory();
    await writeAll(storage, 1, 4);
    for (const key of copyKeys(held)) spoil(held, key);
    const spoiled = new Map([...held].map(([k, v]) => [k, Uint8Array.from(v)]));
    expect.soft(await readBuild(storage)).toEqual({
      kind: 'allCorrupt',
      copies: 4,
    });
    expect.soft(held).toEqual(spoiled);
  });

  it("the latest a newer app's save: updateTheApp, never an older backup", async () => {
    const { storage, held } = memory();
    await writeAll(storage, 1, 2);
    const newer = strToU8(JSON.stringify({ ...nth(3), saveVersion: 9 }));
    held.set(nextKey(copyKeys(held)), toBlobAround(newer));
    expect(await readBuild(storage)).toEqual({
      kind: 'updateTheApp',
      refusal: { kind: 'updateTheApp', saveVersion: 9, appSaveVersion: 1 },
    });
  });

  it("a write never covers a newer app's latest save", async () => {
    const { storage, held } = memory();
    await writeAll(storage, 1, 1);
    const newer = strToU8(JSON.stringify({ ...nth(2), saveVersion: 9 }));
    held.set(nextKey(copyKeys(held)), toBlobAround(newer));
    const before = copyKeys(held);
    expect.soft(await saveBackups(storage).write(nth(3))).toEqual({
      written: false,
      reason: 'updateTheApp',
    });
    expect.soft(copyKeys(held)).toEqual(before);
  });

  it('a write after a damaged latest keeps the damaged copy as a backup', async () => {
    const { storage, held } = memory();
    await writeAll(storage, 1, 2);
    const damaged = copyKeys(held)[1] ?? '';
    spoil(held, damaged);
    await writeAll(storage, 3, 3);
    expect.soft(copyKeys(held)).toContain(damaged);
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-3', back: 0 });
  });
});

describe('a failing storage leaves the previous good save (#160 AC4)', () => {
  it('quota exceeded', async () => {
    let full = false;
    const { storage } = memory({ set: () => (full ? QUOTA() : undefined) });
    await writeAll(storage, 1, 2);
    full = true;
    const result = await saveBackups(storage).write(nth(3));
    expect.soft(result).toMatchObject({
      written: false,
      reason: 'storageFailed',
    });
    expect
      .soft(result.written ? undefined : (result.error as DOMException).name)
      .toBe('QuotaExceededError');
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-2', back: 0 });
  });

  it('storage blocked: every call refused while it lasts', async () => {
    let blocked = false;
    const refuse = () => {
      if (blocked) throw new DOMException('blocked', 'InvalidStateError');
    };
    const { storage } = memory({ set: refuse, delete: refuse, get: refuse });
    await writeAll(storage, 1, 2);
    blocked = true;
    expect
      .soft(await saveBackups(storage).write(nth(3)))
      .toMatchObject({ written: false, reason: 'storageFailed' });
    blocked = false;
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-2', back: 0 });
  });

  it('a transaction aborting mid-write', async () => {
    let abort = false;
    const { storage } = memory({
      set: () => {
        if (abort) throw new DOMException('aborted', 'AbortError');
      },
    });
    await writeAll(storage, 1, 2);
    abort = true;
    expect
      .soft(await saveBackups(storage).write(nth(3)))
      .toMatchObject({ written: false, reason: 'storageFailed' });
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-2', back: 0 });
  });

  it('dropping an old copy failing after the new one is stored: the write stands', async () => {
    let failDelete = false;
    const { storage, held } = memory({
      delete: () => {
        if (failDelete) throw new DOMException('aborted', 'AbortError');
      },
    });
    await writeAll(storage, 1, 6);
    failDelete = true;
    expect
      .soft(await saveBackups(storage).write(nth(7)))
      .toMatchObject({ written: true });
    expect.soft(copyKeys(held)).toHaveLength(7);
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-7', back: 0 });
  });
});

describe('a crash mid-write spoils at most the copy being written (#160 AC5)', () => {
  /** A crash while the new copy is stored: half its bytes land, then it stops. */
  const crashingOnce = () => {
    let crash = false;
    const box = memory({
      set: (key, bytes) => {
        if (!crash || bytes === undefined) return;
        crash = false;
        box.held.set(key, bytes.subarray(0, bytes.byteLength >> 1));
        throw new Error('the app was killed mid-write');
      },
    });
    return { ...box, crashNext: () => (crash = true) };
  };

  it('the crashed write leaves one damaged copy, and the save before it loads', async () => {
    const { storage, held, crashNext } = crashingOnce();
    await writeAll(storage, 1, 3);
    crashNext();
    await saveBackups(storage).write(nth(4));
    const damaged = await Promise.all(
      copyKeys(held).map(async (key) => {
        const one = memory();
        await one.storage.set(key, held.get(key) ?? new Uint8Array());
        return (await saveBackups(one.storage).read()).kind !== 'loaded';
      }),
    );
    expect.soft(damaged.filter(Boolean)).toHaveLength(1);
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-3', back: 1 });
  });

  it('the next write after a crash makes no second damaged copy', async () => {
    const { storage, held, crashNext } = crashingOnce();
    await writeAll(storage, 1, 3);
    crashNext();
    await saveBackups(storage).write(nth(4));
    await writeAll(storage, 5, 5);
    const loads = await Promise.all(
      copyKeys(held).map(async (key) => {
        const one = memory();
        await one.storage.set(key, held.get(key) ?? new Uint8Array());
        return (await saveBackups(one.storage).read()).kind === 'loaded';
      }),
    );
    expect.soft(loads.filter((ok) => !ok)).toHaveLength(1);
    expect
      .soft(await readBuild(storage))
      .toEqual({ build: 'build-5', back: 0 });
  });
});

/** A blob around any `bytes`, with a correct checksum, as toBlob lays it out. */
function toBlobAround(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from([
    0x59,
    0x49,
    0x53,
    0x56,
    32,
    ...sha256(bytes),
    ...deflateSync(bytes, { level: 6 }),
  ]);
}
