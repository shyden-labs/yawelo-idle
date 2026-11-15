/**
 * The current save's shape as a Zod schema (#158 AC1). It mirrors
 * `GameState` field for field: a compile-time check below fails the
 * typecheck if the two ever differ, so a change to the state cannot ship
 * without this schema, and so without a new `saveVersion` and its migration.
 */
import type { GameState } from '@yawelo-idle/core';
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

export const saveSchema: z.ZodType<Save> = z.never();
