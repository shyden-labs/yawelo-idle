import { readFileSync } from 'node:fs';
import type { GameState } from '@yawelo-idle/core';
import { describe, expect, it } from 'vitest';
import { canonicalBytes, loadBlob, save, toBlob } from '../src/index.ts';

/**
 * The cost of a 5-week save (#159 AC4): the golden log's Diligent-style
 * player (core's fixtures/golden-log.ts) at the start of day 34, the last
 * whole state its starts fixture holds (slice 396). Its state is plain JSON,
 * so it is read from the line itself, without core's fixture code.
 *
 * CPU is the process's (user + system), never wall time. Measured on the
 * laptop, 2026-11-16 at load 13, eight write-and-read rounds in one process:
 * the first, cold one 113 ms (the one this test takes), the warm ones 23 to
 * 59 ms; the blob 12,176 bytes of 74,030 canonical. The CPU bound is about
 * 3.5x the cold round, so a slower machine still passes and an encoder ten
 * times slower does not. The size is the same on every run, so its bound is
 * close: about 1.25x.
 */
const STARTS = new URL(
  '../../core/fixtures/golden-starts.jsonl',
  import.meta.url,
);
const SLICE = 396;

/** Process CPU, in milliseconds, of one write and one read of the save. */
const CPU_BOUND_MS = 400;
/** Bytes of the stored blob. */
const SIZE_BOUND_BYTES = 15_000;

function fiveWeekState(): GameState {
  const line = readFileSync(STARTS, 'utf8').split('\n')[SLICE] ?? '';
  const read = JSON.parse(line) as {
    slice: number;
    start: { state: GameState };
  };
  expect(read.slice, 'the starts line read').toBe(SLICE);
  return read.start.state;
}

describe('a 5-week Diligent-style save (#159 AC4)', () => {
  it(`is written and read back in under ${String(CPU_BOUND_MS)} ms of process CPU, as a blob under ${String(SIZE_BOUND_BYTES)} bytes`, () => {
    const saved = save(fiveWeekState(), {}, 'synthetic-1');
    const before = process.cpuUsage();
    const blob = toBlob(saved);
    const result = loadBlob(blob);
    const used = process.cpuUsage(before);
    const cpuMs = (used.user + used.system) / 1_000;
    expect.soft(result.ok, 'read back').toBe(true);
    expect.soft(cpuMs, 'process CPU, ms').toBeLessThan(CPU_BOUND_MS);
    expect.soft(blob.byteLength, 'blob bytes').toBeLessThan(SIZE_BOUND_BYTES);
    expect
      .soft(canonicalBytes(saved).byteLength, 'the save is the 5-week one')
      .toBeGreaterThan(70_000);
  });
});
