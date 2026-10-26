import { describe, expect, it } from 'vitest';
import { floorBreach } from '../../../tests/floors.ts';
import {
  lateGameReturn,
  regionOneReturn,
  returnsAt,
} from '../../core/fixtures/pemandu-returns.ts';
import { syntheticCourse } from '../../core/fixtures/synthetic-course.ts';
import { HOUR_MS, wallMs } from '../../core/src/clock.ts';
import { advance } from '../../core/src/sim.ts';
import type { GameState } from '../../core/src/state.ts';

/**
 * Pemandu's long returns, timed (#33 AC5, #297 AC3). They cost more than a
 * unit test's 0.1 s of CPU on a busy laptop, so they run here (#544), and
 * `packages/core/test/pemandu-perf.test.ts` keeps short returns of the same
 * fixtures as stand-ins. Each figure is this thread's CPU, never wall time
 * nor the process's, which counts V8's compiler and GC threads (global rule,
 * 2026-10-07).
 */

function units(state: GameState): number {
  return Object.values(state.owned).reduce((a, b) => a + b, 0);
}

/** This thread's CPU since `start`, in milliseconds. */
function cpuMsSince(start: NodeJS.CpuUsage): number {
  const used = process.threadCpuUsage(start);
  return (used.user + used.system) / 1_000;
}

/**
 * A 72 h offline return with Pemandu at 1 s over the synthetic course: under
 * 1,000 ms. The player (`regionOneReturn`) has finished region 1 and stands
 * at region 2's first destination: every word of region 1 and of that
 * destination held, each reviewed twice at its own time over the last 20
 * days, every Encounter of region 1 owned and a few of region 2's. 259,200
 * ticks fall in the return.
 */
describe('a 72 h return with Pemandu at 1 s (#33 AC5)', () => {
  it('is credited in full and buys on the way, in under 1,000 ms', () => {
    const course = syntheticCourse(1);
    const s = regionOneReturn(course);
    const wallStart = performance.now();
    const cpuStart = process.threadCpuUsage();
    const { state, summary } = advance(
      course,
      s,
      wallMs(s.wall + 72 * HOUR_MS),
    );
    const ms = cpuMsSince(cpuStart);
    const wall = performance.now() - wallStart;
    const bought = units(state) - units(s);
    console.log(
      `#33 AC5: a 72 h return at 1 s took ${ms.toFixed(1)} ms of this thread's CPU (${wall.toFixed(1)} ms of wall time) and bought ${String(bought)} units`,
    );
    expect(summary.creditedMs).toBe(72 * HOUR_MS);
    expect(summary.clipped).toBe(false);
    // The return really buys: the measured count is recorded (#378).
    expect(
      floorBreach('pemandu-perf/72 h return bought', bought),
    ).toBeUndefined();
    expect(ms).toBeLessThan(1_000);
  });
});

/**
 * A late-game player's 1 h catch-up (#297 AC3): every region reached, all
 * 450 words held, Understanding banked, so Pemandu buys densely. Before
 * #297 it cost 75.0 / 74.9 µs of CPU a purchase (AC1, `npm run
 * bench:pemandu`, load about 5). AC3's tenth is measured there, beside the
 * old code, and recorded on #297; this test guards a slide back
 * (operator, 2026-10-08: "Generous CI ceiling", then "40 µs in the runner",
 * then "100 µs" once 40 failed on CI).
 *
 * Inside vitest the same code runs about 2.5x slower than bundled, and the
 * process's CPU counts V8's compiler and GC threads, busy in a fresh worker
 * (measured: 15 to 89 µs a purchase by process, 15 to 41 by this thread).
 * So the figure is this thread's CPU, the fastest of a few catch-ups, each
 * on a fresh course so no memo carries. Measured 2026-10-08 on the laptop at
 * load 4: about 15 µs; the code before #297, about 119 µs. CI runners are
 * about 2x slower and vary: seven CI runs gave 18.2, 24.6, 27.3, 27.6, 32.9,
 * 35.0 and 48.4 µs, and 48.4 failed a 40 µs ceiling. 100 µs is about twice
 * the slowest CI figure and, by the laptop's 8x, under half the old code's
 * cost on CI (estimated about 240 µs, not measured there).
 */
const CATCH_UPS = 6;
const CEILING_US = 100;

describe('a late-game catch-up with Pemandu at 1 s (#297 AC3)', () => {
  it(`buys at under ${String(CEILING_US)} µs of CPU a purchase, the fastest of ${String(CATCH_UPS)}`, () => {
    const costs: number[] = [];
    // one scenario: the fastest of a few runs of one catch-up, for the
    // machine's load, not a population of cases.
    for (let run = 0; run < CATCH_UPS; run += 1) {
      const fresh = syntheticCourse(1);
      const from = lateGameReturn(fresh);
      const cpuStart = process.threadCpuUsage();
      const { state } = advance(fresh, from, returnsAt(from, 1));
      const cpu = process.threadCpuUsage(cpuStart);
      const bought = units(state) - units(from);
      // The catch-up the figures were measured on.
      expect(bought).toBe(428);
      costs.push((cpu.user + cpu.system) / bought);
    }
    const fastest = Math.min(...costs);
    console.log(
      `#297 AC3: a late-game 1 h catch-up took ${fastest.toFixed(2)} µs of this thread's CPU a purchase at its fastest of ${String(CATCH_UPS)} (${costs.map((c) => c.toFixed(1)).join(', ')})`,
    );
    expect(fastest).toBeLessThan(CEILING_US);
  });
});
