import { describe, expect, it } from 'vitest';
import {
  SAVE_KEY_LENGTH,
  SAVE_KEY_NAME,
  SaveOpenError,
  findKeyLeak,
  loadOrCreateSaveKey,
  openSave,
  sealSave,
  type OpenFailure,
  type OutgoingRequest,
  type SaveKeyStore,
} from '../src/seal';

/**
 * #165: the device's save key `K` and sealed saves (AES-256-GCM). The chosen
 * cases live here; any save, any changed byte and the 10,000-seal IV count
 * are the properties suite's (properties/seal.test.ts): the count takes over
 * a second on CI's runner, past the unit suite's limit.
 */

/** A store backed by a Map, recording which keys were written. */
function storeOf(start: Record<string, Uint8Array> = {}) {
  const map = new Map(Object.entries(start));
  const written: string[] = [];
  const store: SaveKeyStore = {
    get: (name) => Promise.resolve(map.get(name)),
    set: (name, bytes) => {
      written.push(name);
      map.set(name, bytes);
      return Promise.resolve();
    },
  };
  return { store, map, written };
}

const K = new Uint8Array(SAVE_KEY_LENGTH).fill(7);
const OTHER = new Uint8Array(SAVE_KEY_LENGTH).fill(9);
const SAVE = new TextEncoder().encode('{"saveVersion":1,"coins":"5e2"}');

/** Magic (4) + version (1) + IV (12) before the ciphertext; tag (16) after. */
const PREFIX = 17;
const TAG = 16;

async function reasonFor(
  key: Uint8Array,
  sealed: Uint8Array,
): Promise<OpenFailure | 'opened' | 'other error'> {
  try {
    await openSave(key, sealed);
    return 'opened';
  } catch (error) {
    return error instanceof SaveOpenError ? error.reason : 'other error';
  }
}

function withByteChanged(sealed: Uint8Array, at: number): Uint8Array {
  const copy = sealed.slice();
  copy[at] = (copy[at] ?? 0) ^ 0xff;
  return copy;
}

describe('the save key K (#165 AC1)', () => {
  it('is made, 32 bytes, and kept under SAVE_KEY_NAME on first use', async () => {
    const { store, map } = storeOf();
    const key = await loadOrCreateSaveKey(store);
    expect([key.byteLength, map.get(SAVE_KEY_NAME)]).toEqual([
      SAVE_KEY_LENGTH,
      key,
    ]);
  });

  it('is read back, unchanged and unwritten, once kept', async () => {
    const { store, written } = storeOf({ [SAVE_KEY_NAME]: K });
    expect([await loadOrCreateSaveKey(store), written]).toEqual([K, []]);
  });

  it('is made anew when what is kept is the wrong length', async () => {
    const { store, map } = storeOf({ [SAVE_KEY_NAME]: new Uint8Array(5) });
    const key = await loadOrCreateSaveKey(store);
    expect([key.byteLength, map.get(SAVE_KEY_NAME)]).toEqual([
      SAVE_KEY_LENGTH,
      key,
    ]);
  });

  it('differs between two new devices', async () => {
    const a = await loadOrCreateSaveKey(storeOf().store);
    const b = await loadOrCreateSaveKey(storeOf().store);
    expect(a).not.toEqual(b);
  });
});

describe('a sealed save (#165 AC2, AC3)', () => {
  it('opens to the save it sealed', async () => {
    expect(await openSave(K, await sealSave(K, SAVE))).toEqual(SAVE);
  });

  it('opens to an empty save', async () => {
    expect(await openSave(K, await sealSave(K, new Uint8Array()))).toEqual(
      new Uint8Array(),
    );
  });

  it('starts "YIEC", version 1, and is prefix + save + tag long', async () => {
    const sealed = await sealSave(K, SAVE);
    expect([[...sealed.subarray(0, 5)], sealed.byteLength]).toEqual([
      [0x59, 0x49, 0x45, 0x43, 0x01],
      PREFIX + SAVE.byteLength + TAG,
    ]);
  });

  it('does not show the save in the clear', async () => {
    const sealed = await sealSave(K, SAVE);
    expect(Buffer.from(sealed).toString('latin1')).not.toContain('coins');
  });

  it('will not open under another key: tampered', async () => {
    expect(await reasonFor(OTHER, await sealSave(K, SAVE))).toBe('tampered');
  });

  it('will not open with its magic changed: notSealed', async () => {
    const sealed = withByteChanged(await sealSave(K, SAVE), 1);
    expect(await reasonFor(K, sealed)).toBe('notSealed');
  });

  it('will not open with another version byte: unknownVersion', async () => {
    const sealed = withByteChanged(await sealSave(K, SAVE), 4);
    expect(await reasonFor(K, sealed)).toBe('unknownVersion');
  });

  it('will not open with an IV byte changed: tampered', async () => {
    const sealed = withByteChanged(await sealSave(K, SAVE), 10);
    expect(await reasonFor(K, sealed)).toBe('tampered');
  });

  it('will not open with a ciphertext byte changed: tampered', async () => {
    const sealed = withByteChanged(await sealSave(K, SAVE), PREFIX + 3);
    expect(await reasonFor(K, sealed)).toBe('tampered');
  });

  it('will not open with a tag byte changed: tampered', async () => {
    const sealed = await sealSave(K, SAVE);
    expect(await reasonFor(K, withByteChanged(sealed, sealed.length - 2))).toBe(
      'tampered',
    );
  });

  it('will not open when shorter than prefix + tag: tooShort', async () => {
    const sealed = await sealSave(K, SAVE);
    expect(await reasonFor(K, sealed.slice(0, PREFIX + TAG - 1))).toBe(
      'tooShort',
    );
  });
});

describe('findKeyLeak (#165 AC4)', () => {
  // Hex with letters in it, so an upper-case leak differs from lower case.
  const LEAKY = new Uint8Array(SAVE_KEY_LENGTH).fill(0xab);
  const clean: OutgoingRequest = {
    url: 'https://dev-api.yaweloidle.com/v1/devices',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  };
  const asHex = Buffer.from(LEAKY).toString('hex');
  const asBase64 = Buffer.from(LEAKY).toString('base64');
  const asBase64Url = Buffer.from(LEAKY).toString('base64url');

  it('finds nothing in requests that do not carry K', () => {
    expect(findKeyLeak(LEAKY, [clean])).toBeUndefined();
  });

  it('finds K as hex in a body', () => {
    const leak = { ...clean, body: `{"x":"${asHex}"}` };
    expect(findKeyLeak(LEAKY, [clean, leak])).toBe(leak);
  });

  it('finds K as upper-case hex', () => {
    const leak = { ...clean, body: asHex.toUpperCase() };
    expect(findKeyLeak(LEAKY, [leak])).toBe(leak);
  });

  it('finds K as base64 in a header', () => {
    const leak = { ...clean, headers: { 'x-k': asBase64 } };
    expect(findKeyLeak(LEAKY, [leak])).toBe(leak);
  });

  it('finds K as base64url in a URL', () => {
    const leak = { ...clean, url: `${clean.url}?k=${asBase64Url}` };
    expect(findKeyLeak(LEAKY, [leak])).toBe(leak);
  });
});
