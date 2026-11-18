import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  SAVE_KEY_LENGTH,
  SaveOpenError,
  openSave,
  sealSave,
} from '../src/seal.ts';

/**
 * #165 AC2, AC3: any save under any key opens back to itself, and any one
 * changed byte of a sealed save fails with a SaveOpenError and gives back
 * nothing; and 10,000 seals draw 10,000 different IVs (AC2). Chosen cases:
 * test/seal.test.ts.
 */

const RUNS = 200;
const keys = fc.uint8Array({
  minLength: SAVE_KEY_LENGTH,
  maxLength: SAVE_KEY_LENGTH,
});
const saves = fc.uint8Array({ maxLength: 4096 });

const K = new Uint8Array(SAVE_KEY_LENGTH).fill(7);
const SAVE = new TextEncoder().encode('{"saveVersion":1,"coins":"5e2"}');

/** Magic (4) + version (1) + IV (12). */
const PREFIX = 17;

describe('a sealed save, for any save and key (#165)', () => {
  it('uses a fresh IV every time: 10,000 seals, 10,000 IVs', async () => {
    const seen = new Set<string>();
    for (let n = 0; n < 10_000; n += 1) {
      const sealed = await sealSave(K, SAVE);
      seen.add(Buffer.from(sealed.subarray(5, PREFIX)).toString('hex'));
    }
    expect(seen.size).toBe(10_000);
  });

  it('opens back to the save', async () => {
    await fc.assert(
      fc.asyncProperty(keys, saves, async (key, save) => {
        expect(await openSave(key, await sealSave(key, save))).toEqual(save);
      }),
      { numRuns: RUNS },
    );
  });

  it('refuses any one changed byte with a SaveOpenError', async () => {
    await fc.assert(
      fc.asyncProperty(
        keys,
        saves,
        fc.nat(),
        fc.integer({ min: 1, max: 255 }),
        async (key, save, at, flip) => {
          const sealed = await sealSave(key, save);
          const index = at % sealed.length;
          sealed[index] = (sealed[index] ?? 0) ^ flip;
          await expect(openSave(key, sealed)).rejects.toBeInstanceOf(
            SaveOpenError,
          );
        },
      ),
      { numRuns: RUNS },
    );
  });
});
