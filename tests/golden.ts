import { readFileSync } from 'node:fs';
import {
  GOLDEN,
  GOLDEN_HEAVY_SLICES,
  goldenStart,
  readGolden,
  readGoldenSlices,
  readGoldenStart,
  type GoldenSlice,
  type PlayerStart,
} from '../packages/core/fixtures/golden-log';
import type { GameEvent } from '../packages/core/src/events';

/**
 * The golden log, read for the tests that replay it a slice at a time
 * (#473, #479, #542): the unit suite's light slices and the pacing suite's
 * heavy ones and whole-log runs.
 *
 * The slice tables below are data, worked out from constants alone, so a
 * test file can list its cases while Vitest collects it without calling
 * anything (#97). The fixtures are read on first use, inside a test.
 */

export const FIXTURE = 'packages/core/fixtures/golden-log.jsonl';
export const SLICES_FIXTURE = 'packages/core/fixtures/golden-slices.jsonl';
export const STARTS_FIXTURE = 'packages/core/fixtures/golden-starts.jsonl';
export const REGENERATE = 'regenerate with `npm run golden-log`';

/** A slice as a test table row: its number, day and open. */
export type SliceRow = readonly [slice: number, day: number, open: number];

const COUNT = GOLDEN.days * GOLDEN.opensPerDay;
const HEAVY: readonly number[] = [...GOLDEN_HEAVY_SLICES];
const row = (n: number): SliceRow => [
  n,
  Math.floor(n / GOLDEN.opensPerDay),
  n % GOLDEN.opensPerDay,
];

/** Every slice the golden policy plays: one per open. */
export const SLICE_ROWS: readonly SliceRow[] = Array.from(
  { length: COUNT },
  (_, n) => row(n),
);
/** The last slice, which ends at the live hash rather than a next slice. */
export const LAST_SLICE = COUNT - 1;
/** The slices the unit suite replays: all but the heavy. */
export const UNIT_ROWS: readonly SliceRow[] = SLICE_ROWS.filter(
  ([n]) => !HEAVY.includes(n),
);
/** The heavy slices, which the pacing suite replays. */
export const HEAVY_ROWS: readonly SliceRow[] = SLICE_ROWS.filter(([n]) =>
  HEAVY.includes(n),
);

let read:
  | {
      readonly text: string;
      readonly lines: readonly string[];
      readonly slicesText: string;
      readonly header: ReturnType<typeof readGolden>['header'];
      readonly events: readonly GameEvent[];
      readonly slicesHeader: ReturnType<typeof readGoldenSlices>['header'];
      readonly slices: readonly GoldenSlice[];
      readonly startLines: readonly string[];
      readonly course: ReturnType<typeof goldenStart>['course'];
      readonly initial: ReturnType<typeof goldenStart>['initial'];
    }
  | undefined;

/** The three fixtures, read on first use (#97). Starts are parsed only when asked for. */
export function golden(): NonNullable<typeof read> {
  if (read === undefined) {
    const text = readFileSync(FIXTURE, 'utf8');
    const slicesText = readFileSync(SLICES_FIXTURE, 'utf8');
    const { header, events } = readGolden(text);
    const { header: slicesHeader, slices } = readGoldenSlices(slicesText);
    const startLines = readFileSync(STARTS_FIXTURE, 'utf8').split('\n');
    const { course, initial } = goldenStart(header);
    read = {
      text,
      lines: text.split('\n'),
      slicesText,
      header,
      events,
      slicesHeader,
      slices,
      startLines,
      course,
      initial,
    };
  }
  return read;
}

/** Slice `n` as recorded; throws for a slice the fixture does not hold. */
export function sliceOf(n: number): GoldenSlice {
  const slice = golden().slices[n];
  if (slice === undefined)
    throw new Error(`${SLICES_FIXTURE} has no slice ${String(n)}`);
  return slice;
}

/** Slice `n`'s events in the log, and the same as the fixture's own lines. */
export function eventsOf(n: number): {
  readonly events: readonly GameEvent[];
  readonly lines: readonly string[];
} {
  const { from, to } = sliceOf(n);
  const { lines, events } = golden();
  return {
    events: events.slice(from, to),
    lines: lines.slice(1 + from, 1 + to),
  };
}

/** Where slice `n` began, rebuilt from its day's start and the deltas after it. */
export function startOf(n: number): PlayerStart {
  return readGoldenStart(golden().startLines, n);
}

/** Every slice's recorded counts added up: each slice's own tests prove its figures. */
export function totals(
  which: 'accepted' | 'refused',
): Readonly<Record<string, number>> {
  const sum: Record<string, number> = {};
  for (const slice of golden().slices) {
    for (const [key, n] of Object.entries(slice[which]))
      sum[key] = (sum[key] ?? 0) + n;
  }
  return sum;
}

export const total = (counts: Readonly<Record<string, number>>): number =>
  Object.values(counts).reduce((a, b) => a + b, 0);
