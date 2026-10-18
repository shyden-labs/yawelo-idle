import { expect } from 'vitest';
import {
  createStreams,
  drawFrom,
  nextFloat,
  nextInt,
  nextU32,
  seedRng,
  type RngState,
} from '../src/rng';

/**
 * What the seeded PRNG must satisfy at one input (M1 design §3, #26 AC6). The
 * unit suite checks chosen seeds and orders (rng.test.ts) and the properties
 * suite random ones (properties/rng.test.ts, #543), through the same checks.
 */

export function take(state: RngState, n: number): number[] {
  const out: number[] = [];
  let s = state;
  for (let i = 0; i < n; i++) {
    const r = nextU32(s);
    out.push(r.value);
    s = r.state;
  }
  return out;
}

/** The state `skip` draws after `seed` round-trips through JSON and continues the same sequence. */
export function checkJsonRoundTrip(seed: number, skip: number): void {
  let s = seedRng(seed);
  for (let i = 0; i < skip; i++) s = nextU32(s).state;
  const revived = JSON.parse(JSON.stringify(s)) as RngState;
  expect(take(revived, 8)).toEqual(take(s, 8));
}

/** The first float from `seed` lies in [0, 1). */
export function checkFloatRange(seed: number): void {
  const v = nextFloat(seedRng(seed)).value;
  expect(v >= 0 && v < 1).toBe(true);
}

/** The first `nextInt(n)` from `seed` is an integer in [0, n). */
export function checkIntRange(seed: number, n: number): void {
  const v = nextInt(seedRng(seed), n).value;
  expect(Number.isInteger(v) && v >= 0 && v < n).toBe(true);
}

export const NAMES = ['recall', 'latency', 'opens'];

/**
 * Drawing the streams in `order` gives `name` the values it gives drawn
 * alone: drawing the others never changes it.
 */
export function checkIndependent(name: string, order: readonly string[]): void {
  let streams = createStreams(7, NAMES);
  const seen: number[] = [];
  for (const drawn of order) {
    const r = drawFrom(streams, drawn);
    if (drawn === name) seen.push(r.value);
    streams = r.streams;
  }
  let alone = createStreams(7, NAMES);
  const solo: number[] = [];
  for (let i = 0; i < seen.length; i++) {
    const r = drawFrom(alone, name);
    solo.push(r.value);
    alone = r.streams;
  }
  expect(seen).toEqual(solo);
}
