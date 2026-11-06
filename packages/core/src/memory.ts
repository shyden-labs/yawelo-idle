/**
 * Memory (parent spec §3.3, §3.4; M1 design §2.2 item 4; FSRS-7 since #874).
 *
 * FSRS-7 retrievability mixes two power-law traces, fast and slow, each
 * (1 + c t)^(-δ) at t days after a review:
 * R = (w1 Rfast + w2 Rslow) / (w1 + w2) x 0.99998 + 0.00001.
 * Each trace's decay δ, scale c and weight come from the state (stability,
 * fast stability, difficulty) and FSRS-7's default weights, as ts-fsrs's
 * `curve` computes them, with its clamps. Production needs each word's
 * mean R over an hour bucket, so this module also gives that mean in closed
 * form, per trace. Everything goes through det-math, so the bits match on
 * every engine.
 *
 * Reviews are scheduled by ts-fsrs with fuzz off, so the same answers give
 * the same schedule everywhere: a correct answer is rated Good and a wrong
 * one Again. A word's rank follows its stability but moves only on an
 * answer: up (possibly several steps) on a correct one, exactly one step
 * down on a wrong one, and never through absence (DN16).
 */
import {
  dateChrono,
  DEFAULT_MAXIMUM_INTERVAL,
  defaultLearningSteps,
  defaultRelearningSteps,
  defineScheduler,
  Rating,
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerStatsMiddleware,
  State,
} from 'ts-fsrs';
import {
  FSRS7_DEFAULT_WEIGHTS,
  FSRS7_MODEL_BOUNDS,
  FSRS7Model,
} from 'ts-fsrs/models/fsrs-7';
import { BALANCE, type Rank } from './balance';
import { DAY_MS, type WallMs } from './clock';
import { exp, expm1, ln, log1p, pow } from './det-math';

/** FSRS-7's default weights, read from ts-fsrs. */
export const WEIGHTS: readonly number[] = Object.freeze([
  ...FSRS7_DEFAULT_WEIGHTS,
]);

function weight(index: number): number {
  const value = WEIGHTS[index];
  if (value === undefined) {
    throw new Error(`FSRS-7 weights have no w[${String(index)}]`);
  }
  return value;
}

/** What FSRS-7's curve reads from a word's memory. */
export interface MemoryState {
  /** S, the slow trace's stability, in days. */
  readonly stability: number;
  /** The fast trace's stability, in days. */
  readonly stabilityFast: number;
  /** D, from 1 to 10. */
  readonly difficulty: number;
}

/** R never leaves [FLOOR, KEPT + FLOOR]. */
const KEPT = 0.99998;
const FLOOR = 0.00001;
/** ts-fsrs caps the fast trace's scale exponent here. */
const FAST_EXPONENT_CAP = 60;

const clamp = (x: number, low: number, high: number): number =>
  Math.min(Math.max(x, low), high);

function checkPositive(what: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(
      `${what} must be positive and finite, got ${String(value)}`,
    );
  }
}

function checkState(state: MemoryState): void {
  checkPositive('stability', state.stability);
  checkPositive('fast stability', state.stabilityFast);
  if (!Number.isFinite(state.difficulty)) {
    throw new RangeError(
      `difficulty must be finite, got ${String(state.difficulty)}`,
    );
  }
}

function checkElapsed(elapsedDays: number): void {
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0) {
    throw new RangeError(
      `elapsed time must be non-negative and finite, got ${String(elapsedDays)}`,
    );
  }
}

/** One power-law trace: R = (1 + scale t)^(-decay), mixed at `weight`. */
interface Trace {
  readonly decay: number;
  readonly scale: number;
  readonly weight: number;
}

function traces(state: MemoryState): readonly [Trace, Trace] {
  const bounds = FSRS7_MODEL_BOUNDS;
  const s = clamp(state.stability, bounds.sMin, bounds.sMax);
  const sFast = clamp(
    state.stabilityFast,
    bounds.stabilityFastMin,
    bounds.stabilityFastMax,
  );
  const d = clamp(state.difficulty, bounds.dMin, bounds.dMax);
  const fastDecay = clamp(
    weight(23) * pow(sFast, weight(33) - 0.3),
    0.01,
    0.95,
  );
  // w25^(-1/δ) - 1, as expm1 so it keeps its digits near zero.
  const fastScale =
    expm1(Math.min(-ln(weight(25)) / fastDecay, FAST_EXPONENT_CAP)) / sFast;
  const slowDecay = clamp(weight(24), 0.01, 0.95);
  const slowScale =
    (expm1(-ln(weight(26)) / slowDecay) * exp((d - 5) * (weight(32) - 0.3))) /
    s;
  return [
    {
      decay: fastDecay,
      scale: fastScale,
      weight: weight(27) * pow(sFast, -weight(29)),
    },
    {
      decay: slowDecay,
      scale: slowScale,
      weight:
        weight(28) * pow(s, weight(30)) * exp((d - 5) * (weight(31) - 0.5)),
    },
  ];
}

function mix(state: MemoryState, each: (trace: Trace) => number): number {
  const [fast, slow] = traces(state);
  return (
    ((fast.weight * each(fast) + slow.weight * each(slow)) /
      (fast.weight + slow.weight)) *
      KEPT +
    FLOOR
  );
}

/** One trace's R at `days`: (1 + c t)^(-δ), exact where c t is tiny. */
function traceR({ decay, scale }: Trace, days: number): number {
  return exp(-decay * log1p(scale * days));
}

/** R, `elapsedDays` after the review that left `state`. */
export function retrievability(
  state: MemoryState,
  elapsedDays: number,
): number {
  checkState(state);
  checkElapsed(elapsedDays);
  return mix(state, (trace) => traceR(trace, elapsedDays));
}

/**
 * The mean of R over [fromDays, fromDays + spanDays] after a review.
 *
 * Each trace's mean from the review is closed:
 * mean0(c, T) = expm1((1 - δ) log1p(c T)) / (c (1 - δ) T).
 * The expm1/log1p form keeps full precision on short spans. A window that
 * starts later is the same trace shifted: 1 + c(a + u) = (1 + c a)(1 + c' u)
 * with c' = c / (1 + c a), so mean(a, T) = R(a) x mean0(c', T). Taking the
 * difference of two integrals instead loses up to 0.58% (measured under
 * FSRS-6, 2026-10-02, at a = 100 years, T = 1 ms). The traces' means mix
 * with the same weights as R, and the floor's mean is itself.
 */
export function meanRetrievability(
  state: MemoryState,
  fromDays: number,
  spanDays: number,
): number {
  checkState(state);
  checkElapsed(fromDays);
  if (!Number.isFinite(spanDays) || spanDays <= 0) {
    throw new RangeError(
      `span must be positive and finite, got ${String(spanDays)}`,
    );
  }
  return mix(state, (trace) => {
    const shifted = trace.scale / (1 + trace.scale * fromDays);
    const kept = 1 - trace.decay;
    const fromStart =
      expm1(kept * log1p(shifted * spanDays)) / (shifted * kept * spanDays);
    return traceR(trace, fromDays) * fromStart;
  });
}

/**
 * The scheduler: ts-fsrs's FSRS-7 model with the seven middlewares its
 * `DefaultScheduler` uses, built synchronously. Fuzz is off, so the same
 * answers give the same schedule everywhere, and model override is off, so
 * the short learning steps stay (Shyden, #874). Measured equal to
 * `await DefaultScheduler({ enableFuzz: false, allowModelOverride: false })`
 * over 15 reviews (ts-fsrs 6.0.0, 2026-11-05); review.test.ts checks it.
 */
const SCHEDULER = defineScheduler({ model: FSRS7Model, chrono: dateChrono })
  .use(
    schedulerDesiredRetentionMiddleware,
    schedulerFuzzingMiddleware,
    schedulerStatsMiddleware,
    schedulerScheduledDaysMiddleware,
    schedulerLearningStepsMiddleware,
    schedulerMaximumIntervalMiddleware,
    schedulerMonotonicIntervalMiddleware,
  )
  .create({
    config: {
      fractionalDays: true,
      weights: [...WEIGHTS],
      enableShortTerm: true,
      desiredRetention: 0.9,
      learningSteps: [...defaultLearningSteps],
      relearningSteps: [...defaultRelearningSteps],
      allowModelOverride: false,
      enableFuzz: false,
      maximumInterval: DEFAULT_MAXIMUM_INTERVAL,
    },
  });

type SchedulerCard = ReturnType<typeof SCHEDULER.newCard>;

/**
 * ts-fsrs reads a card's id only to seed fuzz, which is off, so every word
 * shares one id rather than storing it twice.
 */
const CARD_ID = 'word';

/** Heard (new) to Mastered (parent §3.4). The index is the rank index. */
export const RANKS: readonly Rank[] = [
  'heard',
  'recognised',
  'recalled',
  'fluent',
  'mastered',
];

/**
 * A word's FSRS card as plain data: ts-fsrs's fields, with its dates as
 * integer wall-clock milliseconds so state stays serialisable.
 */
export interface MemoryCard extends MemoryState {
  readonly due: number;
  readonly scheduledDays: number;
  readonly learningStep: number;
  readonly reps: number;
  readonly lapses: number;
  readonly state: State;
  readonly scheduleStatus: SchedulerCard['scheduleStatus'];
  /** Wall time of the last review; null until the first. */
  readonly lastReview: number | null;
}

export interface WordMemory {
  readonly rank: Rank;
  readonly card: MemoryCard;
}

/** One entry of the review queue. */
export interface QueueItem {
  readonly itemId: string;
  readonly rank: Rank;
  readonly retrievability: number;
}

function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

function rankAt(index: number): Rank {
  const rank = RANKS[index];
  if (rank === undefined) throw new RangeError(`no rank ${String(index)}`);
  return rank;
}

/** The highest rank whose stability threshold `stabilityDays` meets. */
export function rankForStability(stabilityDays: number): Rank {
  const thresholds = BALANCE.memory.rankStabilityDays;
  let index = 0;
  for (let k = 1; k < RANKS.length; k++) {
    const rank = rankAt(k);
    if (rank !== 'heard' && stabilityDays >= thresholds[rank]) index = k;
  }
  return rankAt(index);
}

/**
 * ts-fsrs solves FSRS-7's interval with Math.exp and Math.log, whose last
 * bits differ between platforms (measured on #874: scheduledDays
 * 10.503390960454752 on macOS arm64 and 10.503390960454778 on Linux x64,
 * both Node 26.12.1). The interval is kept to the whole minute from the
 * review, and the days derived from it, so a review gives the same state on
 * every engine and platform; the scheduler never reads either back.
 */
const INTERVAL_GRID_MS = 60_000;

function fromCard(card: SchedulerCard, wall: WallMs): MemoryCard {
  const intervalMs =
    Math.round((card.dueAt.getTime() - wall) / INTERVAL_GRID_MS) *
    INTERVAL_GRID_MS;
  return {
    due: wall + intervalMs,
    stability: card.stability,
    stabilityFast: card.stabilityFast,
    difficulty: card.difficulty,
    scheduledDays: intervalMs / DAY_MS,
    learningStep: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    scheduleStatus: card.scheduleStatus,
    lastReview: card.lastReviewAt?.getTime() ?? null,
  };
}

/** The ts-fsrs card a word's memory stands for. */
export function toCard(card: MemoryCard): SchedulerCard {
  return {
    cardId: CARD_ID,
    dueAt: new Date(card.due),
    stability: card.stability,
    stabilityFast: card.stabilityFast,
    difficulty: card.difficulty,
    scheduledDays: card.scheduledDays,
    learningStep: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    scheduleStatus: card.scheduleStatus,
    lastReviewAt: card.lastReview === null ? null : new Date(card.lastReview),
  };
}

/**
 * A word just picked up at `wall`: Heard, a new card due at `due`, at once
 * unless told otherwise (the tutorial word waits, parent §4.1).
 */
export function newWordMemory(wall: WallMs, due: WallMs = wall): WordMemory {
  return {
    rank: 'heard',
    card: {
      due,
      stability: 0,
      stabilityFast: 0,
      difficulty: 0,
      scheduledDays: 0,
      learningStep: 0,
      reps: 0,
      lapses: 0,
      state: State.New,
      scheduleStatus: 'new',
      lastReview: null,
    },
  };
}

/** R at wall time `wall`; 0 for a word never reviewed, as ts-fsrs gives. */
export function wordRetrievability(word: WordMemory, wall: WallMs): number {
  const { lastReview } = word.card;
  if (lastReview === null) return 0;
  return retrievability(word.card, (wall - lastReview) / DAY_MS);
}

/** Whether the word may be reviewed for score at `wall`. */
export function isDue(word: WordMemory, wall: WallMs): boolean {
  return word.card.due <= wall;
}

/** Answer a review at `wall`: Good if correct, Again if not, and move the rank. */
export function review(
  word: WordMemory,
  wall: WallMs,
  correct: boolean,
): WordMemory {
  const card = fromCard(
    SCHEDULER.review({
      card: toCard(word.card),
      grade: correct ? Rating.Good : Rating.Again,
      now: new Date(wall),
    }).card,
    wall,
  );
  const before = rankIndex(word.rank);
  const after = correct
    ? Math.max(before, rankIndex(rankForStability(card.stability)))
    : Math.max(before - 1, 0);
  return { rank: rankAt(after), card };
}

/** Insight for a correct due answer at `rank`: base + perRank x rank index. */
export function insightFor(rank: Rank): number {
  const { insightBase, insightPerRank } = BALANCE.memory;
  return insightBase + insightPerRank * rankIndex(rank);
}

/**
 * The review queue at `wall`: at most `queueSize` due items, lowest R first,
 * ties by item id in code-unit order. How many more are due is never part of
 * it (DN23).
 */
export function reviewQueue(
  words: Readonly<Record<string, WordMemory>>,
  wall: WallMs,
): readonly QueueItem[] {
  const due: QueueItem[] = [];
  for (const [itemId, word] of Object.entries(words)) {
    if (isDue(word, wall)) {
      due.push({
        itemId,
        rank: word.rank,
        retrievability: wordRetrievability(word, wall),
      });
    }
  }
  due.sort(
    (a, b) =>
      a.retrievability - b.retrievability ||
      (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0),
  );
  return due.slice(0, BALANCE.memory.queueSize);
}
