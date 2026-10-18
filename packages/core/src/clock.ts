/**
 * The integer-millisecond clocks (M1 design §2.2 and §2.3).
 *
 * `SimMs` drives the economy (production, journeys, automation, buckets) and
 * `WallMs` drives memory and the calendar. Both are safe non-negative integer
 * milliseconds, branded so that one cannot be passed where the other is meant
 * and a bare number cannot be passed for either. Integers make every split of
 * an interval add up exactly, which is what makes `integrate` associative.
 *
 * The helpers use `%` rather than dividing and flooring: `%` on doubles is
 * exact, so no rounding question arises at any magnitude.
 */

declare const simBrand: unique symbol;
declare const wallBrand: unique symbol;

/** Milliseconds on the simulated (economy) clock. */
export type SimMs = number & { readonly [simBrand]: true };

/** Milliseconds on the wall (memory and calendar) clock, Unix epoch based. */
export type WallMs = number & { readonly [wallBrand]: true };

/** One clock hour: the width of a production bucket. */
export const HOUR_MS = 3_600_000;

/** One day: the unit FSRS measures stability and elapsed time in. */
export const DAY_MS = 86_400_000;

function checkTime(n: number, kind: string): number {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(
      `${kind} must be a safe non-negative integer, got ${String(n)}`,
    );
  }
  // -0 passes both checks; store +0 so state holds one zero.
  return n === 0 ? 0 : n;
}

export function simMs(n: number): SimMs {
  return checkTime(n, 'SimMs') as SimMs;
}

export function wallMs(n: number): WallMs {
  return checkTime(n, 'WallMs') as WallMs;
}

function checkInterval(intervalMs: number): void {
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new RangeError(
      `a grid interval must be a positive safe integer, got ${String(intervalMs)}`,
    );
  }
}

/** The start of the hour bucket holding t. */
export function bucketStart(t: SimMs): SimMs {
  return simMs(t - (t % HOUR_MS));
}

/** The exclusive end of the hour bucket holding t. */
export function bucketEnd(t: SimMs): SimMs {
  return simMs(bucketStart(t) + HOUR_MS);
}

/** The first tick strictly after t on the grid k x intervalMs, k >= 1. */
export function nextGridTick(t: SimMs, intervalMs: number): SimMs {
  checkInterval(intervalMs);
  return simMs(t - (t % intervalMs) + intervalMs);
}

/**
 * How many ticks of the grid k x intervalMs fall in (from, to]. Half-open, so
 * ticks(a, b) + ticks(b, c) = ticks(a, c) and no tick is counted twice when
 * an interval is split.
 */
export function gridTicksBetween(
  from: SimMs,
  to: SimMs,
  intervalMs: number,
): number {
  checkInterval(intervalMs);
  if (to < from) {
    throw new RangeError(
      `gridTicksBetween: ${String(to)} is before ${String(from)}`,
    );
  }
  return (to - (to % intervalMs) - (from - (from % intervalMs))) / intervalMs;
}
