/**
 * The latest save and its rotating backups (#160; spec §6.5, DN18, H20).
 *
 * Every write puts the new blob under a key no slot has held before, then
 * drops the slots older than the newest six: the latest save and 5 backups.
 * No slot is ever written over, so a failed or interrupted write can spoil
 * at most the one slot it was writing, and every slot before it stays as it
 * was (AC4, AC5). A slot's key is `save/`, a 12-digit counter, so string
 * order is write order, then `.` and the time it was written in ms since the
 * epoch, so the player can be told how old a restored backup is (AC3). The
 * time is in the key, not the blob, so writing a slot stays one `set`.
 */
import { loadBlob, toBlob } from './blob.ts';
import { CHAIN, type Chain } from './migrations.ts';
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
   * (0 when the latest save loaded); `savedAt` is when its slot was written,
   * in ms since the epoch.
   */
  | {
      readonly kind: 'loaded';
      readonly save: Save;
      readonly back: number;
      readonly savedAt: number;
    }
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

const PREFIX = 'save/';
const DIGITS = 12;
const SLOT_KEY = /^save\/\d{12}\.\d+$/;
const KEPT = 1 + BACKUPS;

/** The slot keys held, oldest first. */
async function slotKeys(storage: SlotStorage): Promise<string[]> {
  return (await storage.keys()).filter((key) => SLOT_KEY.test(key)).sort();
}

const COUNTER_END = PREFIX.length + DIGITS;

const keyAfter = (keys: readonly string[], now: number): string => {
  const last = keys.at(-1);
  const next =
    last === undefined ? 1 : Number(last.slice(PREFIX.length, COUNTER_END)) + 1;
  return `${PREFIX}${String(next).padStart(DIGITS, '0')}.${String(now)}`;
};

/** When the slot under `key` was written. */
const writtenAt = (key: string): number => Number(key.slice(COUNTER_END + 1));

export function saveSlots(
  storage: SlotStorage,
  chain: Chain = CHAIN,
  now: () => number = Date.now,
): SaveSlots {
  const read = async (): Promise<SlotsRead> => {
    const keys = await slotKeys(storage);
    if (keys.length === 0) return { kind: 'empty' };
    let back = 0;
    for (const key of [...keys].reverse()) {
      const result = loadBlob(await storage.get(key), chain);
      if (result.ok) {
        return {
          kind: 'loaded',
          save: result.save,
          back,
          savedAt: writtenAt(key),
        };
      }
      if (back === 0 && result.refusal.kind === 'updateTheApp') {
        return { kind: 'updateTheApp', refusal: result.refusal };
      }
      back += 1;
    }
    return { kind: 'allCorrupt', slots: keys.length };
  };

  const write = async (save: Save): Promise<SlotWrite> => {
    const blob = toBlob(save);
    let key: string;
    try {
      const keys = await slotKeys(storage);
      const latest = keys.at(-1);
      if (latest !== undefined) {
        const held = loadBlob(await storage.get(latest), chain);
        if (!held.ok && held.refusal.kind === 'updateTheApp') {
          return { written: false, reason: 'updateTheApp' };
        }
      }
      key = keyAfter(keys, now());
      await storage.set(key, blob);
    } catch (error) {
      return { written: false, reason: 'storageFailed', error };
    }
    // The new slot is stored, so the write stands. Dropping the oldest may
    // fail; the next write prunes again.
    try {
      const keys = await slotKeys(storage);
      for (const old of keys.slice(0, Math.max(0, keys.length - KEPT))) {
        await storage.delete(old);
      }
    } catch {
      // Kept: an extra backup is never lost progress.
    }
    return { written: true, key };
  };

  return { read, write };
}
