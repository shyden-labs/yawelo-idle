import { expect } from 'vitest';
import {
  bucketEnd,
  bucketStart,
  gridTicksBetween,
  HOUR_MS,
  simMs,
  type SimMs,
} from '../src/clock.ts';

/**
 * What the bucket and grid helpers must satisfy at one input (M1 design §2.2
 * and §2.3, #26 AC5), against BigInt arithmetic, which is exact at every
 * magnitude. The unit suite checks chosen times (clock.test.ts) and the
 * properties suite random ones (properties/clock.test.ts, #543), through the
 * same checks.
 */

const H = BigInt(HOUR_MS);

/** `t`'s bucket starts and ends where BigInt arithmetic says. */
export function checkBucket(t: number): void {
  const start = BigInt(t) - (BigInt(t) % H);
  expect(BigInt(bucketStart(simMs(t)))).toBe(start);
  if (start + H <= BigInt(Number.MAX_SAFE_INTEGER)) {
    expect(BigInt(bucketEnd(simMs(t)))).toBe(start + H);
  }
}

/** ticks(a, b) + ticks(b, c) = ticks(a, c), and ticks(a, c) is exact. */
export function checkGridSplit(ts: readonly number[], step: number): void {
  const [a, b, c] = [...ts].sort((x, y) => x - y).map(simMs) as [
    SimMs,
    SimMs,
    SimMs,
  ];
  expect(gridTicksBetween(a, b, step) + gridTicksBetween(b, c, step)).toBe(
    gridTicksBetween(a, c, step),
  );
  const exact = BigInt(c) / BigInt(step) - BigInt(a) / BigInt(step);
  expect(BigInt(gridTicksBetween(a, c, step))).toBe(exact);
}
