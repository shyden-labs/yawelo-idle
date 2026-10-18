/**
 * Seeded randomness for core (M1 design §3): xoshiro128** on four 32-bit
 * words, seeded through SplitMix64 as its authors recommend.
 *
 * State is plain data ({ s: [a, b, c, d] }), so it serialises with the game
 * state and a replay continues the same sequence. Every function returns the
 * next state rather than mutating, and all arithmetic is 32-bit integer work
 * (Math.imul, shifts, >>> 0) or BigInt, which every engine computes alike.
 *
 * Named sub-streams give each purpose (recall draws, latencies, open times,
 * card order) its own state, so drawing for one never shifts another: the
 * pacing bots rely on this to compare personas that differ in one behaviour.
 */

export interface RngState {
  readonly s: readonly [number, number, number, number];
}

export interface Draw {
  readonly value: number;
  readonly state: RngState;
}

const TWO_POW_32 = 4294967296;
const MASK_64 = 0xffffffffffffffffn;

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** The next 32-bit output, from 0 to 2^32 - 1. */
export function nextU32(state: RngState): Draw {
  const [s0, s1, s2, s3] = state.s;
  if ((s0 | s1 | s2 | s3) === 0) {
    throw new RangeError('xoshiro128** cannot leave the all-zero state');
  }
  const value = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  const n2 = (s2 ^ s0) >>> 0;
  const n3 = (s3 ^ s1) >>> 0;
  const n1 = (s1 ^ n2) >>> 0;
  const n0 = (s0 ^ n3) >>> 0;
  return { value, state: { s: [n0, n1, (n2 ^ t) >>> 0, rotl(n3, 11)] } };
}

/** A float in [0, 1): the 32-bit output divided by 2^32, which is exact. */
export function nextFloat(state: RngState): Draw {
  const r = nextU32(state);
  return { value: r.value / TWO_POW_32, state: r.state };
}

/** A uniform integer in [0, n), 1 <= n <= 2^32, by rejecting the biased tail. */
export function nextInt(state: RngState, n: number): Draw {
  if (!Number.isInteger(n) || n < 1 || n > TWO_POW_32) {
    throw new RangeError(
      `nextInt: n must be an integer in [1, 2^32], got ${String(n)}`,
    );
  }
  const limit = TWO_POW_32 - (TWO_POW_32 % n);
  let r = nextU32(state);
  while (r.value >= limit) r = nextU32(r.state);
  return { value: r.value % n, state: r.state };
}

function splitmix64(x: bigint): { value: bigint; next: bigint } {
  const next = (x + 0x9e3779b97f4a7c15n) & MASK_64;
  let z = next;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
  return { value: z ^ (z >> 31n), next };
}

function stateFrom64(seed: bigint): RngState {
  const a = splitmix64(seed);
  const b = splitmix64(a.next);
  const lo = (v: bigint) => Number(v & 0xffffffffn);
  const hi = (v: bigint) => Number(v >> 32n);
  const state: RngState = {
    s: [lo(a.value), hi(a.value), lo(b.value), hi(b.value)],
  };
  // SplitMix64 never yields two zero outputs in a row; checked anyway.
  if (state.s.every((w) => w === 0))
    throw new RangeError('seed produced the all-zero state');
  return state;
}

function checkSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new RangeError(
      `a seed must be a safe non-negative integer, got ${String(seed)}`,
    );
  }
}

/** The state for a seed: two SplitMix64 outputs, low word then high word. */
export function seedRng(seed: number): RngState {
  checkSeed(seed);
  return stateFrom64(BigInt(seed));
}

/** Independent generators keyed by purpose. */
export type RngStreams = Readonly<Record<string, RngState>>;

const STREAM_NAME = /^[a-z][a-z0-9-]*$/;

/** FNV-1a, 64-bit, over the name's characters (names are ASCII by rule). */
function fnv1a64(text: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    h = ((h ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n) & MASK_64;
  }
  return h;
}

/** One stream per name, each seeded from the seed mixed with the name's hash. */
export function createStreams(
  seed: number,
  names: readonly string[],
): RngStreams {
  checkSeed(seed);
  const streams: Record<string, RngState> = {};
  for (const name of names) {
    if (!STREAM_NAME.test(name)) {
      throw new RangeError(
        `stream name ${JSON.stringify(name)} must match ${String(STREAM_NAME)}`,
      );
    }
    if (name in streams) throw new RangeError(`duplicate stream name ${name}`);
    streams[name] = stateFrom64(BigInt(seed) ^ fnv1a64(name));
  }
  return streams;
}

function streamState(streams: RngStreams, name: string): RngState {
  const state = Object.hasOwn(streams, name) ? streams[name] : undefined;
  if (state === undefined) throw new RangeError(`no stream named ${name}`);
  return state;
}

/** The next 32-bit output of one stream; every other stream is untouched. */
export function drawFrom(
  streams: RngStreams,
  name: string,
): { value: number; streams: RngStreams } {
  const r = nextU32(streamState(streams, name));
  return { value: r.value, streams: { ...streams, [name]: r.state } };
}

/** A uniform integer in [0, n) from one stream; every other stream is untouched. */
export function intFrom(
  streams: RngStreams,
  name: string,
  n: number,
): { value: number; streams: RngStreams } {
  const r = nextInt(streamState(streams, name), n);
  return { value: r.value, streams: { ...streams, [name]: r.state } };
}
