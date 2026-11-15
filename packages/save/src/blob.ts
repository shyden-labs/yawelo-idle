/**
 * A save as stored bytes (#159; spec §6.5, DN18): compressed, carrying a
 * SHA-256 over its canonical bytes, so a damaged save is detected, never
 * loaded.
 */
import type { Chain } from './migrations.ts';
import type { LoadResult } from './save.ts';
import type { Save } from './schema.ts';

/** Why a stored blob is not a save, before its contents are read. */
export type CorruptReason =
  /** Not bytes at all. */
  | 'notBytes'
  /** No bytes. */
  | 'empty'
  /** Bytes, but not this app's save blob. */
  | 'notASaveBlob'
  /** A save blob cut short. */
  | 'truncated'
  /** The checksum field says a length that is not SHA-256's. */
  | 'checksumLength'
  /** The compressed body cannot be decompressed. */
  | 'badCompression'
  /** The body decompresses, but not to the bytes the checksum covers. */
  | 'checksumMismatch'
  /** The bytes match their checksum, but are not how this app writes them. */
  | 'notCanonical'
  /** The bytes match their checksum, but are not JSON. */
  | 'notJson';

/** The save's canonical bytes: UTF-8 JSON, object keys in code-unit order. */
export function canonicalBytes(_save: Save): Uint8Array {
  throw new Error('canonicalBytes: not implemented (#159)');
}

/** The stored blob of `save`. */
export function toBlob(_save: Save): Uint8Array {
  throw new Error('toBlob: not implemented (#159)');
}

/** Reads a stored blob: a corrupt one is a typed refusal, never a throw. */
export function loadBlob(_blob: unknown, _chain?: Chain): LoadResult {
  throw new Error('loadBlob: not implemented (#159)');
}
