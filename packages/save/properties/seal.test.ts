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
 * nothing. Chosen cases: test/seal.test.ts.
 */

const RUNS = 200;
const keys = fc.uint8Array({
  minLength: SAVE_KEY_LENGTH,
  maxLength: SAVE_KEY_LENGTH,
});
const saves = fc.uint8Array({ maxLength: 4096 });

describe('a sealed save, for any save and key (#165)', () => {
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
