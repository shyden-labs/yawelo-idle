import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  KEY_BYTES,
  SaveDecryptError,
  decryptSave,
  encryptSave,
} from '../src/encryption.ts';

/**
 * Any save encrypts and decrypts back to itself under any key, and any one
 * byte of the encrypted save changed fails decryption with a typed error and
 * no plaintext (#165 AC2, AC3). The unit suite keeps the chosen cases
 * (test/encryption.test.ts).
 */

const RUNS = 200;

const keys = fc.uint8Array({ minLength: KEY_BYTES, maxLength: KEY_BYTES });
const saves = fc.uint8Array({ maxLength: 4096 });

describe('an encrypted save (#165 AC2)', () => {
  it('decrypts back to any save, under any key', async () => {
    await fc.assert(
      fc.asyncProperty(keys, saves, async (key, plain) => {
        expect(await decryptSave(key, await encryptSave(key, plain))).toEqual(
          plain,
        );
      }),
      { numRuns: RUNS },
    );
  });

  it('fails with a typed error, whichever byte changes and to what', async () => {
    await fc.assert(
      fc.asyncProperty(
        keys,
        saves,
        fc.nat(),
        fc.integer({ min: 1, max: 255 }),
        async (key, plain, at, mask) => {
          const sealed = await encryptSave(key, plain);
          const position = at % sealed.length;
          sealed[position] = (sealed[position] ?? 0) ^ mask;
          await expect(decryptSave(key, sealed)).rejects.toBeInstanceOf(
            SaveDecryptError,
          );
        },
      ),
      { numRuns: RUNS },
    );
  });
});
