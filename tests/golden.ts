import { readFileSync } from 'node:fs';
import {
  GOLDEN,
  GOLDEN_HEAVY_SLICES,
  GOLDEN_OPEN_PARTS,
  GOLDEN_SHOP_FREE_SLICES,
  goldenStart,
  parseGoldenEvents,
  readGolden,
  readGoldenSlices,
  readGoldenStart,
  type GoldenHeader,
  type GoldenSlice,
  type PlayerStart,
} from '../packages/core/fixtures/golden-log.ts';
import type { GameEvent } from '../packages/core/src/events.ts';

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

/** A slice as a test table row: its number, day, open and part. */
export type SliceRow = readonly [
  slice: number,
  day: number,
  open: number,
  part: number,
];

const OPENS = GOLDEN.days * GOLDEN.opensPerDay;
const HEAVY: readonly number[] = [...GOLDEN_HEAVY_SLICES];
const PARTS: Readonly<Record<number, number>> = { ...GOLDEN_OPEN_PARTS };

/** Every slice the golden policy plays: each open's parts (#553). */
export const SLICE_ROWS: readonly SliceRow[] = Array.from(
  { length: OPENS },
  (_, open) => open,
)
  .flatMap((open) =>
    Array.from(
      { length: PARTS[open] ?? GOLDEN.minParts },
      (_, part) => [open, part] as const,
    ),
  )
  .map(([open, part], n) => [
    n,
    Math.floor(open / GOLDEN.opensPerDay),
    open % GOLDEN.opensPerDay,
    part,
  ]);
/** The last slice, which ends at the live hash rather than a next slice. */
export const LAST_SLICE = SLICE_ROWS.length - 1;
/** The slices the unit suite replays: all but the heavy. */
export const UNIT_ROWS: readonly SliceRow[] = SLICE_ROWS.filter(
  ([n]) => !HEAVY.includes(n),
);
const SHOP_FREE: readonly number[] = [...GOLDEN_SHOP_FREE_SLICES];
/** The unit slices that read the shop: the shop test judges each. */
export const SHOP_ROWS: readonly SliceRow[] = UNIT_ROWS.filter(
  ([n]) => !SHOP_FREE.includes(n),
);
/** The slices that read no shop (#553): each one's own test proves it. */
export const SHOP_FREE_ROWS: readonly SliceRow[] = SLICE_ROWS.filter(([n]) =>
  SHOP_FREE.includes(n),
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
      readonly header: GoldenHeader;
      readonly slicesHeader: ReturnType<typeof readGoldenSlices>['header'];
      readonly slices: readonly GoldenSlice[];
      readonly startLines: readonly string[];
      readonly course: ReturnType<typeof goldenStart>['course'];
      readonly initial: ReturnType<typeof goldenStart>['initial'];
    }
  | undefined;

/**
 * The three fixtures, read on first use (#97). Events and starts are parsed
 * only when asked for.
 */
export function golden(): NonNullable<typeof read> {
  if (read === undefined) {
    const text = readFileSync(FIXTURE, 'utf8');
    const slicesText = readFileSync(SLICES_FIXTURE, 'utf8');
    const lines = text.split('\n');
    // Only the header is parsed here: each slice parses its own events
    // (#553), so the first test no longer pays for the whole log's.
    const header = JSON.parse(lines[0] ?? '') as GoldenHeader;
    const { header: slicesHeader, slices } = readGoldenSlices(slicesText);
    const startLines = readFileSync(STARTS_FIXTURE, 'utf8').split('\n');
    const { course, initial } = goldenStart(header);
    read = {
      text,
      lines,
      slicesText,
      header,
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

let everyEvent: readonly GameEvent[] | undefined;

/** Every event in the log, read as `readGolden` reads it, for the whole-log runs. */
export function allEvents(): readonly GameEvent[] {
  everyEvent ??= readGolden(golden().text).events;
  return everyEvent;
}

/** The log's event lines: every line after the header but the empty last. */
export function eventLines(): readonly string[] {
  return golden()
    .lines.slice(1)
    .filter((line) => line !== '');
}

const sliceEvents = new Map<number, readonly GameEvent[]>();

/**
 * Slice `n`'s events, parsed from its own lines of the log as `readGolden`
 * parses every line (#553), and those lines.
 */
export function eventsOf(n: number): {
  readonly events: readonly GameEvent[];
  readonly lines: readonly string[];
} {
  const { from, to } = sliceOf(n);
  const lines = golden().lines.slice(1 + from, 1 + to);
  let events = sliceEvents.get(n);
  if (events === undefined) {
    events = parseGoldenEvents(lines, 2 + from);
    sliceEvents.set(n, events);
  }
  return { events, lines };
}

/** Where slice `n` began, rebuilt from its day's start and the deltas after it. */
export function startOf(n: number): PlayerStart {
  const day = SLICE_ROWS[n]?.[1];
  const first = SLICE_ROWS.findIndex((row) => row[1] === day);
  if (first < 0) throw new Error(`no slice ${String(n)}`);
  return readGoldenStart(golden().startLines, n, first);
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
