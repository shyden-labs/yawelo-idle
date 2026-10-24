import { describe, expect, it } from 'vitest';
import {
  digest,
  FUNCTIONS,
  VECTORS_PER_FUNCTION,
  type GoldenFunction,
} from './golden-vectors.ts';

/**
 * The golden vectors' Node digests over a prefix of each function (#26 AC10,
 * #28, #543), measured 2026-10-12 by a probe that also reproduced every
 * full digest. Hashing all 100,000 vectors takes up to 0.2 s of CPU a
 * function, past the unit limit, so the full digests are pinned in the
 * properties suite (properties/golden-vectors.test.ts) and tests/engines
 * compares all 100,000 in every engine against Node's bits.
 *
 * A det-math change that alters any early result, such as swapping in
 * Math.pow, moves a digest here first.
 */

const PINNED: Record<GoldenFunction, string> = {
  pow: 'a12a5e2cd49029ca',
  exp: 'b0e0053f718a8112',
  ln: 'f8e898b953cedb89',
  log10: '944c073543f8818b',
  expm1: 'c2bfeca84f46d8ef',
  log1p: '19c6d2a1befbf596',
  meanR: 'adcc0a32108d07dd',
  review: 'dd73d4b1f739c442',
};

/**
 * How many vectors each pin hashes: 20,000 of each, and 5,000 of review,
 * which runs every vector through ts-fsrs (13 ms and 9 ms of CPU for
 * 20,000 of ln and log10 alone, 19 ms for meanR; review took 41 ms for
 * 10,000).
 */
const PINNED_VECTORS: Record<GoldenFunction, number> = {
  pow: 20_000,
  exp: 20_000,
  ln: 20_000,
  log10: 20_000,
  expm1: 20_000,
  log1p: 20_000,
  meanR: 20_000,
  review: 5_000,
};

describe('golden vectors', () => {
  it('cover 100,000 vectors for each of the eight functions', () => {
    expect(VECTORS_PER_FUNCTION).toBe(100_000);
    expect([...FUNCTIONS].sort()).toEqual([
      'exp',
      'expm1',
      'ln',
      'log10',
      'log1p',
      'meanR',
      'pow',
      'review',
    ]);
  });

  for (const fn of FUNCTIONS)
    it(`${fn} hashes its first ${String(PINNED_VECTORS[fn])} vectors to their pinned digest under Node`, () => {
      expect(digest(fn, PINNED_VECTORS[fn])).toBe(PINNED[fn]);
    });
});
