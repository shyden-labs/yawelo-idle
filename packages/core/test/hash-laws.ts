import { expect } from 'vitest';
import { wallMs } from '../src/clock';
import { stateHash } from '../src/hash';
import { initialState } from '../src/state';

/**
 * What the state hash must satisfy at one input (#34). The unit suite checks
 * chosen seeds and times (hash.test.ts) and the properties suite random ones
 * (properties/hash.test.ts, #543), through the same check.
 */

/** Two new games from `seed` at `wall` hash alike: the hash is the state's alone. */
export function checkHashOfStateAlone(seed: number, wall: number): void {
  const state = initialState(wallMs(wall), seed);
  expect(stateHash(state)).toBe(stateHash(initialState(wallMs(wall), seed)));
}
