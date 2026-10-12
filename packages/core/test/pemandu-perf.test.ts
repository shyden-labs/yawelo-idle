import { describe, expect, it } from 'vitest';
import {
  lateGameReturn,
  regionOneReturn,
  returnsAt,
} from '../fixtures/pemandu-returns';
import { syntheticCourse } from '../fixtures/synthetic-course';
import { DAY_MS, HOUR_MS, simMs, wallMs } from '../src/clock';
import type { Course } from '../src/course';
import { rateBreakdown } from '../src/production';
import { advance } from '../src/sim';
import type { GameState } from '../src/state';

/**
 * Pemandu's returns, on short stand-ins (#544). The 72 h return under
 * 1,000 ms (#33 AC5) and the late-game catch-up's cost a purchase (#297
 * AC3) cost more than a unit test's 0.1 s of CPU on a busy laptop, so they
 * are timed in the pacing suite, `packages/bots/pacing/pemandu-perf.test.ts`.
 * Here the same fixtures make shorter returns, and what each return does is
 * checked without a clock.
 */

/** A minute: the stand-in for the 72 h return. */
const MINUTE_MS = HOUR_MS / 60;

let builtCourse: Course | undefined;

/**
 * The synthetic course, built on first use inside a test and kept, so every
 * test reads the same object (the bucket memo is keyed by it) and a throwing
 * build fails each test that needs it by name, never the file (#97).
 */
function course(): Course {
  builtCourse ??= syntheticCourse(1);
  return builtCourse;
}
function units(state: GameState): number {
  return Object.values(state.owned).reduce((a, b) => a + b, 0);
}

describe('a 1-minute return with Pemandu at 1 s (stand-in for #33 AC5)', () => {
  it('is credited in full and buys once a tick', () => {
    const s = regionOneReturn(course());
    const { state, summary } = advance(course(), s, wallMs(s.wall + MINUTE_MS));
    expect(summary.creditedMs).toBe(60_000);
    expect(summary.clipped).toBe(false);
    // Measured: one unit at each of the minute's 60 ticks. A 15-minute
    // return cost up to 61 ms of CPU cold in the unit suite (#544).
    expect(units(state) - units(s)).toBe(60);
  });
});

describe('a late-game 3-minute catch-up with Pemandu at 1 s (stand-in for #297 AC3)', () => {
  it('buys the 138 units it was measured to buy', () => {
    const from = lateGameReturn(course());
    const { state } = advance(course(), from, returnsAt(from, 0.05));
    expect(units(state) - units(from)).toBe(138);
  });
});

/**
 * What makes the return fast never serves a stale bucket: the memo of each
 * bucket's word factors is keyed by everything they are built from, so a
 * state that shares its words object but differs in any one of them gets
 * the breakdown a cold memo gives.
 */
describe('the bucket memo behind a fast return', () => {
  const node = (): string => course().regions[0]?.grammarNodes[0]?.id ?? '';
  let builtOther: Course | undefined;
  /** A second course with the same word ids, built on first use like course(). */
  function other(): Course {
    builtOther ??= syntheticCourse(2);
    return builtOther;
  }
  // Each change is a function of the state, so no core code runs while the
  // file is collected: a core change that throws then fails these tests by
  // name rather than dropping them from the count.
  type Change = (s: GameState) => Partial<GameState>;

  it.each<readonly [string, () => Course, Change, number]>([
    [
      'memorySince moves, as a review moves it',
      course,
      (s) => ({ memorySince: simMs(s.sim + 600_000) }),
      0,
    ],
    [
      'the skew moves, as a clipped return moves it',
      course,
      (s) => ({ wall: wallMs(s.wall + DAY_MS) }),
      0,
    ],
    ['a grammar node is owned', course, () => ({ grammar: [node()] }), 0],
    ['the next hour', course, () => ({}), HOUR_MS],
    ['another course with the same word ids', other, () => ({}), 0],
  ])('%s', (_label, courseOf, change, later) => {
    const c = courseOf();
    const s0 = regionOneReturn(course());
    const t0 = simMs(s0.sim + 1_234);
    const t = simMs(t0 + later);
    rateBreakdown(course(), s0, t0);
    const s1: GameState = { ...s0, ...change(s0) };
    const cold = rateBreakdown(c, { ...s1, words: { ...s1.words } }, t);
    expect(rateBreakdown(c, s1, t)).toEqual(cold);
    expect(cold).not.toEqual(rateBreakdown(course(), s0, t0));
  });
});
