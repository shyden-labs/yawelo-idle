import { expect } from 'vitest';
import Decimal from 'decimal.js';
import type { Encounter } from '../src/course.ts';
import { purchaseCost } from '../src/encounters.ts';
import type { Num } from '../src/num.ts';

/**
 * What Encounter costs must satisfy at one purchase (#27 AC2), against a
 * 60-digit decimal.js reference; the bound is derived in encounters.test.ts.
 * The unit suite checks chosen purchases (encounters.test.ts) and the
 * properties suite random ones (properties/encounters.test.ts, #543),
 * through the same checks.
 */

export const D = Decimal.clone({ precision: 60 });
const GROWTH = new D('1.15');

export const tea: Encounter = { id: 'tea', tags: ['food'], c0: 10, p0: 0.1 };

export function exact(n: Num): Decimal {
  return new D(n.mantissa).mul(new D(10).pow(n.exponent));
}

export function relativeError(got: Num, want: Decimal): number {
  return exact(got).sub(want).div(want).abs().toNumber();
}

export function costBound(owned: number, count: number, cost: Decimal): number {
  const log10 = Math.abs(cost.log(10).toNumber());
  return 8 * 6e-16 * (owned + count + log10 + 4);
}

export function exactCost(c0: number, owned: number, count: number): Decimal {
  return new D(c0)
    .mul(GROWTH.pow(owned))
    .mul(GROWTH.pow(count).sub(1))
    .div(GROWTH.sub(1));
}

/** Buying `count` after `owned`, at base cost `c0`, costs the closed form. */
export function checkClosedForm(
  owned: number,
  count: number,
  c0: number,
): void {
  const encounter = { ...tea, c0 };
  const want = exactCost(c0, owned, count);
  const got = purchaseCost(encounter, owned, count);
  expect(relativeError(got, want)).toBeLessThan(costBound(owned, count, want));
}

/** Buying `count` at once after `owned` costs what `count` single purchases cost. */
export function checkBulkIsSingles(owned: number, count: number): void {
  const bulk = exact(purchaseCost(tea, owned, count));
  let singles = new D(0);
  for (let i = 0; i < count; i++) {
    singles = singles.add(exact(purchaseCost(tea, owned + i, 1)));
  }
  const difference = bulk.sub(singles).div(singles).abs().toNumber();
  expect(difference).toBeLessThan(2 * costBound(owned, count, singles));
}
