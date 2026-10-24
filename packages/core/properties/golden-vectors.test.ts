import { describe, expect, it } from 'vitest';
import {
  digest,
  FUNCTIONS,
  VECTORS_PER_FUNCTION,
  type GoldenFunction,
} from '../test/golden-vectors.ts';

/**
 * The golden vectors' Node digests over all 100,000 vectors of each function
 * (#26 AC10, #28), here since #543: hashing them all takes up to 0.2 s of
 * CPU a function, past the unit limit. The unit suite pins a prefix of each
 * (test/golden-vectors.test.ts).
 *
 * tests/engines proves each browser engine gives Node's bits; this pin proves
 * Node's bits have not moved. A det-math change that alters any result, such
 * as swapping in Math.pow, moves a digest. Measured 2026-10-01 (det-math) and
 * 2026-10-02 (meanR, review).
 */

const PINNED: Record<GoldenFunction, string> = {
  pow: '3d7063d7ea64de4e',
  exp: '282e82fba82afd4e',
  ln: 'c42cd90d8c5957cf',
  log10: '7975fd2b8f7c506e',
  expm1: '2c1250daae88b5ac',
  log1p: '2b1b9cb3cddb4cb2',
  meanR: 'ec29edb532f4e19d',
  review: '1856bc56fcfef272',
};

describe('golden vectors', () => {
  for (const fn of FUNCTIONS)
    it(`${fn} hashes all ${String(VECTORS_PER_FUNCTION)} vectors to its pinned digest under Node`, () => {
      expect(digest(fn, VECTORS_PER_FUNCTION)).toBe(PINNED[fn]);
    });
});
