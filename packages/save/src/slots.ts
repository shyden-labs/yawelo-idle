/**
 * The latest save and its rotating backups (#160; spec §6.5, DN18, H20).
 *
 * Every write puts the new blob under a key no slot has held before, then
 * drops the slots older than the newest six: the latest save and 5 backups.
 * No slot is ever written over, so a failed or interrupted write can spoil
 * at most the one slot it was writing, and every slot before it stays as it
 * was (AC4, AC5).
 */
import type { Chain } from './migrations.ts';
import type { LoadRefusal } from './save.ts';
import type { Save } from './schema.ts';

/** Bytes by key: the platform's storage (`PlatformStorage`) is one. */
export interface SlotStorage {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<readonly string[]>;
}

/** The latest save and this many backups are kept. */
export const BACKUPS = 5;

/** What reading the slots found. */
export type SlotsRead =
  /** Nothing saved yet. */
  | { readonly kind: 'empty' }
  /**
   * The newest save that loads; `back` counts the newer slots that did not
   * (0 when the latest save loaded).
   */
  | { readonly kind: 'loaded'; readonly save: Save; readonly back: number }
  /** Every slot is damaged: the player must choose; nothing is reset. */
  | { readonly kind: 'allCorrupt'; readonly slots: number }
  /** The latest save is from a newer app: never fall back past it. */
  | {
      readonly kind: 'updateTheApp';
      readonly refusal: Extract<LoadRefusal, { kind: 'updateTheApp' }>;
    };

/** What a write did. */
export type SlotWrite =
  | { readonly written: true; readonly key: string }
  | {
      readonly written: false;
      /** `updateTheApp`: the latest save is a newer app's, left as it is. */
      readonly reason: 'updateTheApp' | 'storageFailed';
      readonly error?: unknown;
    };

export interface SaveSlots {
  read(): Promise<SlotsRead>;
  write(save: Save): Promise<SlotWrite>;
}

export function saveSlots(_storage: SlotStorage, _chain?: Chain): SaveSlots {
  throw new Error('saveSlots: not implemented (#160)');
}
