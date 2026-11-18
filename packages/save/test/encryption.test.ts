import { describe, expect, it } from 'vitest';
import {
  KEY_BYTES,
  SAVE_KEY,
  SaveDecryptError,
  decryptSave,
  encryptSave,
  ensureSaveKey,
  leaksKey,
  type DecryptFailure,
  type KeyStorage,
  type SentRequest,
} from '../src/encryption';

/**
 * The save key `K` and the save's AES-256-GCM encryption (#165; spec §6.6).
 * The unit suite keeps the chosen cases; any save and any changed byte are
 * the properties suite's (properties/encryption.test.ts).
 */

/** A storage kept in a Map, with every write recorded. */
function memoryStorage(initial: Record<string, Uint8Array> = {}) {
  const kept = new Map(Object.entries(initial));
  const writes: string[] = [];
  const storage: KeyStorage = {
    get: (key) => Promise.resolve(kept.get(key)),
    set: (key, bytes) => {
      writes.push(key);
      kept.set(key, bytes);
      return Promise.resolve();
    },
  };
  return { storage, kept, writes };
}

const KEY = Uint8Array.from({ length: KEY_BYTES }, (_, index) => index + 1);
const OTHER_KEY = Uint8Array.from(
  { length: KEY_BYTES },
  (_, index) => 200 - index,
);
const PLAIN = new TextEncoder().encode(
  '{"saveVersion":1,"state":{"coins":"1e3"}}',
);

/** Header: "YIEC", format byte, 12-byte IV. Tag: 16 bytes at the end. */
const HEADER = 4 + 1 + 12;
const TAG = 16;

/** Why decrypting `sealed` under `key` failed, or 'decrypted' if it did not. */
async function failure(
  key: Uint8Array,
  sealed: Uint8Array,
): Promise<DecryptFailure | 'decrypted' | 'untyped'> {
  try {
    await decryptSave(key, sealed);
    return 'decrypted';
  } catch (error) {
    return error instanceof SaveDecryptError ? error.reason : 'untyped';
  }
}

/** `sealed` with the byte at `index` flipped. */
const flipped = (sealed: Uint8Array, index: number): Uint8Array => {
  const copy = Uint8Array.from(sealed);
  copy[index] = (copy[index] ?? 0) ^ 0x01;
  return copy;
};

describe('ensureSaveKey (#165 AC1)', () => {
  it('makes a 32-byte key and keeps it under SAVE_KEY when none is kept', async () => {
    const { storage, kept } = memoryStorage();
    const key = await ensureSaveKey(storage);
    expect([key.length, kept.get(SAVE_KEY)]).toEqual([KEY_BYTES, key]);
  });

  it('gives back the kept key and writes nothing', async () => {
    const { storage, writes } = memoryStorage({ [SAVE_KEY]: KEY });
    expect([await ensureSaveKey(storage), writes]).toEqual([KEY, []]);
  });

  it('replaces a kept value that is not 32 bytes', async () => {
    const { storage, kept } = memoryStorage({
      [SAVE_KEY]: Uint8Array.of(1, 2),
    });
    const key = await ensureSaveKey(storage);
    expect([key.length, kept.get(SAVE_KEY)]).toEqual([KEY_BYTES, key]);
  });

  it('makes a different key on each new device', async () => {
    const first = await ensureSaveKey(memoryStorage().storage);
    const second = await ensureSaveKey(memoryStorage().storage);
    expect(first).not.toEqual(second);
  });
});

describe('encryptSave and decryptSave (#165 AC2, AC3)', () => {
  it('gives back the save it encrypted', async () => {
    const sealed = await encryptSave(KEY, PLAIN);
    expect(await decryptSave(KEY, sealed)).toEqual(PLAIN);
  });

  it('gives back an empty save', async () => {
    const sealed = await encryptSave(KEY, new Uint8Array());
    expect(await decryptSave(KEY, sealed)).toEqual(new Uint8Array());
  });

  it('writes "YIEC", format 1, the IV, then the ciphertext and its tag', async () => {
    const sealed = await encryptSave(KEY, PLAIN);
    expect([[...sealed.subarray(0, 5)], sealed.length]).toEqual([
      [0x59, 0x49, 0x45, 0x43, 1],
      HEADER + PLAIN.length + TAG,
    ]);
  });

  it('never carries the save in the clear', async () => {
    const sealed = await encryptSave(KEY, PLAIN);
    const text = new TextDecoder('latin1').decode(sealed);
    expect(text).not.toContain('saveVersion');
  });

  it('draws a fresh IV for each encryption, unique over 10,000', async () => {
    const ivs = new Set<string>();
    for (let count = 0; count < 10_000; count += 1) {
      const sealed = await encryptSave(KEY, Uint8Array.of(count & 0xff));
      ivs.add(Buffer.from(sealed.subarray(5, HEADER)).toString('hex'));
    }
    expect(ivs.size).toBe(10_000);
  });

  it('refuses the wrong key with an authentication error', async () => {
    const sealed = await encryptSave(KEY, PLAIN);
    expect(await failure(OTHER_KEY, sealed)).toBe('authentication');
  });

  it('refuses bytes that do not start with "YIEC" as notEncrypted', async () => {
    expect(await failure(KEY, flipped(await encryptSave(KEY, PLAIN), 0))).toBe(
      'notEncrypted',
    );
  });

  it('refuses a format byte it does not know as unknownFormat', async () => {
    expect(await failure(KEY, flipped(await encryptSave(KEY, PLAIN), 4))).toBe(
      'unknownFormat',
    );
  });

  it('refuses a changed IV byte with an authentication error', async () => {
    expect(await failure(KEY, flipped(await encryptSave(KEY, PLAIN), 5))).toBe(
      'authentication',
    );
  });

  it('refuses a changed ciphertext byte with an authentication error', async () => {
    expect(
      await failure(KEY, flipped(await encryptSave(KEY, PLAIN), HEADER)),
    ).toBe('authentication');
  });

  it('refuses a changed tag byte with an authentication error', async () => {
    const sealed = await encryptSave(KEY, PLAIN);
    expect(await failure(KEY, flipped(sealed, sealed.length - 1))).toBe(
      'authentication',
    );
  });

  it('refuses bytes too short for the IV and the tag as truncated', async () => {
    const sealed = await encryptSave(KEY, PLAIN);
    expect(await failure(KEY, sealed.subarray(0, HEADER + TAG - 1))).toBe(
      'truncated',
    );
  });
});

describe('leaksKey (#165 AC4)', () => {
  const quiet: SentRequest = {
    url: 'https://dev-api.yaweloidle.com/v1/devices',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  };
  const hex = Buffer.from(KEY).toString('hex');
  const base64 = Buffer.from(KEY).toString('base64');
  const base64url = Buffer.from(KEY).toString('base64url');

  it('finds no key in requests that do not carry it', () => {
    expect(leaksKey(KEY, [quiet])).toBe(false);
  });

  it('finds the key as lower-case hex in a body', () => {
    expect(leaksKey(KEY, [quiet, { ...quiet, body: `{"k":"${hex}"}` }])).toBe(
      true,
    );
  });

  it('finds the key as upper-case hex in a body', () => {
    expect(leaksKey(KEY, [{ ...quiet, body: hex.toUpperCase() }])).toBe(true);
  });

  it('finds the key as base64 in a header', () => {
    expect(
      leaksKey(KEY, [{ ...quiet, headers: { authorization: base64 } }]),
    ).toBe(true);
  });

  it('finds the key as base64url in a URL', () => {
    expect(
      leaksKey(KEY, [{ ...quiet, url: `${quiet.url}?k=${base64url}` }]),
    ).toBe(true);
  });
});
