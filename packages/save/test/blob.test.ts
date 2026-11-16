import { sha256 } from '@noble/hashes/sha2.js';
import { deflateSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  canonicalBytes,
  loadBlob,
  save,
  toBlob,
  type LoadResult,
  type Save,
} from '../src/index.ts';
import { CONTENT_VERSION, newGame, played } from './states.ts';

/**
 * A save as stored bytes (#159 AC1, AC3). Every single-byte flip is a
 * property over positions in properties/blob.test.ts (AC2); the cost of a
 * 5-week save is blob-cost.test.ts (AC4); the same bytes in every engine,
 * tests/engines/save-blob.spec.ts (AC5).
 *
 * The blob: the four bytes "YISV", one byte giving the checksum's length
 * (32), the SHA-256 of the canonical bytes, then the canonical bytes as raw
 * DEFLATE.
 */
const MAGIC = [0x59, 0x49, 0x53, 0x56];
const HEADER = MAGIC.length + 1 + 32;

const playedSave = (): Save => save(played(), {}, CONTENT_VERSION);

const refusalOf = (result: LoadResult): unknown =>
  result.ok ? 'loaded' : result.refusal;

const corrupt = (reason: string) => ({ kind: 'corrupt', reason });

/** A blob built by hand around `bytes`, with a correct checksum of them. */
const blobAround = (bytes: Uint8Array): Uint8Array =>
  Uint8Array.from([
    ...MAGIC,
    32,
    ...sha256(bytes),
    ...deflateSync(bytes, { level: 6 }),
  ]);

describe('canonicalBytes (#159 AC1)', () => {
  it('is UTF-8 JSON that parses back to the save', () => {
    const saved = playedSave();
    const text = new TextDecoder('utf-8', { fatal: true }).decode(
      canonicalBytes(saved),
    );
    expect(JSON.parse(text)).toEqual(saved);
  });

  it('writes object keys in code-unit order, however the object was built', () => {
    const saved = playedSave();
    const reversed = Object.fromEntries(
      Object.entries(saved).reverse(),
    ) as unknown as Save;
    const text = new TextDecoder().decode(canonicalBytes(reversed));
    expect.soft(text.startsWith('{"contentVersion":')).toBe(true);
    expect.soft(canonicalBytes(reversed)).toEqual(canonicalBytes(saved));
  });

  it('refuses a number JSON cannot hold, by its path', () => {
    const saved = playedSave();
    const spoiled = {
      ...saved,
      state: { ...saved.state, sim: Number.NaN },
    } as unknown as Save;
    expect(() => canonicalBytes(spoiled)).toThrow(/state\.sim/);
  });
});

describe('toBlob (#159 AC1)', () => {
  it('starts with "YISV", the checksum length and the SHA-256 of the canonical bytes', () => {
    const saved = playedSave();
    const blob = toBlob(saved);
    expect.soft([...blob.subarray(0, 4)]).toEqual(MAGIC);
    expect.soft(blob[4]).toBe(32);
    expect
      .soft(blob.subarray(5, HEADER))
      .toEqual(sha256(canonicalBytes(saved)));
  });

  it('compresses: the blob is smaller than the canonical bytes', () => {
    const saved = playedSave();
    expect(toBlob(saved).byteLength).toBeLessThan(
      canonicalBytes(saved).byteLength,
    );
  });

  it('writes the same bytes for the same save', () => {
    expect(toBlob(playedSave())).toEqual(toBlob(playedSave()));
  });
});

describe('loadBlob reads back what toBlob wrote (#159 AC1)', () => {
  it('a played game', () => {
    const saved = playedSave();
    expect(loadBlob(toBlob(saved))).toEqual({
      ok: true,
      save: saved,
      migratedFrom: 1,
    });
  });

  it('a new game', () => {
    const saved = save(newGame(), {}, CONTENT_VERSION);
    expect(loadBlob(toBlob(saved))).toEqual({
      ok: true,
      save: saved,
      migratedFrom: 1,
    });
  });

  it("passes the save's own refusals through: a newer app's save is updateTheApp", () => {
    const newer = strToU8(JSON.stringify({ ...playedSave(), saveVersion: 99 }));
    expect(refusalOf(loadBlob(blobAround(newer)))).toEqual({
      kind: 'updateTheApp',
      saveVersion: 99,
      appSaveVersion: 1,
    });
  });
});

describe('a damaged blob is refused by a typed reason, never thrown (#159 AC3)', () => {
  it('not bytes: a string', () => {
    expect(refusalOf(loadBlob('YISV'))).toEqual(corrupt('notBytes'));
  });

  it('not bytes: an ArrayBuffer', () => {
    expect(refusalOf(loadBlob(new ArrayBuffer(64)))).toEqual(
      corrupt('notBytes'),
    );
  });

  it('empty', () => {
    expect(refusalOf(loadBlob(new Uint8Array(0)))).toEqual(corrupt('empty'));
  });

  it('another kind of file: a PNG', () => {
    const png = Uint8Array.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...new Uint8Array(40),
    ]);
    expect(refusalOf(loadBlob(png))).toEqual(corrupt('notASaveBlob'));
  });

  it('truncated inside the header', () => {
    expect(
      refusalOf(loadBlob(toBlob(playedSave()).subarray(0, HEADER - 1))),
    ).toEqual(corrupt('truncated'));
  });

  it('truncated inside the magic', () => {
    expect(refusalOf(loadBlob(Uint8Array.from(MAGIC.slice(0, 2))))).toEqual(
      corrupt('truncated'),
    );
  });

  it('truncated with no body', () => {
    expect(
      refusalOf(loadBlob(toBlob(playedSave()).subarray(0, HEADER))),
    ).toEqual(corrupt('truncated'));
  });

  it('truncated by its last byte', () => {
    const blob = toBlob(playedSave());
    expect(refusalOf(loadBlob(blob.subarray(0, blob.byteLength - 1)))).toEqual(
      corrupt('truncated'),
    );
  });

  it('a checksum field of 31 bytes', () => {
    const blob = Uint8Array.from(toBlob(playedSave()));
    blob[4] = 31;
    expect(refusalOf(loadBlob(blob))).toEqual(corrupt('checksumLength'));
  });

  it('a checksum field of 33 bytes', () => {
    const blob = Uint8Array.from(toBlob(playedSave()));
    blob[4] = 33;
    expect(refusalOf(loadBlob(blob))).toEqual(corrupt('checksumLength'));
  });

  it('a body that is not DEFLATE', () => {
    const blob = Uint8Array.from(toBlob(playedSave()));
    blob.fill(0xff, HEADER);
    expect(refusalOf(loadBlob(blob))).toEqual(corrupt('badCompression'));
  });

  it('a checksum that is not of the body', () => {
    const blob = Uint8Array.from(toBlob(playedSave()));
    blob[5] = (blob[5] ?? 0) ^ 0x01;
    expect(refusalOf(loadBlob(blob))).toEqual(corrupt('checksumMismatch'));
  });

  it('bytes after the compressed body', () => {
    const blob = toBlob(playedSave());
    expect(refusalOf(loadBlob(Uint8Array.from([...blob, 0x00])))).toEqual(
      corrupt('notCanonical'),
    );
  });

  it('a body compressed by another writer', () => {
    const bytes = canonicalBytes(playedSave());
    const other = Uint8Array.from([
      ...MAGIC,
      32,
      ...sha256(bytes),
      ...deflateSync(bytes, { level: 1 }),
    ]);
    expect(refusalOf(loadBlob(other))).toEqual(corrupt('notCanonical'));
  });

  it('a checksummed body that is not JSON', () => {
    expect(refusalOf(loadBlob(blobAround(strToU8('{"not json'))))).toEqual(
      corrupt('notJson'),
    );
  });

  it('a checksummed body that is not UTF-8', () => {
    expect(
      refusalOf(loadBlob(blobAround(Uint8Array.from([0x7b, 0xff, 0x7d])))),
    ).toEqual(corrupt('notJson'));
  });
});
