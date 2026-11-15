/**
 * The current save's shape as a Zod schema (#158 AC1). It mirrors
 * `GameState` field for field: a compile-time check below fails the
 * typecheck if the two ever differ, so a change to the state cannot ship
 * without this schema, and so without a new `saveVersion` and its migration.
 */
import {
  JOURNEY_DURATION_IDS,
  Num,
  simMs,
  wallMs,
  type GameState,
  type NumTuple,
  type Rank,
} from '@yawelo-idle/core';
import { z } from 'zod';

/**
 * The player's settings. No setting exists yet: the stories that add one
 * (the UI language, #127) add its field here, with a migration.
 */
export type Settings = Readonly<Record<string, never>>;

/** The head of the event log: the last accepted event and the state after it. */
export interface LogHead {
  /** The last accepted event's `seq`; equals the state's own. */
  readonly seq: number;
  /** `stateHash` of the saved state, so a reader can check it unopened. */
  readonly stateHash: string;
}

/** A save at the current `saveVersion`. */
export interface Save {
  readonly saveVersion: number;
  /** The content build the state was played against. */
  readonly contentVersion: string;
  readonly state: GameState;
  readonly settings: Settings;
  readonly logHead: LogHead;
}

/** A number passed through a core check, whose refusal becomes the issue. */
function checked<T>(check: (value: number) => T) {
  return z.number().transform((value, context): T => {
    try {
      return check(value);
    } catch (error) {
      context.addIssue({ code: 'custom', message: (error as Error).message });
      return z.NEVER;
    }
  });
}

const sim = checked(simMs);
const wall = checked(wallMs);
const count = z.int().nonnegative();

/** A `Num` as stored: a canonical `[mantissa, exponent]` pair. */
const num = z
  .tuple([z.number(), z.number()])
  .transform((tuple, context): NumTuple => {
    try {
      return Num.toTuple(Num.fromTuple(tuple));
    } catch (error) {
      context.addIssue({ code: 'custom', message: (error as Error).message });
      return z.NEVER;
    }
  });

const RANK_VALUES = [
  'heard',
  'recognised',
  'recalled',
  'fluent',
  'mastered',
] as const satisfies readonly Rank[];

const card = z.strictObject({
  stability: z.number(),
  stabilityFast: z.number(),
  difficulty: z.number(),
  due: z.number(),
  scheduledDays: z.number(),
  learningStep: count,
  reps: count,
  lapses: count,
  state: z.literal([0, 1, 2, 3]),
  scheduleStatus: z.enum(['new', 'learning', 'review']),
  lastReview: z.number().nullable(),
});

const u32 = z.int().min(0).max(0xffffffff);

const state = z.strictObject({
  sim,
  wall,
  anchor: z.strictObject({ sim, understanding: num }),
  owned: z.record(z.string(), count),
  insight: num,
  words: z.record(
    z.string(),
    z.strictObject({ rank: z.enum(RANK_VALUES), card }),
  ),
  memorySince: sim,
  stamps: count,
  stampsEarned: count,
  upgrades: z.record(z.string(), count),
  rng: z.record(
    z.string(),
    z.strictObject({ s: z.tuple([u32, u32, u32, u32]) }),
  ),
  journeys: z.array(
    z
      .strictObject({
        durationId: z.enum(JOURNEY_DURATION_IDS),
        returnsAt: sim,
        cardId: z.string(),
      })
      .nullable(),
  ),
  cards: z.array(z.string()),
  tutorialJourneyUsed: z.boolean(),
  destination: count,
  reached: count,
  finale: z.boolean(),
  replays: z.record(z.string(), count),
  runSpent: num,
  playableRegions: z.int().positive(),
  grammar: z.array(z.string()),
  automation: z.strictObject({
    enabled: z.boolean(),
    intervalMs: z.int().positive(),
  }),
  seq: count,
});

export const saveSchema = z.strictObject({
  saveVersion: z.int().positive(),
  contentVersion: z.string().min(1),
  state,
  settings: z.strictObject({}),
  logHead: z.strictObject({
    seq: count,
    stateHash: z.string().regex(/^[0-9a-f]{64}$/),
  }),
});

// The schema and the types must agree exactly, in both directions, once
// both are read-only all the way down: a field added to `GameState` and
// not here, or here and not there, fails the typecheck.
type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type SchemaMatchesSave = Assert<
  Same<DeepReadonly<z.output<typeof saveSchema>>, DeepReadonly<Save>>
>;
