/**
 * Writing and reading a save (#158 AC1, AC2, AC5).
 */
import type { GameState } from '@yawelo-idle/core';
import { CHAIN, type Chain } from './migrations.ts';
import type { Save, Settings } from './schema.ts';

/** Why a save was not loaded. */
export type LoadRefusal =
  /** Written by a newer app: the player must update; the save is kept as it is. */
  | { readonly kind: 'updateTheApp'; readonly saveVersion: number; readonly appSaveVersion: number }
  /** Not a save this app can read: each issue names its path. */
  | { readonly kind: 'notASave'; readonly issues: readonly string[] }
  /** The log head does not match the state it was saved with. */
  | { readonly kind: 'headMismatch' };

export type LoadResult =
  | { readonly ok: true; readonly save: Save; readonly migratedFrom: number }
  | { readonly ok: false; readonly refusal: LoadRefusal };

/** Whether a stored save may be written over. */
export type ReplaceCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: Extract<LoadRefusal, { kind: 'updateTheApp' }> };

/** The save of `state` with `settings`, played against content `contentVersion`. */
export function save(
  state: GameState,
  settings: Settings,
  contentVersion: string,
): Save {
  throw new Error(
    `save: not implemented (${String(state.seq)}, ${String(Object.keys(settings).length)}, ${contentVersion})`,
  );
}

/** Reads `raw` (parsed JSON), migrating an older save through `chain`. */
export function load(raw: unknown, chain: Chain = CHAIN): LoadResult {
  throw new Error(`load: not implemented (${typeof raw}, ${String(chain.current)})`);
}

/** Refuses to write over a stored save from a newer app (#158 AC5). */
export function mayReplace(stored: unknown, chain: Chain = CHAIN): ReplaceCheck {
  throw new Error(`mayReplace: not implemented (${typeof stored}, ${String(chain.current)})`);
}
