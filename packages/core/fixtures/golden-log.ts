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
  SHOP_KINDS,
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
  /** The player opens the game 5 times a day (#542). */
  opensPerDay: 5,
  /**
   * Each open is cut into slices at steps (#553), at least 2 and one more for
   * each `workPerPart` of its work (`cutOpen`): measured on 5 unit runs at
   * load 4 to 39, slices of work 3,000 to 4,000 ran 46 ms at their heaviest
   * and one of 6,000 to 8,000 ran 74 ms (Shyden, 2026-10-12: "Third part,
   * heaviest opens", then "splitting 3, 4, 5 etc is ok").
   */
  minParts: 2,
  workPerPart: 4000,
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
export const GOLDEN_HEAVY_SLICES: readonly number[] = [226, 248, 280, 317, 347];

/**
 * The slices that read no shop (#553): parts of an open between its
 * purchases, of reviews and listens only, numbered as above, as `npm run
 * golden-log` finds them. They have no shop offer to judge, so the shop test
 * passes them by and a test of their own proves they hold no event the shop
 * is read before (Shyden, 2026-10-12: "Prove them shop-free"). Kept as data
 * for the same reason as the heavy slices, and held the same way.
 */
export const GOLDEN_SHOP_FREE_SLICES: readonly number[] = [
  1, 27, 134, 227, 231, 283, 290, 295, 306, 307, 318, 319, 320, 331, 336, 341,
  344, 345, 348, 351, 360, 368, 369, 376,
];

/**
 * Every open not cut into `GOLDEN.minParts` slices, by its number from 0
 * across the days, with its parts, as `npm run golden-log` finds them (#553):
 * a heavy open is cut into more. Kept as data for the same reason as the
 * heavy slices, and held the same way.
 */
export const GOLDEN_OPEN_PARTS: Readonly<Record<number, number>> = {
  47: 3,
  50: 3,
  55: 3,
  65: 3,
  75: 3,
  76: 3,
  77: 3,
  85: 3,
  87: 3,
  90: 3,
  95: 3,
  100: 3,
  135: 3,
  138: 3,
  140: 3,
  145: 4,
  150: 5,
  155: 3,
  157: 3,
  159: 3,
  160: 4,
  161: 3,
  162: 3,
  170: 4,
  173: 3,
};

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
  /** Each part of each open of the play: what it sent (#473, #542, #553). */
  readonly slices: readonly GoldenSlice[];
  /** Where the policy stood as each slice began, one per slice. */
  readonly starts: readonly PlayerStart[];
}

/** The steps of an open after its resume, in the order the player takes them (#553). */
const STEPS = [
  'collect',
  'review',
  'refusal',
  'journeys',
  'upgrades',
  'grammar',
  'automation',
  'pass',
] as const;

/**
 * Where inside an open the policy stands (#553): the step it takes next, the
 * reviews answered or purchase passes made so far in this open when that step
 * is `review` or `pass` (0 otherwise), and when the open ends.
 */
export interface OpenStep {
  readonly next: (typeof STEPS)[number];
  readonly count: number;
  readonly end: number;
}

/**
 * Where the policy stands at a moment: all it needs to play on from there.
 * A start inside an open (#553) also holds the step it stands at.
 */
export interface PlayerStart {
  readonly state: GameState;
  readonly rng: RngState;
  readonly seq: number;
  readonly t: number;
  readonly step?: OpenStep;
}

/**
 * One part of one open of the golden play (#553; an open before it, #542; a
 * day before that, #473): its events are the log's `[from, to)`. An open's
 * first part begins with its resume, and every part but the last stops
 * `until` the step the next part starts from. `opens` are the day's open
 * times, drawn as its first open began, so a later slice plays on from its
 * own start. `purchases` are the Encounters bought inside the slice's first
 * event (for a first part, its resume, where Pemandu buys across the gap);
 * past `GOLDEN.heavyPurchases` the slice is `heavy`. `accepted` counts its
 * events the rules accepted, by type, and `refused` those refused, by kind,
 * as the play itself counted them; `shop` is its shop offers judged against
 * `apply` (#479).
 */
export interface GoldenSlice {
  readonly slice: number;
  readonly day: number;
  readonly open: number;
  readonly part: number;
  readonly from: number;
  readonly to: number;
  readonly until?: OpenStep;
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
  private readonly course: Course;
  private rng: RngState;
  private seq: number;
  private t: number;
  readonly events: GameEvent[] = [];
  private accepted: Record<string, number> = {};
  private refused: Record<string, number> = {};

  constructor(course: Course, start: PlayerStart) {
    this.course = course;
    this.state = start.state;
    this.rng = start.rng;
    this.seq = start.seq;
    this.t = start.t;
  }

  /** Where the policy stands now: what a day played from here starts from. */
  start(): PlayerStart {
    return { state: this.state, rng: this.rng, seq: this.seq, t: this.t };
  }

  /** What was sent since `takeCounts` was last called, without resetting it. */
  counts(): Pick<GoldenSlice, 'accepted' | 'refused'> {
    return { accepted: { ...this.accepted }, refused: { ...this.refused } };
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

  *open(
    start: number,
    lengthMs: number,
    nextOpen: number,
    clockBack: boolean,
    from?: OpenStep,
  ): Generator<OpenStep, void, undefined> {
    let end: number;
    if (from === undefined) {
      this.t = Math.max(start, this.t + STEP_MS);
      end = this.t + lengthMs;
      this.try((s) => ({ type: 'resume', ...s }));
    } else {
      end = from.end;
    }
    // Before each step the open yields where it stands (#553): a policy
    // given that step and the start it yielded at plays the rest of the open
    // exactly as this one does, so a slice can stop there and the next begin.
    const at = from === undefined ? 0 : STEPS.indexOf(from.next);
    const resumed = (next: OpenStep['next']): number =>
      from?.next === next ? from.count : 0;
    const step = (next: OpenStep['next'], count = 0): OpenStep => ({
      next,
      count,
      end,
    });
    if (at <= 0) {
      yield step('collect');
      this.collect();
    }
    if (at <= 1) {
      for (let count = resumed('review'); ; count += 1) {
        yield step('review', count);
        if (!this.review(count)) break;
      }
    }
    if (at <= 2) {
      yield step('refusal');
      this.refusal();
    }
    if (at <= 3) {
      yield step('journeys');
      this.journeys(nextOpen);
    }
    if (at <= 4) {
      yield step('upgrades');
      this.upgrades();
    }
    if (at <= 5) {
      yield step('grammar');
      this.grammar();
    }
    if (at <= 6) {
      yield step('automation');
      this.automation();
    }
    for (let pass = resumed('pass'); ; pass += 1) {
      yield step('pass', pass);
      if (this.t >= end) return;
      if (clockBack && pass === 1) {
        // The device clock steps back: clamped, never refused (DN21).
        this.t -= 5 * MINUTE_MS;
        this.try((s) => ({ type: 'listen', ...s }));
        this.t += 5 * MINUTE_MS;
      }
      this.purchases();
      this.t += PASS_MS;
    }
  }

  collect(): void {
    for (let slot = 0; slot < journeySlots(this.state); slot += 1) {
      if (journeyStatus(this.seen(), slot) === 'returned') {
        this.try((s) => ({ type: 'collectJourney', ...s, slot }));
      }
    }
  }

  /**
   * Answer the first due review, unless `answered` reviews this open have
   * reached the 200 an open answers at most; true when one was answered.
   */
  review(answered: number): boolean {
    if (answered >= 200) return false;
    const item = reviewQueue(this.seen().words, this.now())[0];
    if (item === undefined) return false;
    const correct = this.float() < item.retrievability;
    const latencyMs = 1000 + this.int(4000);
    const promptType = PROMPT_TYPES[this.int(PROMPT_TYPES.length)] ?? 'choice';
    const event = (s: { seq: number; wallMs: WallMs }): GameEvent => ({
      type: 'answerReview',
      ...s,
      itemId: item.itemId,
      correct,
      latencyMs,
      promptType,
    });
    if (!this.try(event)) throw new Error(`due review refused: ${item.itemId}`);
    return true;
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

/**
 * Open `i` of day `day`, at the times the day drew, from the step `from`
 * (its start when there is none): the steps it yields as it plays.
 */
function playOpen(
  player: Player,
  day: number,
  opens: readonly number[],
  i: number,
  from?: OpenStep,
): Generator<OpenStep, void, undefined> {
  const base = BOT_EPOCH_WALL_MS + day * DAY_MS;
  const start = opens[i] ?? base;
  const next = opens[i + 1] ?? base + DAY_MS + 8 * HOUR_MS;
  const first = day === 0 && i === 0;
  return player.open(
    start,
    first ? HOUR_MS : 8 * MINUTE_MS,
    next,
    i === 2,
    from,
  );
}

const sameStep = (a: OpenStep, b: OpenStep): boolean =>
  a.next === b.next && a.count === b.count && a.end === b.end;

/** `all` less `part`, by key, keeping only what is left. */
function less(
  all: Readonly<Record<string, number>>,
  part: Readonly<Record<string, number>>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(all)
      .map(([key, n]) => [key, n - (part[key] ?? 0)] as const)
      .filter(([, n]) => n > 0),
  );
}

/** A step an open stood at while it played, where it could be cut (#553). */
interface Cut {
  readonly at: number;
  readonly start: PlayerStart;
  readonly counts: Pick<GoldenSlice, 'accepted' | 'refused'>;
}

/** True when every kind of shop offer was judged, or none was. */
const judgesAllOrNone = (
  shop: Readonly<Record<ShopKind, ShopCount>>,
): boolean =>
  judgesEveryKind(shop) ||
  SHOP_KINDS.every((kind) => shop[kind].accepted + shop[kind].refused === 0);

/** True when every kind of shop offer was judged at least once. */
const judgesEveryKind = (
  shop: Readonly<Record<ShopKind, ShopCount>>,
): boolean =>
  SHOP_KINDS.every((kind) => shop[kind].accepted + shop[kind].refused > 0);

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

/** One part of an open as the recorder cuts it (#553). */
interface Part {
  readonly from: number;
  readonly to: number;
  readonly start: PlayerStart;
  readonly until?: OpenStep;
  readonly counts: Pick<GoldenSlice, 'accepted' | 'refused'>;
  readonly shop: Readonly<Record<ShopKind, ShopCount>>;
}

/**
 * Cut an open into parts (#553): as many as its work needs, `GOLDEN.minParts`
 * at least, its work being its weight times the words held as it begins. Each
 * event weighs the hours its advance crosses, at least 1: the cost is the
 * hourly bonus buckets rebuilt, about one an event and one for each hour a
 * resume crosses, and each rebuild reads every word held. Cut `k` of `n` is
 * the step nearest `k / n` of the weight, the earlier of two as near, such
 * that every part holds an event and judges either every kind of shop offer
 * or none (a part between purchases, of reviews and listens, reads no shop:
 * `GOLDEN_SHOP_FREE_SLICES` names it, and its own test proves it; Shyden,
 * 2026-10-12: "Prove them shop-free"); when no steps cut it so, it is cut
 * into one part fewer. `GOLDEN_OPEN_PARTS` names every open not cut into
 * `GOLDEN.minParts`. Throws for an open that judges none of a kind even whole.
 */
function cutOpen(
  course: Course,
  events: readonly GameEvent[],
  open: Omit<Part, 'until' | 'shop'>,
  cuts: readonly Cut[],
): readonly Part[] {
  const { from, to } = open;
  const judged = new Map<string, Readonly<Record<ShopKind, ShopCount>>>();
  const judge = (start: PlayerStart, a: number, b: number) => {
    const key = `${String(a)}-${String(b)}`;
    let shop = judged.get(key);
    if (shop === undefined) {
      shop = shopCounts(
        judgeShopAlong(course, start.state, events.slice(a, b)),
      );
      judged.set(key, shop);
    }
    return shop;
  };
  const weight: number[] = [0];
  for (let i = from; i < to; i += 1) {
    const wall = events[i]?.wallMs ?? 0;
    const gap = wall - (events[i - 1]?.wallMs ?? wall);
    weight.push(
      (weight[weight.length - 1] ?? 0) + Math.max(1, Math.ceil(gap / HOUR_MS)),
    );
  }
  const total = weight[to - from] ?? 0;
  const work = total * Object.keys(open.start.state.words).length;
  const inside = cuts.filter(({ at }) => at > from && at < to);
  const begin: Cut = {
    at: from,
    start: open.start,
    counts: { accepted: {}, refused: {} },
  };
  /** Cuts `k` to `n - 1` after `prev`, each part judging every kind, or none. */
  const choose = (n: number, k: number, prev: Cut): Cut[] | undefined => {
    if (k === n) {
      return judgesAllOrNone(judge(prev.start, prev.at, to)) ? [] : undefined;
    }
    const off = (at: number): number =>
      Math.abs(n * (weight[at - from] ?? 0) - k * total);
    const nearest = inside
      .filter(({ at }) => at > prev.at)
      .sort((a, b) => off(a.at) - off(b.at) || a.at - b.at);
    for (const cut of nearest) {
      if (!judgesAllOrNone(judge(prev.start, prev.at, cut.at))) continue;
      const rest = choose(n, k + 1, cut);
      if (rest !== undefined) return [cut, ...rest];
    }
    return undefined;
  };
  const wanted = Math.max(
    GOLDEN.minParts,
    Math.ceil(work / GOLDEN.workPerPart),
  );
  for (let n = wanted; n > 1; n -= 1) {
    const chosen = choose(n, 1, begin);
    if (chosen === undefined) continue;
    const bounds = [begin, ...chosen];
    return bounds.map((cut, i) => {
      const next = bounds[i + 1];
      const end = next?.counts ?? open.counts;
      return {
        from: cut.at,
        to: next?.at ?? to,
        start: cut.start,
        ...(next?.start.step === undefined ? {} : { until: next.start.step }),
        counts: {
          accepted: less(end.accepted, cut.counts.accepted),
          refused: less(end.refused, cut.counts.refused),
        },
        shop: judge(cut.start, cut.at, next?.at ?? to),
      };
    });
  }
  const shop = judge(open.start, from, to);
  if (!judgesEveryKind(shop)) {
    throw new Error(
      `the open at events [${String(from)}, ${String(to)}) judges no offer of some kind`,
    );
  }
  return [{ ...open, shop }];
}

/** Play the golden policy for `days` days on `course`, each open cut into parts (#553). */
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
      const cuts: Cut[] = [];
      for (const step of playOpen(player, day, opens, open)) {
        cuts.push({
          at: player.events.length,
          start: { ...player.start(), step },
          counts: player.counts(),
        });
      }
      const parts = cutOpen(
        course,
        player.events,
        { from, to: player.events.length, start, counts: player.takeCounts() },
        cuts,
      );
      for (const [part, half] of parts.entries()) {
        const first = player.events[half.from];
        const purchases =
          first === undefined ? 0 : boughtIn(course, half.start.state, first);
        slices.push({
          slice: slices.length,
          day,
          open,
          part,
          from: half.from,
          to: half.to,
          ...(half.until === undefined ? {} : { until: half.until }),
          opens,
          purchases,
          heavy: purchases > GOLDEN.heavyPurchases,
          ...half.counts,
          shop: half.shop,
        });
        starts.push(half.start);
      }
    }
  }
  return { initial, events: player.events, live: player.state, slices, starts };
}

/**
 * Play one recorded slice again from its start (#542, #553). A day's first
 * slice draws the day's times again; a later one plays at the times recorded.
 * A slice that stops `until` a step ends there, its end holding that step.
 */
export function playGoldenSlice(
  course: Course,
  slice: GoldenSlice,
  start: PlayerStart,
): PlayedSlice {
  const player = new Player(course, start);
  const opens =
    slice.open === 0 && slice.part === 0
      ? drawOpens(player, slice.day)
      : slice.opens;
  const { until } = slice;
  let end: PlayerStart | undefined;
  for (const step of playOpen(
    player,
    slice.day,
    opens,
    slice.open,
    start.step,
  )) {
    if (until !== undefined && sameStep(step, until)) {
      end = { ...player.start(), step };
      break;
    }
  }
  return {
    events: player.events,
    end: end ?? player.start(),
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
  const events = parseGoldenEvents(rest, 2);
  if (events.length !== header.events) {
    throw new Error(
      `golden log holds ${String(events.length)} events, header says ${String(header.events)}`,
    );
  }
  return { header, events };
}

/**
 * Events from a fixture's lines, each through `parseEvent` as any untrusted
 * log would be; `lineNumber` is the first line's, so a line that does not
 * parse is thrown by its number in the file (#553: a slice reads its own).
 */
export function parseGoldenEvents(
  lines: readonly string[],
  lineNumber: number,
): GameEvent[] {
  return lines.map((line, index) => {
    const parsed = parseEvent(JSON.parse(line));
    if (!parsed.ok) {
      throw new Error(
        `golden log line ${String(lineNumber + index)}: ${JSON.stringify(parsed.error)}`,
      );
    }
    return parsed.event;
  });
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
  '#542, 2026-10-12: one open replayed, walked, played or judged from its start measured at most 42 ms of thread CPU under Vitest at load 12-20; a day measured up to 308 ms. A resume in which Pemandu bought over 1,000 Encounters measured 13.7-24.8 ms in Node alone and up to 110 ms under Vitest, so its slice is heavy. #553, 2026-10-12: at load 158-210 one open judged measured up to 111 ms under Vitest; the cost is the hourly bonus buckets rebuilt, about one an event and one for each hour a resume crosses, so each open is cut at the step nearest the middle of that weight (the worst judgement, warm and alone, 60 ms whole and 35 ms halved; cut by events alone, a replay after the night still measured 73 ms once).';

/** The slices fixture's first line: how the log was cut, and into how many. */
export interface GoldenSlicesHeader {
  readonly format: 2;
  readonly boundary: 'step';
  readonly opensPerDay: number;
  readonly minParts: number;
  readonly workPerPart: number;
  readonly heavyPurchases: number;
  readonly slices: number;
  readonly measured: string;
}

/** The slices fixture's text: the header, then one slice per line (#542). */
export function writeGoldenSlices(run: GoldenRun): string {
  const header: GoldenSlicesHeader = {
    format: 2,
    boundary: 'step',
    opensPerDay: GOLDEN.opensPerDay,
    minParts: GOLDEN.minParts,
    workPerPart: GOLDEN.workPerPart,
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
  readonly step?: OpenStep;
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
    ...(to.step === undefined ? {} : { step: to.step }),
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
  return {
    state,
    rng: delta.rng,
    seq: delta.seq,
    t: delta.t,
    ...(delta.step === undefined ? {} : { step: delta.step }),
  };
}

/**
 * The starts fixture's text (#542): one line per slice, a day's first slice
 * holding the whole start and each later slice a delta from the slice before
 * (#553: a start inside an open carries its step). Throws for a start its
 * delta does not rebuild exactly.
 */
export function writeGoldenStarts(run: GoldenRun): string {
  const lines = run.starts.map((start, n) => {
    const previous = run.starts[n - 1];
    const slice = run.slices[n];
    if ((slice?.open === 0 && slice.part === 0) || previous === undefined) {
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
 * Slice `n`'s start, read from the starts fixture's lines (#542): the whole
 * start of its day's first slice, `first`, then each delta up to it. Only
 * those lines are parsed. A line out of place, or of the wrong kind, is
 * thrown by number. A day's slices are counted by the caller (#553: an open
 * is one slice or two).
 */
export function readGoldenStart(
  lines: readonly string[],
  n: number,
  first: number,
): PlayerStart {
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
