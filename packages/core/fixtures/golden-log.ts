import { automationUnlocked, bestPayback } from '../src/automation';
import { wallMs, type WallMs } from '../src/clock';
import type { Course } from '../src/course';
import { parseEvent, PROMPT_TYPES, type GameEvent } from '../src/events';
import { stateHash } from '../src/hash';
import { journeyDurationMs, journeyStatus } from '../src/journeys';
import { apply, replay } from '../src/log';
import { reviewQueue, type WordMemory } from '../src/memory';
import { nextFloat, nextInt, seedRng, type RngState } from '../src/rng';
import { sailPreview } from '../src/sail';
import { advance } from '../src/sim';
import { initialState, type GameState } from '../src/state';
import {
  journeySlots,
  pemanduIntervalsMs,
  upgradeCatalogue,
} from '../src/upgrades';
import {
  judgeShopAlong,
  shopCounts,
  type ShopCount,
  type ShopKind,
} from './shop-agreement';
import { BOT_EPOCH_WALL_MS, syntheticCourse } from './synthetic-course';

/**
 * The golden event log (M1 design §7, #34 AC5): a seeded 5-week
 * Diligent-style player on the synthetic course, written as a committed
 * fixture by `npm run golden-log` and replayed in Node and in each browser
 * engine to the same `stateHash`.
 *
 * The player opens 5 times a day for 8 minutes (60 minutes on the first
 * open), between 08:00 and 22:00, and records `resume` on each open. It
 * collects returned Journeys, answers every due review (correct with the
 * word's retrievability), restarts Journeys with the longest duration that
 * returns before the next open, buys upgrades in catalogue order and grammar
 * nodes in course order when it can, turns Pemandu on once it opens and
 * moves it to the fastest interval it owns, sails
 * as soon as it can, and in between buys the Encounter that pays back
 * soonest (until Pemandu buys for it), picks up words and practises one.
 * It taps Listen while it owns nothing.
 *
 * So the replay exercises refusals too, each open also sends one event the
 * rules refuse (a stale `seq`, a review not due, an unknown Encounter, an
 * empty slot, an unmet sail, an unknown upgrade), and once a day the device
 * clock steps back 5 minutes, which `apply` clamps. The refusal goes after
 * collecting and reviewing and before Journeys restart, so a slot that has
 * just been collected is empty when an empty-slot refusal is drawn (on #35's
 * balance every slot was busy by the end of the open, and none was sent).
 */

export const GOLDEN = {
  courseSeed: 1,
  stateSeed: 34,
  policySeed: 3434,
  days: 35,
  /** The player opens the game 5 times a day; each open is one slice (#542). */
  opensPerDay: 5,
  /**
   * A slice whose first event is a resume in which Pemandu buys more than
   * this many Encounters is heavy (#542): that one event alone measured
   * 13.7–24.8 ms of thread CPU in Node and up to 110 ms under Vitest, over
   * the unit suite's line, so the slice runs in the pacing suite. The
   * heaviest resume below it bought 314 (4.3 ms); the lightest above, 1,329.
   */
  heavyPurchases: 1000,
} as const;

/**
 * The heavy slices, as `npm run golden-log` finds them (#542). Kept here as
 * data, so a test file can list its slices without calling anything while
 * Vitest collects it (#97); the recorder refuses to write a log whose heavy
 * slices differ, and a unit test holds this list to the recorded one.
 */
export const GOLDEN_HEAVY_SLICES: readonly number[] = [107, 118, 134, 150, 161];

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** The gap between two events of one burst. */
const STEP_MS = 500;
/** How often an open makes its purchases. */
const PASS_MS = 2 * MINUTE_MS;

export interface GoldenRun {
  readonly initial: GameState;
  readonly events: readonly GameEvent[];
  /** The state the player lived: every event applied as it was decided. */
  readonly live: GameState;
  /** Each open of the play: what it sent (#473, #542). */
  readonly slices: readonly GoldenSlice[];
  /** Where the policy stood as each slice began, one per slice. */
  readonly starts: readonly PlayerStart[];
}

/** Where the policy stands at a moment: all it needs to play on from there. */
export interface PlayerStart {
  readonly state: GameState;
  readonly rng: RngState;
  readonly seq: number;
  readonly t: number;
}

/**
 * One open of the golden play (#542; a day before it, #473): its events are
 * the log's `[from, to)`. `opens` are the day's open times, drawn as its first
 * open began, so a later open plays on from its own start. `purchases` are
 * the Encounters bought inside the slice's first event, its resume, where
 * Pemandu buys across the gap; past `GOLDEN.heavyPurchases` the slice is
 * `heavy`. `accepted` counts its events the rules accepted, by type, and
 * `refused` those refused, by kind, as the play itself counted them; `shop`
 * is its shop offers judged against `apply` (#479).
 */
export interface GoldenSlice {
  readonly slice: number;
  readonly day: number;
  readonly open: number;
  readonly from: number;
  readonly to: number;
  readonly opens: readonly number[];
  readonly purchases: number;
  readonly heavy: boolean;
  readonly accepted: Readonly<Record<string, number>>;
  readonly refused: Readonly<Record<string, number>>;
  readonly shop: Readonly<Record<ShopKind, ShopCount>>;
}

/** What one slice played again from its start sends, and where it ends. */
export interface PlayedSlice {
  readonly events: readonly GameEvent[];
  readonly end: PlayerStart;
  readonly opens: readonly number[];
  readonly accepted: Readonly<Record<string, number>>;
  readonly refused: Readonly<Record<string, number>>;
}

/** The refusals an open may send, one per open, drawn from the policy stream. */
const REFUSALS = [
  'staleSeq',
  'notDue',
  'unknownEncounter',
  'slotEmpty',
  'sailGoalUnmet',
  'unknownUpgrade',
] as const;

class Player {
  state: GameState;
  private rng: RngState;
  private seq: number;
  private t: number;
  readonly events: GameEvent[] = [];
  private accepted: Record<string, number> = {};
  private refused: Record<string, number> = {};

  constructor(
    private readonly course: Course,
    start: PlayerStart,
  ) {
    this.state = start.state;
    this.rng = start.rng;
    this.seq = start.seq;
    this.t = start.t;
  }

  /** Where the policy stands now: what a day played from here starts from. */
  start(): PlayerStart {
    return { state: this.state, rng: this.rng, seq: this.seq, t: this.t };
  }

  /** What was sent since the last call, accepted by type and refused by kind. */
  takeCounts(): Pick<GoldenSlice, 'accepted' | 'refused'> {
    const counts = { accepted: this.accepted, refused: this.refused };
    this.accepted = {};
    this.refused = {};
    return counts;
  }

  float(): number {
    const draw = nextFloat(this.rng);
    this.rng = draw.state;
    return draw.value;
  }

  int(n: number): number {
    const draw = nextInt(this.rng, n);
    this.rng = draw.state;
    return draw.value;
  }

  now(): WallMs {
    return wallMs(this.t);
  }

  /** The state as the player sees it now: advanced, never stored. */
  seen(): GameState {
    return advance(this.course, this.state, this.now()).state;
  }

  /**
   * Send one event at the current time. An accepted one is kept; a refused
   * one is kept only when `expectRefusal` says the player meant it, and an
   * event the player meant to be refused but was accepted is thrown.
   */
  send(event: GameEvent, expectRefusal = false): boolean {
    const result = apply(this.course, this.state, event);
    if (result.ok === expectRefusal) {
      if (expectRefusal) {
        throw new Error(
          `meant to be refused, accepted: ${JSON.stringify(event)}`,
        );
      }
      return false;
    }
    this.events.push(event);
    if (result.ok) {
      this.state = result.state;
      this.accepted[event.type] = (this.accepted[event.type] ?? 0) + 1;
    } else {
      const { kind } = result.rejection;
      this.refused[kind] = (this.refused[kind] ?? 0) + 1;
    }
    this.t += STEP_MS;
    return result.ok;
  }

  /** The fields every event carries, numbering a new one. */
  stamp(): { seq: number; wallMs: WallMs } {
    this.seq += 1;
    return { seq: this.seq, wallMs: this.now() };
  }

  /** Undo the numbering of an event that was not sent. */
  unstamp(): void {
    this.seq -= 1;
  }

  try(make: (stamp: { seq: number; wallMs: WallMs }) => GameEvent): boolean {
    const sent = this.send(make(this.stamp()));
    if (!sent) this.unstamp();
    return sent;
  }

  open(
    start: number,
    lengthMs: number,
    nextOpen: number,
    clockBack: boolean,
  ): void {
    this.t = Math.max(start, this.t + STEP_MS);
    const end = this.t + lengthMs;
    this.try((s) => ({ type: 'resume', ...s }));
    this.collect();
    this.review();
    this.refusal();
    this.journeys(nextOpen);
    this.upgrades();
    this.grammar();
    this.automation();
    let pass = 0;
    while (this.t < end) {
      if (clockBack && pass === 1) {
        // The device clock steps back: clamped, never refused (DN21).
        this.t -= 5 * MINUTE_MS;
        this.try((s) => ({ type: 'listen', ...s }));
        this.t += 5 * MINUTE_MS;
      }
      this.purchases();
      this.t += PASS_MS;
      pass += 1;
    }
  }

  collect(): void {
    for (let slot = 0; slot < journeySlots(this.state); slot += 1) {
      if (journeyStatus(this.seen(), slot) === 'returned') {
        this.try((s) => ({ type: 'collectJourney', ...s, slot }));
      }
    }
  }

  review(): void {
    for (let guard = 0; guard < 200; guard += 1) {
      const item = reviewQueue(this.seen().words, this.now())[0];
      if (item === undefined) return;
      const correct = this.float() < item.retrievability;
      const latencyMs = 1000 + this.int(4000);
      const promptType =
        PROMPT_TYPES[this.int(PROMPT_TYPES.length)] ?? 'choice';
      const event = (s: { seq: number; wallMs: WallMs }): GameEvent => ({
        type: 'answerReview',
        ...s,
        itemId: item.itemId,
        correct,
        latencyMs,
        promptType,
      });
      if (!this.try(event))
        throw new Error(`due review refused: ${item.itemId}`);
    }
  }

  journeys(nextOpen: number): void {
    for (let slot = 0; slot < journeySlots(this.state); slot += 1) {
      if (journeyStatus(this.seen(), slot) !== 'empty') continue;
      const gap = nextOpen - this.t;
      const ids = this.state.tutorialJourneyUsed
        ? (['24h', '8h', '4h', '2h'] as const)
        : (['tutorial'] as const);
      const durationId =
        ids.find((id) => journeyDurationMs(this.state, id) <= gap) ??
        ids[ids.length - 1];
      if (durationId === undefined) return;
      this.try((s) => ({ type: 'startJourney', ...s, slot, durationId }));
    }
  }

  upgrades(): void {
    for (const { id } of upgradeCatalogue(this.course)) {
      while (this.try((s) => ({ type: 'buyUpgrade', ...s, id }))) {
        // Buy every level it can pay for now.
      }
    }
  }

  grammar(): void {
    for (const region of this.course.regions) {
      for (const { id } of region.grammarNodes) {
        if (!this.state.grammar.includes(id)) {
          this.try((s) => ({ type: 'buyGrammarNode', ...s, id }));
        }
      }
    }
  }

  automation(): void {
    if (!automationUnlocked(this.course, this.state)) return;
    const intervalMs = Math.min(...pemanduIntervalsMs(this.state));
    const { enabled, intervalMs: current } = this.state.automation;
    if (enabled && current === intervalMs) return;
    this.try((s) => ({
      type: 'setAutomation',
      ...s,
      enabled: true,
      intervalMs,
    }));
  }

  purchases(): void {
    const preview = sailPreview(this.course, this.seen());
    if (preview.available) {
      const to = preview.next === undefined ? preview.destination : undefined;
      this.try((s) => ({
        type: 'setSail',
        ...s,
        ...(to === undefined ? {} : { to }),
      }));
      return;
    }
    for (let k = 0; k < 5; k += 1) {
      if (this.float() < 0.3 && this.try((s) => ({ type: 'pickUpWord', ...s })))
        continue;
      if (this.state.automation.enabled) break;
      const id = bestPayback(this.course, this.seen());
      if (id === undefined) break;
      this.try((s) => ({ type: 'buyEncounter', ...s, id, count: 1 }));
    }
    if (Object.keys(this.state.owned).length === 0) {
      this.try((s) => ({ type: 'listen', ...s }));
    }
    const word = Object.keys(this.state.words)[0];
    if (word !== undefined && this.float() < 0.2) {
      this.try((s) => ({ type: 'answerPractice', ...s, itemId: word }));
    }
  }

  /** One event the rules refuse, so the replay exercises a refusal. */
  refusal(): void {
    const kind = REFUSALS[this.int(REFUSALS.length)] ?? 'unknownUpgrade';
    const seen = this.seen();
    switch (kind) {
      case 'staleSeq': {
        // A resend: the last accepted event's number again.
        const event: GameEvent = {
          type: 'listen',
          seq: this.state.seq,
          wallMs: this.now(),
        };
        this.send(event, true);
        return;
      }
      case 'notDue': {
        const notDue = Object.entries(seen.words).find(
          ([, word]) => word.card.due > seen.wall,
        );
        const itemId = notDue?.[0] ?? 'noSuchWord';
        this.send(
          { ...this.stamp(), type: 'answerPractice', itemId: 'noSuchWord' },
          true,
        );
        this.send(
          {
            ...this.stamp(),
            type: 'answerReview',
            itemId,
            correct: true,
            latencyMs: 1500,
            promptType: 'choice',
          },
          true,
        );
        return;
      }
      case 'unknownEncounter':
        this.send(
          {
            ...this.stamp(),
            type: 'buyEncounter',
            id: 'noSuchEncounter',
            count: 1,
          },
          true,
        );
        return;
      case 'slotEmpty': {
        const empty = seen.journeys.findIndex((journey) => journey === null);
        const slot = empty < 0 ? 99 : empty;
        this.send({ ...this.stamp(), type: 'collectJourney', slot }, true);
        return;
      }
      case 'sailGoalUnmet':
        if (sailPreview(this.course, seen).available) {
          this.send(
            { ...this.stamp(), type: 'buyUpgrade', id: 'noSuchUpgrade' },
            true,
          );
        } else {
          this.send({ ...this.stamp(), type: 'setSail' }, true);
        }
        return;
      case 'unknownUpgrade':
        this.send(
          { ...this.stamp(), type: 'buyUpgrade', id: 'noSuchUpgrade' },
          true,
        );
        return;
    }
  }
}

/** Day `day`'s open times: five, drawn from the policy stream as it begins. */
function drawOpens(player: Player, day: number): number[] {
  const base = BOT_EPOCH_WALL_MS + day * DAY_MS;
  const opens = Array.from(
    { length: GOLDEN.opensPerDay },
    () => base + 8 * HOUR_MS + player.int(14 * 3600) * 1000,
  ).sort((a, b) => a - b);
  if (day === 0) opens[0] = base + 8 * HOUR_MS;
  return opens;
}

/** Open `i` of day `day`, at the times the day drew. */
function playOpen(
  player: Player,
  day: number,
  opens: readonly number[],
  i: number,
): void {
  const base = BOT_EPOCH_WALL_MS + day * DAY_MS;
  const start = opens[i] ?? base;
  const next = opens[i + 1] ?? base + DAY_MS + 8 * HOUR_MS;
  const first = day === 0 && i === 0;
  player.open(start, first ? HOUR_MS : 8 * MINUTE_MS, next, i === 2);
}

/** Owned Encounter units, all Encounters together. */
function ownedUnits(state: GameState): number {
  return Object.values(state.owned).reduce((sum, n) => sum + n, 0);
}

/**
 * The Encounters bought inside one event (#542): for a resume, what Pemandu
 * bought across the gap. A refused event bought nothing.
 */
export function boughtIn(
  course: Course,
  state: GameState,
  event: GameEvent,
): number {
  const result = apply(course, state, event);
  return result.ok ? ownedUnits(result.state) - ownedUnits(state) : 0;
}

/** The policy before its first day: the first state, the policy seed, no events. */
export function goldenPolicyStart(initial: GameState): PlayerStart {
  return {
    state: initial,
    rng: seedRng(GOLDEN.policySeed),
    seq: 0,
    t: initial.wall,
  };
}

/** Play the golden policy for `days` days on `course`, one slice per open. */
export function playGolden(
  course: Course,
  days: number = GOLDEN.days,
): GoldenRun {
  const initial = initialState(wallMs(BOT_EPOCH_WALL_MS), GOLDEN.stateSeed);
  const player = new Player(course, goldenPolicyStart(initial));
  const slices: GoldenSlice[] = [];
  const starts: PlayerStart[] = [];
  for (let day = 0; day < days; day += 1) {
    let opens: readonly number[] = [];
    for (let open = 0; open < GOLDEN.opensPerDay; open += 1) {
      const start = player.start();
      const from = player.events.length;
      if (open === 0) opens = drawOpens(player, day);
      playOpen(player, day, opens, open);
      const counts = player.takeCounts();
      const sent = player.events.slice(from);
      const first = sent[0];
      const purchases =
        first === undefined ? 0 : boughtIn(course, start.state, first);
      const shop = shopCounts(judgeShopAlong(course, start.state, sent));
      slices.push({
        slice: slices.length,
        day,
        open,
        from,
        to: player.events.length,
        opens,
        purchases,
        heavy: purchases > GOLDEN.heavyPurchases,
        ...counts,
        shop,
      });
      starts.push(start);
    }
  }
  return { initial, events: player.events, live: player.state, slices, starts };
}

/**
 * Play one recorded slice again from its start (#542). Its first open draws
 * the day's times again; a later one plays at the times recorded.
 */
export function playGoldenSlice(
  course: Course,
  slice: GoldenSlice,
  start: PlayerStart,
): PlayedSlice {
  const player = new Player(course, start);
  const opens = slice.open === 0 ? drawOpens(player, slice.day) : slice.opens;
  playOpen(player, slice.day, opens, slice.open);
  return {
    events: player.events,
    end: player.start(),
    opens,
    ...player.takeCounts(),
  };
}

/** The fixture's first line: what the log was played on, and where it ended. */
export interface GoldenHeader {
  readonly format: 1;
  readonly courseSeed: number;
  readonly stateSeed: number;
  readonly policySeed: number;
  readonly days: number;
  readonly startWallMs: number;
  readonly events: number;
  readonly liveHash: string;
}

/** The fixture's text: the header, then one event per line. */
export function writeGolden(
  run: GoldenRun,
  days: number = GOLDEN.days,
): string {
  const header: GoldenHeader = {
    format: 1,
    courseSeed: GOLDEN.courseSeed,
    stateSeed: GOLDEN.stateSeed,
    policySeed: GOLDEN.policySeed,
    days,
    startWallMs: run.initial.wall,
    events: run.events.length,
    liveHash: stateHash(run.live),
  };
  return (
    [header, ...run.events].map((line) => JSON.stringify(line)).join('\n') +
    '\n'
  );
}

/**
 * Read a fixture: the header and every event, each through `parseEvent` as
 * any untrusted log would be. A line that does not parse is thrown by number.
 */
export function readGolden(text: string): {
  readonly header: GoldenHeader;
  readonly events: readonly GameEvent[];
} {
  const lines = text.split('\n').filter((line) => line !== '');
  const [first, ...rest] = lines;
  if (first === undefined) throw new Error('golden log is empty');
  const header = JSON.parse(first) as GoldenHeader;
  const events = rest.map((line, index) => {
    const parsed = parseEvent(JSON.parse(line));
    if (!parsed.ok) {
      throw new Error(
        `golden log line ${String(index + 2)}: ${JSON.stringify(parsed.error)}`,
      );
    }
    return parsed.event;
  });
  if (events.length !== header.events) {
    throw new Error(
      `golden log holds ${String(events.length)} events, header says ${String(header.events)}`,
    );
  }
  return { header, events };
}

/** The course and first state a header names, to replay its log from. */
export function goldenStart(header: GoldenHeader): {
  readonly course: Course;
  readonly initial: GameState;
} {
  return {
    course: syntheticCourse(header.courseSeed),
    initial: initialState(wallMs(header.startWallMs), header.stateSeed),
  };
}

/** What a replay of a fixture's text reached: for the cross-engine check. */
export interface GoldenReplay {
  readonly hash: string;
  readonly events: number;
  readonly refused: number;
}

/** What the slice boundaries were chosen from, written into the slices fixture's header (#542). */
const MEASURED =
  '#542, 2026-10-12: one open replayed, walked, played or judged from its start measured at most 42 ms of thread CPU under Vitest at load 12-20; a day measured up to 308 ms. A resume in which Pemandu bought over 1,000 Encounters measured 13.7-24.8 ms in Node alone and up to 110 ms under Vitest, so its slice is heavy.';

/** The slices fixture's first line: how the log was cut, and into how many. */
export interface GoldenSlicesHeader {
  readonly format: 1;
  readonly boundary: 'open';
  readonly opensPerDay: number;
  readonly heavyPurchases: number;
  readonly slices: number;
  readonly measured: string;
}

/** The slices fixture's text: the header, then one slice per line (#542). */
export function writeGoldenSlices(run: GoldenRun): string {
  const header: GoldenSlicesHeader = {
    format: 1,
    boundary: 'open',
    opensPerDay: GOLDEN.opensPerDay,
    heavyPurchases: GOLDEN.heavyPurchases,
    slices: run.slices.length,
    measured: MEASURED,
  };
  return (
    [header, ...run.slices].map((line) => JSON.stringify(line)).join('\n') +
    '\n'
  );
}

/**
 * Read the slices fixture. Each line after the header is one slice, numbered
 * from 0 in order, as many as the header says. How the slices cut the log is
 * not checked here: the tests prove they tile it.
 */
export function readGoldenSlices(text: string): {
  readonly header: GoldenSlicesHeader;
  readonly slices: readonly GoldenSlice[];
} {
  const lines = text.split('\n').filter((line) => line !== '');
  const [first, ...rest] = lines;
  if (first === undefined) throw new Error('golden slices are empty');
  const header = JSON.parse(first) as GoldenSlicesHeader;
  const slices = rest.map((line, index) => {
    const slice = JSON.parse(line) as GoldenSlice;
    if (slice.slice !== index) {
      throw new Error(
        `golden slices line ${String(index + 2)} is slice ${String(slice.slice)}`,
      );
    }
    return slice;
  });
  if (slices.length !== header.slices) {
    throw new Error(
      `golden slices hold ${String(slices.length)} slices, header says ${String(header.slices)}`,
    );
  }
  return { header, slices };
}

/**
 * Where one slice's start differs from the start before it (#542): the
 * policy's stream, number and time, the state's fields that changed (words
 * apart) and those that went, and the words that changed and those that went.
 */
export interface StartDelta {
  readonly rng: RngState;
  readonly seq: number;
  readonly t: number;
  readonly set: Readonly<Record<string, unknown>>;
  readonly unset: readonly string[];
  readonly words: Readonly<Record<string, WordMemory>>;
  readonly wordsUnset: readonly string[];
}

/** One line of the starts fixture: a day's whole start, or a delta from the slice before. */
type StartLine =
  | { readonly slice: number; readonly start: PlayerStart }
  | { readonly slice: number; readonly delta: StartDelta };

const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** A copy of `record` without the keys in `gone`, its other keys in order. */
function without<T>(
  record: Readonly<Record<string, T>>,
  gone: readonly string[],
): Record<string, T> {
  if (gone.length === 0) return { ...record };
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !gone.includes(key)),
  );
}

/** What `to` changes from `from`, for `applyStartDelta` to rebuild it. */
export function startDelta(from: PlayerStart, to: PlayerStart): StartDelta {
  const before = new Map<string, unknown>(Object.entries(from.state));
  const after = new Map<string, unknown>(Object.entries(to.state));
  const set: Record<string, unknown> = {};
  for (const [key, value] of after) {
    if (key !== 'words' && !sameJson(before.get(key), value)) set[key] = value;
  }
  const words: Record<string, WordMemory> = {};
  for (const [id, word] of Object.entries(to.state.words)) {
    if (!sameJson(from.state.words[id], word)) words[id] = word;
  }
  return {
    rng: to.rng,
    seq: to.seq,
    t: to.t,
    set,
    unset: [...before.keys()].filter((key) => !after.has(key)),
    words,
    wordsUnset: Object.keys(from.state.words).filter(
      (id) => !(id in to.state.words),
    ),
  };
}

/**
 * Rebuild a start from the one before it and its delta. A key that stays
 * keeps its place and a new one goes last, as a spread does: the player reads
 * `Object.keys(words)[0]`, so the order is part of the start, and
 * `writeGoldenStarts` refuses a delta that does not rebuild it byte for byte.
 */
export function applyStartDelta(
  from: PlayerStart,
  delta: StartDelta,
): PlayerStart {
  const words = without(
    { ...from.state.words, ...delta.words },
    delta.wordsUnset,
  );
  const state = without<unknown>(
    { ...from.state, ...delta.set, words },
    delta.unset,
  ) as unknown as GameState;
  return { state, rng: delta.rng, seq: delta.seq, t: delta.t };
}

/**
 * The starts fixture's text (#542): one line per slice, a day's first open
 * holding the whole start and each later open a delta from the open before.
 * Throws for a start its delta does not rebuild exactly.
 */
export function writeGoldenStarts(run: GoldenRun): string {
  const lines = run.starts.map((start, n) => {
    const previous = run.starts[n - 1];
    if (run.slices[n]?.open === 0 || previous === undefined) {
      return JSON.stringify({ slice: n, start });
    }
    const delta = startDelta(previous, start);
    if (!sameJson(applyStartDelta(previous, delta), start)) {
      throw new Error(
        `slice ${String(n)}'s start does not rebuild from its delta`,
      );
    }
    return JSON.stringify({ slice: n, delta });
  });
  return lines.join('\n') + '\n';
}

/**
 * Slice `n`'s start, read from the starts fixture's lines (#542): its day's
 * whole start, then each delta up to it. Only those lines are parsed. A line
 * out of place, or of the wrong kind, is thrown by number.
 */
export function readGoldenStart(
  lines: readonly string[],
  n: number,
): PlayerStart {
  const first = n - (n % GOLDEN.opensPerDay);
  let start: PlayerStart | undefined;
  for (let k = first; k <= n; k += 1) {
    const at = `golden starts line ${String(k + 1)}`;
    const line = lines[k];
    if (line === undefined || line === '') throw new Error(`${at} is missing`);
    const read = JSON.parse(line) as StartLine;
    if (read.slice !== k) {
      throw new Error(`${at} is slice ${String(read.slice)}`);
    }
    if (k === first) {
      if (!('start' in read)) throw new Error(`${at} holds no whole start`);
      start = read.start;
    } else {
      if (!('delta' in read) || start === undefined) {
        throw new Error(`${at} holds no delta`);
      }
      start = applyStartDelta(start, read.delta);
    }
  }
  if (start === undefined)
    throw new Error(`golden starts have no slice ${String(n)}`);
  return start;
}

/** Read a fixture's text, replay it from the start its header names, and hash the result. */
export function replayGolden(text: string): GoldenReplay {
  const { header, events } = readGolden(text);
  const { course, initial } = goldenStart(header);
  const { state, refused } = replay(course, initial, events);
  return {
    hash: stateHash(state),
    events: events.length,
    refused: refused.length,
  };
}
