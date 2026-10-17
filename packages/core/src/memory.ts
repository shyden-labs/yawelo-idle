/**
 * Memory (parent spec §3.3, §3.4; M1 design §2.2 item 4).
 *
 * FSRS-6 retrievability t days after a review, at stability S days, is
 * R(t) = (1 + F t / S)^(-d), where d is the scheduler's decay w[20] and
 * F = 0.9^(-1/d) - 1 puts R at 90% when t = S. Production needs each word's
 * mean R over an hour bucket, so this module also gives that mean in closed
 * form. Everything goes through det-math, so the bits match on every engine.
 *
 * Reviews are scheduled by ts-fsrs with FSRS-6's default weights and fuzz
 * off, so the same answers give the same schedule everywhere: a correct
 * answer is rated Good and a wrong one Again. A word's rank follows its
 * stability but moves only on an answer: up (possibly several steps) on a
 * correct one, exactly one step down on a wrong one, and never through
 * absence (DN16).
 */
import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type CardInput,
} from 'ts-fsrs';
import { BALANCE, type Rank } from './balance';
import { DAY_MS, type WallMs } from './clock';
import { exp, expm1, log1p, pow } from './det-math';

const PARAMETERS = generatorParameters({ enable_fuzz: false });

const decay = PARAMETERS.w[20];
if (decay === undefined) {
  throw new Error('ts-fsrs parameters have no w[20], so they are not FSRS-6');
}

/** FSRS-6's decay, w[20], read from the scheduler's own parameters. */
export const DECAY: number = decay;

/** F = 0.9^(-1/d) - 1, so that R(S) = 0.9. */
export const FACTOR: number = pow(0.9, -1 / DECAY) - 1;

function checkStability(stabilityDays: number): void {
  if (!Number.isFinite(stabilityDays) || stabilityDays <= 0) {
    throw new RangeError(
      `stability must be positive and finite, got ${String(stabilityDays)}`,
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

/** R, `elapsedDays` after a review that left stability `stabilityDays`. */
export function retrievability(
  stabilityDays: number,
  elapsedDays: number,
): number {
  checkStability(stabilityDays);
  checkElapsed(elapsedDays);
  // (1 + x)^(-d) as exp(-d log1p(x)): exact where x is tiny.
  return exp(-DECAY * log1p((FACTOR * elapsedDays) / stabilityDays));
}

/**
 * The mean of R over [fromDays, fromDays + spanDays] after a review.
 *
 * From the review (from = 0) the integral is closed:
 * mean0(S, T) = S / (F (1 - d) T) x expm1((1 - d) log1p(F T / S)).
 * The expm1/log1p form keeps full precision on short spans, where
 * ((1 + x)^(1-d) - 1) loses it. A window that starts later is the same
 * curve shifted: 1 + F(a + u)/S = (1 + F a/S)(1 + F u/S') with
 * S' = S + F a, so mean(S, a, T) = R(S, a) x mean0(S', T). Taking the
 * difference of two integrals instead loses up to 0.58% (measured
 * 2026-10-02 at a = 100 years, T = 1 ms); this form's worst is 1.2e-15.
 */
export function meanRetrievability(
  stabilityDays: number,
  fromDays: number,
  spanDays: number,
): number {
  checkStability(stabilityDays);
  checkElapsed(fromDays);
  if (!Number.isFinite(spanDays) || spanDays <= 0) {
    throw new RangeError(
      `span must be positive and finite, got ${String(spanDays)}`,
    );
  }
  const shifted = stabilityDays + FACTOR * fromDays;
  const kept = 1 - DECAY;
  const fromStart =
    (shifted / (FACTOR * kept * spanDays)) *
    expm1(kept * log1p((FACTOR * spanDays) / shifted));
  return retrievability(stabilityDays, fromDays) * fromStart;
}

const SCHEDULER = fsrs(PARAMETERS);

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
export interface MemoryCard {
  readonly due: number;
  readonly stability: number;
  readonly difficulty: number;
  readonly scheduledDays: number;
  readonly learningSteps: number;
  readonly reps: number;
  readonly lapses: number;
  readonly state: State;
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

function fromCard(card: Card): MemoryCard {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.getTime() ?? null,
  };
}

function toCard(card: MemoryCard): CardInput {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    // Deprecated and unread: ts-fsrs 5 recomputes it from last_review and the
    // review time, copies the input only into its log, and drops it in 6.0.
    elapsed_days: 0,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.lastReview,
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
      difficulty: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      state: State.New,
      lastReview: null,
    },
  };
}

/** R at wall time `wall`; 0 for a word never reviewed, as ts-fsrs gives. */
export function wordRetrievability(word: WordMemory, wall: WallMs): number {
  const { lastReview, stability } = word.card;
  if (lastReview === null) return 0;
  return retrievability(stability, (wall - lastReview) / DAY_MS);
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
    SCHEDULER.next(
      toCard(word.card),
      wall,
      correct ? Rating.Good : Rating.Again,
    ).card,
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
