/**
 * The save key `K` and sealed saves (#165; spec §6.6, D6). Stubs: every
 * function throws until its tests have been seen failing.
 */

/** Where `K` is kept: the platform's storage (`platform.storage`). */
export interface SaveKeyStore {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, bytes: Uint8Array): Promise<void>;
}

/** The storage key `K` is kept under. */
export const SAVE_KEY_NAME = 'save-key';

/** `K`'s length in bytes: 256 bits. */
export const SAVE_KEY_LENGTH = 32;

/** Why a sealed save could not be opened. */
export type OpenFailure =
  'notSealed' | 'unknownVersion' | 'tooShort' | 'tampered';

/** A sealed save that could not be opened, with the reason. */
export class SaveOpenError extends Error {
  readonly reason: OpenFailure;

  constructor(reason: OpenFailure) {
    super(`sealed save could not be opened: ${reason}`);
    this.name = 'SaveOpenError';
    this.reason = reason;
  }
}

/** This device's `K`: the kept one, else a new one, kept first. */
export function loadOrCreateSaveKey(_store: SaveKeyStore): Promise<Uint8Array> {
  throw new Error('loadOrCreateSaveKey: not written (#165)');
}

/** `bytes` sealed under `key`. */
export function sealSave(
  _key: Uint8Array,
  _bytes: Uint8Array,
): Promise<Uint8Array> {
  throw new Error('sealSave: not written (#165)');
}

/** The bytes inside `sealed`, or a SaveOpenError. */
export function openSave(
  _key: Uint8Array,
  _sealed: Uint8Array,
): Promise<Uint8Array> {
  throw new Error('openSave: not written (#165)');
}

/** A request as sent: what a leak could hide in. */
export interface OutgoingRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/** The first request carrying `key` in any encoding, or undefined. */
export function findKeyLeak(
  _key: Uint8Array,
  _requests: readonly OutgoingRequest[],
): OutgoingRequest | undefined {
  throw new Error('findKeyLeak: not written (#165)');
}
