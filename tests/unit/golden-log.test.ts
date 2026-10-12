import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyStartDelta,
  boughtIn,
  GOLDEN,
  GOLDEN_HEAVY_SLICES,
  goldenPolicyStart,
  goldenStart,
  playGoldenSlice,
  readGolden,
  readGoldenSlices,
  readGoldenStart,
  replayGolden,
  startDelta,
  writeGoldenSlices,
  writeGoldenStarts,
  type GoldenRun,
  type GoldenSlice,
  type PlayerStart,
} from '../../packages/core/fixtures/golden-log';
import { wallMs } from '../../packages/core/src/clock';
import type { GameEvent } from '../../packages/core/src/events';
import { stateHash } from '../../packages/core/src/hash';
import { apply, replay } from '../../packages/core/src/log';
import type { WordMemory } from '../../packages/core/src/memory';
import { initialState, type GameState } from '../../packages/core/src/state';
import {
  eventsOf,
  FIXTURE,
  golden,
  HEAVY_ROWS,
  LAST_SLICE,
  REGENERATE,
  SLICE_ROWS,
  SLICES_FIXTURE,
  sliceOf,
  startOf,
  STARTS_FIXTURE,
  total,
  totals,
  UNIT_ROWS,
  type SliceRow,
} from '../golden';

/**
 * The golden event log (#34 AC5, AC6; M1 design §7), checked one slice per
 * test (#473 by day; #542 by open). `npm run golden-log` writes the log and,
 * beside it, the slices it is cut into (one per open of the golden player)
 * and where each began. For every slice, the policy resumed at the slice's
 * start writes exactly its events, and both `replay` and a walk of the same
 * events with `apply` reach where the next slice starts; the last reaches
 * the live hash the header records. Slice 0 starts where a freshly seeded
 * policy does, and the slices tile the log, so they chain from the first
 * state to the live one.
 *
 * A heavy slice, whose resume alone is over the unit suite's line (#542), is
 * replayed the same way in the pacing suite (`packages/bots/pacing/
 * golden-log.test.ts`), with the whole log played, replayed and judged. The
 * engines suite replays the whole file in Chromium, WebKit and Firefox.
 */

/**
 * Accepted events by type in the fixture, measured when #35's tuned balance
 * regenerated it (2026-10-04); each floor is the measured figure less one and
 * the count must exceed it, so it may not fall below the measurement and a
 * type measured once cannot vanish. Regenerating the log may move them,
 * deliberately. On this balance Insight comes early, so Pemandu opens with
 * its fastest interval already owned and `setAutomation` is sent once.
 */
const ACCEPTED_FLOORS: Readonly<Record<GameEvent['type'], number>> = {
  resume: 174, // 175
  listen: 114, // 115
  buyEncounter: 1664, // 1665
  pickUpWord: 282, // 283
  answerReview: 2011, // 2012
  answerPractice: 123, // 124
  buyUpgrade: 27, // 28
  startJourney: 315, // 316
  collectJourney: 312, // 313
  setSail: 7, // 8
  buyGrammarNode: 11, // 12
  setAutomation: 0, // 1
};

/** Refused events by kind in the fixture, measured likewise, less one. */
const REFUSED_FLOORS: Readonly<Record<string, number>> = {
  staleSeq: 29, // 30
  notDue: 30, // 31
  unknownWord: 34, // 35
  unknownEncounter: 27, // 28
  slotEmpty: 11, // 12
  unknownSlot: 10, // 11
  sailGoalUnmet: 28, // 29
  unknownUpgrade: 31, // 32
};

/** Every slice, one per open, known before the run: one test each. */
const SLICES: readonly SliceRow[] = [...SLICE_ROWS];
/** The slices this suite replays; the heavy ones are the pacing suite's. */
const UNIT: readonly SliceRow[] = [...UNIT_ROWS];
/** The unit slices but the last, each of which ends where the next starts. */
const UNIT_WITH_A_NEXT: readonly SliceRow[] = UNIT.filter(
  ([n]) => n !== LAST_SLICE,
);
/** Every slice but the last, each of which the next one follows. */
const SLICES_WITH_A_NEXT: readonly SliceRow[] = SLICES.filter(
  ([n]) => n !== LAST_SLICE,
);
/** The slices the unit and pacing suites list between them, in order. */
const LISTED: readonly number[] = [...UNIT_ROWS, ...HEAVY_ROWS]
  .map(([n]) => n)
  .sort((a, b) => a - b);

/** Slice `n`'s successor's start: the next slice's, which must exist. */
function nextStart(n: number): PlayerStart {
  if (n >= LAST_SLICE) throw new Error(`slice ${String(n)} is the last`);
  return startOf(n + 1);
}

/** Walk events from a state with `apply`, counting what is accepted and refused. */
function walk(
  state: GameState,
  events: readonly GameEvent[],
): Pick<GoldenSlice, 'accepted' | 'refused'> & { readonly state: GameState } {
  const { course } = golden();
  let current = state;
  const accepted: Record<string, number> = {};
  const refused: Record<string, number> = {};
  for (const event of events) {
    const result = apply(course, current, event);
    if (result.ok) {
      current = result.state;
      accepted[event.type] = (accepted[event.type] ?? 0) + 1;
    } else {
      const { kind } = result.rejection;
      refused[kind] = (refused[kind] ?? 0) + 1;
    }
  }
  return { state: current, accepted, refused };
}

describe('the golden log fixture (AC5)', () => {
  it('was played with the golden seeds for 5 weeks', () => {
    expect(golden().header).toMatchObject({
      format: 1,
      courseSeed: GOLDEN.courseSeed,
      stateSeed: GOLDEN.stateSeed,
      policySeed: GOLDEN.policySeed,
      days: 35,
    });
  });

  it('opens with the header line writeGolden writes', () => {
    const { text, header, events, initial } = golden();
    const written = JSON.stringify({
      format: 1,
      courseSeed: GOLDEN.courseSeed,
      stateSeed: GOLDEN.stateSeed,
      policySeed: GOLDEN.policySeed,
      days: GOLDEN.days,
      startWallMs: initial.wall,
      events: events.length,
      liveHash: header.liveHash,
    });
    expect(text.split('\n')[0], REGENERATE).toBe(written);
  });

  it('cuts the log at each of the 5 opens a day, as its header states, from measurement (#542 AC1)', () => {
    expect(golden().slicesHeader).toEqual({
      format: 1,
      boundary: 'open',
      opensPerDay: 5,
      heavyPurchases: 1000,
      slices: 175,
      measured: expect.stringContaining('#542') as unknown,
    });
  });

  it('keeps its slices in the form writeGoldenSlices writes', () => {
    const { slicesText, slices } = golden();
    const run = { slices } as unknown as GoldenRun;
    expect(writeGoldenSlices(run) === slicesText, REGENERATE).toBe(true);
  });

  it('names as heavy the slices the test files list as heavy', () => {
    expect(
      golden()
        .slices.filter((slice) => slice.heavy)
        .map((slice) => slice.slice),
      REGENERATE,
    ).toEqual(GOLDEN_HEAVY_SLICES);
  });

  it('starts its first slice at the first event, where a freshly seeded policy starts', () => {
    expect(sliceOf(0).from).toBe(0);
    expect(startOf(0)).toEqual(goldenPolicyStart(golden().initial));
  });

  it('ends its last slice at the log’s last event', () => {
    expect(sliceOf(LAST_SLICE).to).toBe(golden().events.length);
  });
});

describe('the slices tile the log (#542 AC2)', () => {
  it.each(SLICES)('slice %i is day %i’s open %i', (n, day, open) => {
    expect(sliceOf(n)).toMatchObject({ slice: n, day, open });
  });

  it.each(SLICES)('slice %i holds at least one event', (n) => {
    const { from, to } = sliceOf(n);
    expect(to).toBeGreaterThan(from);
  });

  it.each(SLICES_WITH_A_NEXT)(
    'slice %i ends where the next begins: no gap, no overlap',
    (n) => {
      expect(sliceOf(n).to).toBe(sliceOf(n + 1).from);
    },
  );

  it.each(SLICES)(
    'slice %i plays at the times its day’s first open drew',
    (n, _day, open) => {
      expect(sliceOf(n).opens).toEqual(sliceOf(n - open).opens);
    },
  );

  it.each(SLICES)(
    'slice %i is heavy exactly when its resume bought over the line',
    (n) => {
      const { heavy, purchases } = sliceOf(n);
      expect(heavy).toBe(purchases > GOLDEN.heavyPurchases);
    },
  );

  it('lists every slice once between the unit and pacing suites', () => {
    expect(LISTED).toEqual(SLICES.map(([n]) => n));
  });
});

describe('each unit slice, from its start (AC5, #542)', () => {
  it.each(UNIT_WITH_A_NEXT)(
    'slice %i (day %i, open %i): the policy, resumed at its start, writes exactly its events and ends where the next slice starts',
    (n) => {
      const slice = sliceOf(n);
      const { events, lines } = eventsOf(n);
      const played = playGoldenSlice(golden().course, slice, startOf(n));
      expect(played.events, REGENERATE).toEqual(events);
      expect(
        played.events.map((e) => JSON.stringify(e)),
        REGENERATE,
      ).toEqual(lines);
      expect(played.opens, REGENERATE).toEqual(slice.opens);
      expect(played.end, REGENERATE).toEqual(nextStart(n));
      expect({ accepted: played.accepted, refused: played.refused }).toEqual({
        accepted: slice.accepted,
        refused: slice.refused,
      });
    },
  );

  it('the last slice: the policy, resumed at its start, writes exactly its events and ends at the live hash', () => {
    const slice = sliceOf(LAST_SLICE);
    const { events, lines } = eventsOf(LAST_SLICE);
    const played = playGoldenSlice(golden().course, slice, startOf(LAST_SLICE));
    expect(played.events, REGENERATE).toEqual(events);
    expect(
      played.events.map((e) => JSON.stringify(e)),
      REGENERATE,
    ).toEqual(lines);
    expect(played.opens, REGENERATE).toEqual(slice.opens);
    expect(stateHash(played.end.state), REGENERATE).toBe(
      golden().header.liveHash,
    );
    expect({ accepted: played.accepted, refused: played.refused }).toEqual({
      accepted: slice.accepted,
      refused: slice.refused,
    });
  });

  it.each(UNIT_WITH_A_NEXT)(
    'slice %i (day %i, open %i): replay of its events from its start reaches where the next slice starts',
    (n) => {
      const replayed = replay(
        golden().course,
        startOf(n).state,
        eventsOf(n).events,
      );
      expect(replayed.state, REGENERATE).toEqual(nextStart(n).state);
      expect(replayed.refused).toHaveLength(total(sliceOf(n).refused));
    },
  );

  it('the last slice: replay of its events from its start reaches the live hash', () => {
    const replayed = replay(
      golden().course,
      startOf(LAST_SLICE).state,
      eventsOf(LAST_SLICE).events,
    );
    expect(stateHash(replayed.state), REGENERATE).toBe(
      golden().header.liveHash,
    );
    expect(replayed.refused).toHaveLength(total(sliceOf(LAST_SLICE).refused));
  });

  it.each(UNIT_WITH_A_NEXT)(
    'slice %i (day %i, open %i): a walk of its events with apply reaches where the next slice starts and counts what was recorded',
    (n) => {
      const slice = sliceOf(n);
      const walked = walk(startOf(n).state, eventsOf(n).events);
      expect(walked.state, REGENERATE).toEqual(nextStart(n).state);
      expect({ accepted: walked.accepted, refused: walked.refused }).toEqual({
        accepted: slice.accepted,
        refused: slice.refused,
      });
    },
  );

  it('the last slice: a walk of its events with apply reaches the live hash and counts what was recorded', () => {
    const slice = sliceOf(LAST_SLICE);
    const walked = walk(startOf(LAST_SLICE).state, eventsOf(LAST_SLICE).events);
    expect(stateHash(walked.state), REGENERATE).toBe(golden().header.liveHash);
    expect({ accepted: walked.accepted, refused: walked.refused }).toEqual({
      accepted: slice.accepted,
      refused: slice.refused,
    });
  });

  it.each(UNIT)(
    'slice %i (day %i, open %i): its first event bought the Encounters recorded',
    (n) => {
      const [first] = eventsOf(n).events;
      if (first === undefined) throw new Error(`slice ${String(n)} is empty`);
      expect(boughtIn(golden().course, startOf(n).state, first)).toBe(
        sliceOf(n).purchases,
      );
    },
  );
});

describe('the whole log’s counts (AC5)', () => {
  it.each(Object.entries(ACCEPTED_FLOORS))(
    'accepts %s events, at least the floor',
    (type, floor) => {
      expect(totals('accepted')[type] ?? 0).toBeGreaterThan(floor);
    },
  );

  it.each(Object.entries(REFUSED_FLOORS))(
    'refuses %s events, at least the floor',
    (kind, floor) => {
      expect(totals('refused')[kind] ?? 0).toBeGreaterThan(floor);
    },
  );

  it('refuses nothing else', () => {
    expect(Object.keys(totals('refused')).sort()).toEqual(
      Object.keys(REFUSED_FLOORS).sort(),
    );
  });

  it('steps the device clock back once a day (AC3): 35 measured', () => {
    let clockBack = 0;
    let latest = 0;
    for (const event of golden().events) {
      if (event.wallMs < latest) clockBack += 1;
      latest = Math.max(latest, event.wallMs);
    }
    expect(clockBack).toBeGreaterThanOrEqual(34);
  });
});

describe('the live state and its replay (AC6)', () => {
  it('start from the same state', () => {
    expect(goldenStart(golden().header).initial).toEqual(startOf(0).state);
  });
});

describe('replayGolden (AC5)', () => {
  /** The fixture's first slice alone, its header's count set to match. */
  function firstSlice(): string {
    const length = sliceOf(0).to;
    const lines = golden()
      .text.split('\n')
      .slice(0, length + 1);
    const header = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    lines[0] = JSON.stringify({ ...header, events: length });
    return lines.join('\n') + '\n';
  }

  it('gives Node, over the first slice, the hash of where the second slice starts', () => {
    expect(replayGolden(firstSlice())).toEqual({
      hash: stateHash(startOf(1).state),
      events: sliceOf(0).to,
      refused: total(sliceOf(0).refused),
    });
  });
});

describe('readGolden (AC5)', () => {
  /** The fixture's first 20 lines with its header's count set to match. */
  function head(): string[] {
    const lines = readFileSync(FIXTURE, 'utf8').split('\n').slice(0, 21);
    const header = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    lines[0] = JSON.stringify({ ...header, events: 20 });
    return lines;
  }

  it('reads a well-formed log', () => {
    expect(readGolden(head().join('\n')).events).toHaveLength(20);
  });

  it('names the line that does not parse', () => {
    const lines = head();
    lines[3] = JSON.stringify({ type: 'listen', seq: 0, wallMs: 0 });
    expect(() => readGolden(lines.join('\n'))).toThrow('golden log line 4');
  });

  it('refuses a log whose length differs from its header', () => {
    expect(() => readGolden(head().slice(0, -2).join('\n'))).toThrow(
      'header says',
    );
  });

  it('refuses an empty log', () => {
    expect(() => readGolden('')).toThrow('empty');
  });
});

describe('readGoldenSlices (#542)', () => {
  /** The slices fixture's header and first three slices, its count set to match. */
  function firstSlices(): string[] {
    const lines = readFileSync(SLICES_FIXTURE, 'utf8').split('\n').slice(0, 4);
    const header = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    lines[0] = JSON.stringify({ ...header, slices: 3 });
    return lines;
  }

  it('reads well-formed slices', () => {
    expect(
      readGoldenSlices(firstSlices().join('\n')).slices.map((s) => s.slice),
    ).toEqual([0, 1, 2]);
  });

  it('names a line whose slice is out of order', () => {
    const lines = firstSlices();
    [lines[2], lines[3]] = [lines[3] ?? '', lines[2] ?? ''];
    expect(() => readGoldenSlices(lines.join('\n'))).toThrow(
      'golden slices line 3 is slice 2',
    );
  });

  it('refuses slices whose count differs from their header', () => {
    expect(() =>
      readGoldenSlices(firstSlices().slice(0, -1).join('\n')),
    ).toThrow('header says 3');
  });

  it('refuses empty slices', () => {
    expect(() => readGoldenSlices('')).toThrow('empty');
  });
});

describe('readGoldenStart (#542)', () => {
  /** The starts fixture's first day: a whole start, then four deltas. */
  function firstDay(): string[] {
    return readFileSync(STARTS_FIXTURE, 'utf8').split('\n').slice(0, 5);
  }

  it('rebuilds a later open’s start from its day’s start and the deltas before it', () => {
    expect(readGoldenStart(firstDay(), 4)).toEqual(startOf(4));
  });

  it('names a line that holds another slice', () => {
    const lines = firstDay();
    [lines[1], lines[2]] = [lines[2] ?? '', lines[1] ?? ''];
    expect(() => readGoldenStart(lines, 2)).toThrow(
      'golden starts line 2 is slice 2',
    );
  });

  it('names a day’s first line that holds a delta, not a whole start', () => {
    const lines = firstDay();
    const delta = JSON.parse(lines[1] ?? '{}') as Record<string, unknown>;
    lines[0] = JSON.stringify({ ...delta, slice: 0 });
    expect(() => readGoldenStart(lines, 0)).toThrow(
      'golden starts line 1 holds no whole start',
    );
  });

  it('names a later line that holds a whole start, not a delta', () => {
    const lines = firstDay();
    const whole = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    lines[1] = JSON.stringify({ ...whole, slice: 1 });
    expect(() => readGoldenStart(lines, 1)).toThrow(
      'golden starts line 2 holds no delta',
    );
  });

  it('names a line that is missing', () => {
    expect(() => readGoldenStart(firstDay().slice(0, 3), 3)).toThrow(
      'golden starts line 4 is missing',
    );
  });
});

describe('startDelta and applyStartDelta (#542)', () => {
  /** A word whose card is due at `due`: only its JSON is compared. */
  const word = (due: number): WordMemory =>
    ({ rank: 'heard', card: { due } }) as unknown as WordMemory;

  /** A small start: the first state, with the given words, at policy step `seq`. */
  function start(words: Record<string, WordMemory>, seq = 0): PlayerStart {
    const state = initialState(wallMs(0), 1);
    return { ...goldenPolicyStart({ ...state, words }), seq };
  }

  /** `to` rebuilt from `from` through the delta, as JSON, keys in order. */
  const rebuilt = (from: PlayerStart, to: PlayerStart): string =>
    JSON.stringify(applyStartDelta(from, startDelta(from, to)));

  it('rebuilds a start whose policy step moved', () => {
    const from = start({ a: word(1) });
    const to = start({ a: word(1) }, 7);
    expect(rebuilt(from, to)).toBe(JSON.stringify(to));
  });

  it('rebuilds a start whose state field changed', () => {
    const from = start({ a: word(1) });
    const to = { ...from, state: { ...from.state, stamps: 3 } };
    expect(rebuilt(from, to)).toBe(JSON.stringify(to));
  });

  it('records only the field that changed', () => {
    const from = start({ a: word(1) });
    const to = { ...from, state: { ...from.state, stamps: 3 } };
    expect(startDelta(from, to)).toMatchObject({
      set: { stamps: 3 },
      unset: [],
      words: {},
      wordsUnset: [],
    });
  });

  it('rebuilds a start whose word changed, in its place', () => {
    const from = start({ a: word(1), b: word(2) });
    const to = start({ a: word(5), b: word(2) });
    expect(rebuilt(from, to)).toBe(JSON.stringify(to));
  });

  it('rebuilds a start with a new word, last', () => {
    const from = start({ a: word(1) });
    const to = start({ a: word(1), b: word(2) });
    expect(rebuilt(from, to)).toBe(JSON.stringify(to));
  });

  it('rebuilds a start that lost a word', () => {
    const from = start({ a: word(1), b: word(2) });
    const to = start({ b: word(2) });
    expect(rebuilt(from, to)).toBe(JSON.stringify(to));
  });

  it('rebuilds a start that lost a state field', () => {
    const from = start({ a: word(1) });
    const rest = Object.fromEntries(
      Object.entries(from.state).filter(([key]) => key !== 'stamps'),
    );
    const to = { ...from, state: rest as unknown as GameState };
    expect(rebuilt(from, to)).toBe(JSON.stringify(to));
  });

  it('cannot rebuild words that only changed order, so writeGoldenStarts refuses them', () => {
    const from = start({ a: word(1), b: word(2) });
    const to = start({ b: word(2), a: word(1) });
    const run = {
      slices: [{ open: 0 }, { open: 1 }],
      starts: [from, to],
    } as unknown as GoldenRun;
    expect(() => writeGoldenStarts(run)).toThrow(
      "slice 1's start does not rebuild from its delta",
    );
  });

  it('writes a day’s first open whole and each later open as a delta', () => {
    const from = start({ a: word(1) });
    const to = start({ a: word(1) }, 7);
    const run = {
      slices: [{ open: 0 }, { open: 1 }],
      starts: [from, to],
    } as unknown as GoldenRun;
    const lines = writeGoldenStarts(run).split('\n');
    expect(readGoldenStart(lines, 1)).toEqual(to);
    expect(Object.keys(JSON.parse(lines[0] ?? '{}') as object)).toEqual([
      'slice',
      'start',
    ]);
    expect(Object.keys(JSON.parse(lines[1] ?? '{}') as object)).toEqual([
      'slice',
      'delta',
    ]);
  });
});
