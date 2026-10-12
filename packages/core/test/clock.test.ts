import { describe, expect, it } from 'vitest';
import {
  bucketEnd,
  bucketStart,
  gridTicksBetween,
  HOUR_MS,
  nextGridTick,
  simMs,
  wallMs,
  type SimMs,
  type WallMs,
} from '../src/clock';
import { checkBucket, checkGridSplit } from './clock-laws';

/**
 * The integer-millisecond clocks (M1 design §2.2 and §2.3, #26 AC5).
 *
 * Every time in core is a safe non-negative integer count of milliseconds, so
 * no split of an interval can round differently from the whole. The bucket
 * and grid helpers are checked against BigInt arithmetic, which is exact at
 * every magnitude (clock-laws.ts): here on chosen times, and on random ones
 * at the full count in the properties suite (properties/clock.test.ts, #543).
 */

describe('the SimMs and WallMs brands', () => {
  it.each([0, 1, 3_600_000, Number.MAX_SAFE_INTEGER])('accept %s', (n) => {
    expect(simMs(n)).toBe(n);
    expect(wallMs(n)).toBe(n);
  });

  it.each([
    1.5,
    -1,
    NaN,
    Infinity,
    -Infinity,
    2 ** 53,
    Number.MAX_SAFE_INTEGER + 2,
  ])('refuse %s', (n) => {
    expect(() => simMs(n)).toThrow(RangeError);
    expect(() => wallMs(n)).toThrow(RangeError);
  });

  it('store -0 as 0, so state never holds a zero that JSON cannot round-trip', () => {
    expect(Object.is(simMs(-0), 0)).toBe(true);
    expect(Object.is(wallMs(-0), 0)).toBe(true);
  });

  it('cannot be mixed up or made from a bare number (typecheck)', () => {
    const sim: SimMs = simMs(5);
    const wall: WallMs = wallMs(5);
    // @ts-expect-error a bare number is not a SimMs
    const fromNumber: SimMs = 5;
    // @ts-expect-error a WallMs is not a SimMs
    const crossed: SimMs = wall;
    // @ts-expect-error a SimMs is not a WallMs
    const crossedBack: WallMs = sim;
    expect([fromNumber, crossed, crossedBack]).toEqual([5, 5, 5]);
  });
});

describe('hour buckets', () => {
  it('are one clock hour long', () => {
    expect(HOUR_MS).toBe(3_600_000);
  });

  it.each([
    [0, 0, 3_600_000],
    [1, 0, 3_600_000],
    [3_599_999, 0, 3_600_000],
    [3_600_000, 3_600_000, 7_200_000],
    [3_600_001, 3_600_000, 7_200_000],
  ])('place %s in [%s, %s)', (t, start, end) => {
    expect(bucketStart(simMs(t))).toBe(start);
    expect(bucketEnd(simMs(t))).toBe(end);
  });

  // Stand-ins: an hour edge and a millisecond either side, the largest hour
  // whose end is safe, the safe limit itself, and a time past 2^53 / 2.
  it.each([
    7_199_999,
    7_200_000,
    7_200_001,
    Number.MAX_SAFE_INTEGER - (Number.MAX_SAFE_INTEGER % HOUR_MS) - 1,
    Number.MAX_SAFE_INTEGER,
    4_503_599_627_370_497,
  ])('agree with exact BigInt arithmetic at %s', (t) => {
    checkBucket(t);
  });

  it('refuse a bucket end past the safe range', () => {
    expect(() => bucketEnd(simMs(Number.MAX_SAFE_INTEGER))).toThrow(RangeError);
  });
});

describe('the automation grid', () => {
  it.each([
    [0, 10_000, 10_000],
    [9_999, 10_000, 10_000],
    [10_000, 10_000, 20_000],
    [10_001, 1_000, 11_000],
  ])('the next tick after %s on a %s ms grid is %s', (t, step, next) => {
    expect(nextGridTick(simMs(t), step)).toBe(next);
  });

  it.each([
    [0, 10_000, 1],
    [0, 9_999, 0],
    [10_000, 10_000, 0],
    [9_999, 10_000, 1],
    [0, 3_600_000, 360],
  ])('counts ticks in (%s, %s] on a 10 s grid as %s', (from, to, n) => {
    expect(gridTicksBetween(simMs(from), simMs(to), 10_000)).toBe(n);
  });

  // Stand-ins: a 1 ms grid, times either side of a tick, unsorted times
  // spanning the safe range, one time three times, and a day-long grid.
  it.each<[number[], number]>([
    [[0, 1, 2], 1],
    [[9_999, 10_000, 10_001], 10_000],
    [[Number.MAX_SAFE_INTEGER, 0, 3_600_000], 86_400_000],
    [[5, 5, 5], 7],
    [[987_654_321, 123_456_789, 2 ** 52], 3_600_000],
  ])(
    'splits exactly: ticks(a, b) + ticks(b, c) = ticks(a, c), at %j on a %s ms grid',
    (ts, step) => {
      checkGridSplit(ts, step);
    },
  );

  it.each([0, -1, 1.5, NaN])('refuses a %s ms interval', (step) => {
    expect(() => nextGridTick(simMs(0), step)).toThrow(RangeError);
    expect(() => gridTicksBetween(simMs(0), simMs(1), step)).toThrow(
      RangeError,
    );
  });

  it('refuses a backwards span', () => {
    expect(() => gridTicksBetween(simMs(2), simMs(1), 1_000)).toThrow(
      RangeError,
    );
  });
});
