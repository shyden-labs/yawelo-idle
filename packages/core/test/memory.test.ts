import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { generatorParameters } from 'ts-fsrs';
import { DAY_MS } from '../src/clock.ts';
import {
  DECAY,
  FACTOR,
  meanRetrievability,
  retrievability,
} from '../src/memory.ts';
import { exactMean } from './fsrs-reference.ts';
import { checkMeanBetween } from './memory-laws.ts';
import { MEAN_R_REFERENCE } from './mean-r-reference.ts';

/**
 * Memory maths (#28 AC3): FSRS-6 retrievability and its exact mean over a
 * window, which production uses for each word's bonus in an hour bucket.
 */

const D = Decimal.clone({ precision: 60 });

function relative(got: number, want: Decimal | string): number {
  const w = new D(want);
  return new D(got).minus(w).div(w).abs().toNumber();
}

describe('the FSRS-6 forgetting curve', () => {
  it('uses the scheduler’s own decay, w[20] = 0.1542', () => {
    expect(DECAY).toBe(0.1542);
    expect(DECAY).toBe(generatorParameters().w[20]);
  });

  it('has the factor that puts R at 90% when t equals S', () => {
    expect(
      relative(FACTOR, new D('0.9').pow(new D(-1).div(0.1542)).minus(1)),
    ).toBeLessThan(1e-15);
  });

  for (const s of [0.01, 1, 2.3065, 365])
    it(`puts R at 90% when t equals S = ${String(s)}`, () => {
      expect(retrievability(s, s)).toBeCloseTo(0.9, 14);
    });

  it('is 1 at the review', () => {
    expect(retrievability(3, 0)).toBe(1);
  });

  for (const [earlier, later] of [
    [0, 1e-9],
    [1e-9, 1],
    [1, 30],
    [30, 365],
    [365, 36525],
    [36525, 1e9],
  ] as const)
    it(`falls from t = ${String(earlier)} to t = ${String(later)} and stays above 0`, () => {
      const r = retrievability(3, later);
      expect(r).toBeLessThan(retrievability(3, earlier));
      expect(r).toBeGreaterThan(0);
    });

  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses stability ${String(bad)}`, () => {
      expect(() => retrievability(bad, 1)).toThrow(/stability/);
    });

  for (const bad of [-1e-9, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses elapsed time ${String(bad)}`, () => {
      expect(() => retrievability(1, bad)).toThrow(/elapsed/);
    });
});

describe('the mean retrievability over a window (AC3)', () => {
  it('stores 150 reference rows: 5 stabilities × 6 spans × 5 window starts', () => {
    expect(MEAN_R_REFERENCE).toHaveLength(150);
    const spans = new Set(MEAN_R_REFERENCE.map((r) => r[2]));
    expect([...spans].sort((a, b) => a - b)).toEqual([
      1,
      1000,
      3_600_000,
      DAY_MS,
      30 * DAY_MS,
      36_525 * DAY_MS,
    ]);
    const stabilities = new Set(MEAN_R_REFERENCE.map((r) => r[0]));
    expect([...stabilities].sort((a, b) => a - b)).toEqual([
      0.01, 0.5, 2, 30, 365,
    ]);
    expect(MEAN_R_REFERENCE.filter((r) => r[1] === 0)).toHaveLength(30);
  });

  for (const [s, fromMs, spanMs, mean] of MEAN_R_REFERENCE) {
    const row = `S=${String(s)} from=${String(fromMs)} span=${String(spanMs)}`;

    it(`stores ${row} to 30 significant digits of the exact value`, () => {
      const exact = exactMean(s, fromMs / DAY_MS, spanMs / DAY_MS);
      expect(mean).toBe(exact.toSignificantDigits(30).toString());
    });

    it(`agrees with ${row} to 1e-12 relative`, () => {
      const got = meanRetrievability(s, fromMs / DAY_MS, spanMs / DAY_MS);
      const error = relative(got, mean);
      expect(error).toBeLessThan(1e-12);
      // Measured 2026-10-02: worst row 1.19e-15. The bound above is the AC's;
      // this shows the margin.
      expect(error).toBeLessThan(1e-14);
    });
  }

  // Stand-ins of the random windows (the properties suite runs them at the
  // full count, #543): each bound of the stability, start and span drawn,
  // and a mid-range window. The counterexample the property found is the
  // test after these.
  it.each([
    [0.001, 0, 1e-9],
    [36_500, 1e5, 1e5],
    [2.3, 10, 1],
  ])(
    'lies between R at the window’s end and R at its start, for S %s from %s over %s',
    (s, from, span) => {
      checkMeanBetween(s, from, span);
    },
  );

  it('lies between them over a 1 ns window 100,000 days out, where R barely moves', () => {
    // Found by the property (properties/memory.test.ts), 6 in 2,000,000
    // runs, 2026-10-02.
    const [s, from, span] = [
      0.002616681480501123, 99999.99999999977, 1.0000000000000034e-9,
    ];
    checkMeanBetween(s, from, span);
  });

  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses span ${String(bad)} and stability ${String(bad)}`, () => {
      expect(() => meanRetrievability(1, 0, bad)).toThrow(/span/);
      expect(() => meanRetrievability(bad, 0, 1)).toThrow(/stability/);
    });

  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses a window starting at ${String(bad)} days`, () => {
      expect(() => meanRetrievability(1, bad, 1)).toThrow(/elapsed/);
    });
});
