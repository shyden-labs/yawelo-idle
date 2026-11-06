import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { curve, FSRS7_DEFAULT_WEIGHTS } from 'ts-fsrs/models/fsrs-7';
import { DAY_MS } from '../src/clock';
import {
  meanRetrievability,
  retrievability,
  WEIGHTS,
  type MemoryState,
} from '../src/memory';
import { exactMean, exactR } from './fsrs-reference';
import { checkMeanBetween } from './memory-laws';
import { MEAN_R_REFERENCE } from './mean-r-reference';

/**
 * Memory maths (#874 AC3, first #28 AC3): FSRS-7 retrievability and its
 * exact mean over a window, which production uses for each word's bonus in
 * an hour bucket.
 */

const D = Decimal.clone({ precision: 60 });

function relative(got: number, want: Decimal | string): number {
  const w = new D(want);
  return new D(got).minus(w).div(w).abs().toNumber();
}

const state = (
  stability: number,
  stabilityFast: number,
  difficulty: number,
): MemoryState => ({ stability, stabilityFast, difficulty });

/**
 * States for the curve's grid: the five of the mean reference, then two
 * outside FSRS-7's bounds, which ts-fsrs clamps, and one a real review
 * sequence reached (ts-fsrs 6 probe, 2026-11-05).
 */
const GRID_STATES: readonly MemoryState[] = [
  state(0.01, 0.01, 1),
  state(0.5, 3, 5),
  state(2, 0.2, 10),
  state(30, 267, 9.18),
  state(365, 36_500, 3),
  state(1e-5, 1e-6, 0.5),
  state(5e4, 5e4, 11),
  state(16.77504667, 267.35096968, 9.18270814),
];

const GRID_DAYS = [0, 1e-9, 1 / 86_400, 0.01, 1, 10, 365, 36_525, 1e7];

const name = (s: MemoryState) =>
  `S=${String(s.stability)} Sf=${String(s.stabilityFast)} D=${String(s.difficulty)}`;

describe('the FSRS-7 forgetting curve', () => {
  it('uses FSRS-7’s default weights from ts-fsrs', () => {
    expect(WEIGHTS).toEqual(FSRS7_DEFAULT_WEIGHTS);
  });

  for (const s of GRID_STATES)
    for (const days of GRID_DAYS) {
      const row = `${name(s)} at t=${String(days)}`;

      it(`agrees with ts-fsrs’s own curve, ${row}`, () => {
        const got = retrievability(s, days);
        const lib = curve(FSRS7_DEFAULT_WEIGHTS, days, s).retrievability;
        expect(Math.abs(got - lib) / lib).toBeLessThan(1e-12);
      });

      it(`agrees with the 60-digit reference to 1e-12 relative, ${row}`, () => {
        const error = relative(retrievability(s, days), exactR(s, days));
        expect(error).toBeLessThan(1e-12);
      });
    }

  it('is 0.99999 at the review: FSRS-7 keeps R inside [0.00001, 0.99999]', () => {
    expect(retrievability(state(3, 1, 5), 0)).toBeCloseTo(0.99999, 15);
  });

  for (const [earlier, later] of [
    [0, 1e-9],
    [1e-9, 1],
    [1, 30],
    [30, 365],
    [365, 36525],
    [36525, 1e9],
  ] as const)
    it(`falls from t = ${String(earlier)} to t = ${String(later)} and stays above 0.00001`, () => {
      const s = state(3, 1, 5);
      const r = retrievability(s, later);
      expect(r).toBeLessThan(retrievability(s, earlier));
      expect(r).toBeGreaterThan(0.00001);
    });

  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`refuses stability ${String(bad)}`, () => {
      expect(() => retrievability(state(bad, 1, 5), 1)).toThrow(/^stability/);
    });

    it(`refuses fast stability ${String(bad)}`, () => {
      expect(() => retrievability(state(1, bad, 5), 1)).toThrow(
        /fast stability/,
      );
    });
  }

  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses difficulty ${String(bad)}`, () => {
      expect(() => retrievability(state(1, 1, bad), 1)).toThrow(/difficulty/);
    });

  for (const bad of [-1e-9, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses elapsed time ${String(bad)}`, () => {
      expect(() => retrievability(state(1, 1, 5), bad)).toThrow(/elapsed/);
    });
});

describe('the mean retrievability over a window (AC3)', () => {
  it('stores 150 reference rows: 5 states × 5 window starts × 6 spans', () => {
    expect(MEAN_R_REFERENCE).toHaveLength(150);
    const spans = new Set(MEAN_R_REFERENCE.map((r) => r[4]));
    expect([...spans].sort((a, b) => a - b)).toEqual([
      1,
      1000,
      3_600_000,
      DAY_MS,
      30 * DAY_MS,
      36_525 * DAY_MS,
    ]);
    const states = new Set(MEAN_R_REFERENCE.map((r) => r.slice(0, 3).join()));
    expect(states.size).toBe(5);
    expect(MEAN_R_REFERENCE.filter((r) => r[3] === 0)).toHaveLength(30);
  });

  for (const [s, sFast, d, fromMs, spanMs, mean] of MEAN_R_REFERENCE) {
    const at = state(s, sFast, d);
    const row = `${name(at)} from=${String(fromMs)} span=${String(spanMs)}`;

    it(`stores ${row} to 30 significant digits of the exact value`, () => {
      const exact = exactMean(at, fromMs / DAY_MS, spanMs / DAY_MS);
      expect(mean).toBe(exact.toSignificantDigits(30).toString());
    });

    it(`agrees with ${row} to 1e-12 relative`, () => {
      const got = meanRetrievability(at, fromMs / DAY_MS, spanMs / DAY_MS);
      expect(relative(got, mean)).toBeLessThan(1e-12);
    });
  }

  // Stand-ins of the random windows (the properties suite runs them at the
  // full count, #543): each bound of the state, start and span drawn, and a
  // mid-range window. The counterexample the FSRS-6 property found is the
  // test after these.
  it.each([
    [state(0.0001, 0.0001, 1), 0, 1e-9],
    [state(36_500, 36_500, 10), 1e5, 1e5],
    [state(2.3, 0.4, 6), 10, 1],
  ])(
    'lies between R at the window’s end and R at its start, for %o from %s over %s',
    (s, from, span) => {
      checkMeanBetween(s, from, span);
    },
  );

  it('lies between them over a 1 ns window 100,000 days out, where R barely moves', () => {
    // Found by the FSRS-6 property (properties/memory.test.ts), 6 in
    // 2,000,000 runs, 2026-10-02; kept with both stabilities at its value.
    const s = 0.002616681480501123;
    checkMeanBetween(state(s, s, 5), 99999.99999999977, 1.0000000000000034e-9);
  });

  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses span ${String(bad)} and stability ${String(bad)}`, () => {
      expect(() => meanRetrievability(state(1, 1, 5), 0, bad)).toThrow(/span/);
      expect(() => meanRetrievability(state(bad, 1, 5), 0, 1)).toThrow(
        /^stability/,
      );
    });

  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY])
    it(`refuses a window starting at ${String(bad)} days`, () => {
      expect(() => meanRetrievability(state(1, 1, 5), bad, 1)).toThrow(
        /elapsed/,
      );
    });
});
