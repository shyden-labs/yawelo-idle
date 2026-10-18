import { describe, expect, it } from 'vitest';
import {
  createStreams,
  drawFrom,
  intFrom,
  nextFloat,
  nextInt,
  nextU32,
  seedRng,
  type RngState,
} from '../src/rng';
import {
  checkFloatRange,
  checkIndependent,
  checkIntRange,
  checkJsonRoundTrip,
  NAMES,
  take,
} from './rng-laws';

/**
 * The seeded PRNG (M1 design §3, #26 AC6): xoshiro128** on four 32-bit words,
 * seeded through SplitMix64 as its authors recommend.
 *
 * The pinned vectors come from the authors' reference C (xoshiro128starstar.c
 * and splitmix64.c), compiled and run on 2026-10-01, never from this module:
 * a vector produced by the code under test could not disagree with it.
 */

describe('xoshiro128**', () => {
  it('matches the reference C from state {1, 2, 3, 4}', () => {
    expect(take({ s: [1, 2, 3, 4] }, 10)).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034,
      3734860849, 3729100597, 4258142804,
    ]);
  });

  it('seeds through SplitMix64: seed 42 gives the reference state and first 8 outputs', () => {
    const state = seedRng(42);
    expect(state).toEqual({
      s: [803958421, 3184996902, 2993090819, 686809907],
    });
    expect(take(state, 8)).toEqual([
      1776835114, 4165204688, 17111135, 2317295270, 2792088233, 2554630222,
      2940343271, 2244566231,
    ]);
  });

  it('never mutates the state it is given', () => {
    const state: RngState = Object.freeze({
      s: Object.freeze([1, 2, 3, 4] as const),
    });
    expect(() => take(state, 5)).not.toThrow();
    expect(state).toEqual({ s: [1, 2, 3, 4] });
  });

  it.each([
    [0, 0],
    [42, 7],
    [Number.MAX_SAFE_INTEGER, 50],
  ])(
    'round-trips through JSON from seed %s after %s draws, and continues the same sequence',
    (seed, skip) => {
      checkJsonRoundTrip(seed, skip);
    },
  );

  it.each([-1, 1.5, NaN, 2 ** 53])('refuses seed %s', (seed) => {
    expect(() => seedRng(seed)).toThrow(RangeError);
  });

  it('refuses the all-zero state, which xoshiro can never leave', () => {
    expect(() => nextU32({ s: [0, 0, 0, 0] })).toThrow(RangeError);
  });
});

describe('derived draws', () => {
  it('nextFloat is u32 / 2^32, in [0, 1)', () => {
    const s = seedRng(42);
    expect(nextFloat(s).value).toBe(1776835114 / 4294967296);
  });

  it.each([0, 42, 1e9])('nextFloat from seed %s is in [0, 1)', (seed) => {
    checkFloatRange(seed);
  });

  it.each([
    [0, 1],
    [42, 3],
    [7, 3 * 2 ** 30],
    [1e9, 2 ** 32],
  ])('nextInt from seed %s stays in [0, %s)', (seed, n) => {
    checkIntRange(seed, n);
  });

  it('nextInt(n) rejects the biased tail', () => {
    // n = 3 * 2^30: the top quarter of u32 values is the biased tail. From
    // state {1, 2, 3, 4} the outputs are 11520, ... so the first is accepted.
    expect(nextInt({ s: [1, 2, 3, 4] }, 3 * 2 ** 30).value).toBe(11520);
    // 3734860849 >= 3 * 2^30 = 3221225472 is rejected and the next output,
    // 3729100597, is rejected too; 4258142804 likewise; the draw moves on.
    let s: RngState = { s: [1, 2, 3, 4] };
    for (let i = 0; i < 7; i++) s = nextU32(s).state;
    const r = nextInt(s, 3 * 2 ** 30);
    expect(r.value).toBeLessThan(3 * 2 ** 30);
    expect(r.state).not.toEqual(nextU32(s).state);
  });

  it.each([0, -1, 1.5, 2 ** 32 + 1])('nextInt refuses n = %s', (n) => {
    expect(() => nextInt(seedRng(1), n)).toThrow(RangeError);
  });
});

describe('named sub-streams', () => {
  it('intFrom draws nextInt from one stream and leaves the others as they were', () => {
    const streams = createStreams(7, NAMES);
    const latency = streams['latency'];
    if (latency === undefined) throw new Error('no latency stream');
    const want = nextInt(latency, 12);
    const r = intFrom(streams, 'latency', 12);
    expect(r.value).toBe(want.value);
    expect(r.streams['latency']).toEqual(want.state);
    expect(r.streams['recall']).toBe(streams['recall']);
    expect(r.streams['opens']).toBe(streams['opens']);
  });

  it('intFrom refuses a stream it does not hold, and an n nextInt refuses', () => {
    const streams = createStreams(7, NAMES);
    expect(() => intFrom(streams, 'toString', 3)).toThrow(
      /no stream named toString/,
    );
    expect(() => intFrom(streams, 'recall', 0)).toThrow(RangeError);
  });

  it('are reproducible from the seed and distinct from each other', () => {
    const a = createStreams(7, NAMES);
    expect(createStreams(7, NAMES)).toEqual(a);
    const firsts = NAMES.map((n) => drawFrom(a, n).value);
    expect(new Set(firsts).size).toBe(NAMES.length);
    expect(createStreams(8, NAMES)).not.toEqual(a);
  });

  // Stand-ins of the random interleavings: none, the stream alone, and one
  // of 13 draws that takes each stream first, between and last.
  const ORDERS: [string, string[]][] = [
    ['no draws', []],
    ['one draw of each', ['opens', 'recall', 'latency']],
    [
      '13 interleaved draws',
      [
        'opens',
        'recall',
        'latency',
        'recall',
        'recall',
        'opens',
        'latency',
        'latency',
        'recall',
        'opens',
        'opens',
        'recall',
        'latency',
      ],
    ],
  ];

  for (const name of NAMES)
    for (const [label, order] of ORDERS)
      it(`are independent: drawing the others never changes ${name}, over ${label}`, () => {
        checkIndependent(name, order);
      });

  it('refuse an unknown name, a duplicate and a name outside [a-z0-9-]', () => {
    expect(() => drawFrom(createStreams(1, NAMES), 'missing')).toThrow(
      RangeError,
    );
    expect(() => createStreams(1, ['a', 'a'])).toThrow(RangeError);
    expect(() => createStreams(1, ['Recall'])).toThrow(RangeError);
  });
});
