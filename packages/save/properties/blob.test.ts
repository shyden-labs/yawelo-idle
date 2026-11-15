import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { loadBlob, save, toBlob } from '../src/index.ts';
import { CONTENT_VERSION, played } from '../test/states.ts';

/**
 * Any one byte of a stored blob changed, at any position and to any other
 * value, is refused as corrupt, and nothing of it is loaded (#159 AC2). The
 * unit suite keeps the chosen damage, one test per reason
 * (test/blob.test.ts).
 */

const RUNS = 1_000;

/** Built inside each test, so the stub's throw fails the tests one by one. */
const blobOf = (): Uint8Array => toBlob(save(played(), {}, CONTENT_VERSION));

describe('a blob with one byte changed (#159 AC2)', () => {
  it('is refused as corrupt, whichever byte and whatever it becomes', () => {
    const blob = blobOf();
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: blob.byteLength - 1 }),
        fc.integer({ min: 1, max: 255 }),
        (position, mask) => {
          const spoiled = Uint8Array.from(blob);
          spoiled[position] = (spoiled[position] ?? 0) ^ mask;
          const result = loadBlob(spoiled);
          expect(result.ok).toBe(false);
          expect(result.ok ? undefined : result.refusal.kind).toBe('corrupt');
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('is refused at each of its positions, changed by one bit', () => {
    const blob = blobOf();
    // runtime population: the positions are the bytes of a blob built above
    const loaded: number[] = [];
    for (let position = 0; position < blob.byteLength; position += 1) {
      const spoiled = Uint8Array.from(blob);
      spoiled[position] = (spoiled[position] ?? 0) ^ 0x01;
      const result = loadBlob(spoiled);
      if (result.ok || result.refusal.kind !== 'corrupt') loaded.push(position);
    }
    expect(loaded).toEqual([]);
  });
});
