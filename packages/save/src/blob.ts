/**
 * A save as stored bytes (#159; spec §6.5, DN18): compressed, carrying a
 * SHA-256 over its canonical bytes, so a damaged save is detected, never
 * loaded.
 *
 * The blob is the four bytes "YISV", one byte giving the checksum's length
 * (32), the SHA-256 of the canonical bytes, then those bytes as raw DEFLATE.
 * The compressor is fflate, in pure JS, so every engine writes the same
 * bytes for the same save (AC5); a platform's own CompressionStream may not.
 *
 * Reading checks, in order: bytes, the magic, the header's length, the
 * checksum's length, the body decompresses, the checksum, and that the body
 * is exactly what this writer makes of those bytes. That last check catches
 * bytes left after the DEFLATE stream ends (an overwrite that did not cut the
 * file, say) and a body another writer compressed: both decompress to the
 * checksummed bytes, so the checksum alone passes them. So each save has one
 * blob, and any change to it is refused.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { deflateSync, inflateSync, strFromU8 } from 'fflate';
import { CHAIN, type Chain } from './migrations.ts';
import { load, type LoadResult } from './save.ts';
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

const MAGIC = Uint8Array.of(0x59, 0x49, 0x53, 0x56);
const CHECKSUM_BYTES = 32;
const HEADER_BYTES = MAGIC.length + 1 + CHECKSUM_BYTES;
/** A stored format: changing the level changes every blob's bytes. */
const LEVEL = 6;
/** fflate's code for a stream that ends before its last block does. */
const UNEXPECTED_EOF = 0;

/** The canonical JSON of plain data; `path` names the value in any refusal. */
function canonicalJson(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new RangeError(
          `${path} is ${String(value)}: JSON cannot hold it`,
        );
      }
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`${path} is of type ${typeof value}: not plain data`);
  }
  if (Array.isArray(value)) {
    const items = value.map((item: unknown, index) =>
      canonicalJson(item, path + '[' + String(index) + ']'),
    );
    return '[' + items.join(',') + ']';
  }
  const record = value as Readonly<Record<string, unknown>>;
  const entries = Object.keys(record)
    .sort(byCodeUnits)
    .map(
      (key) =>
        JSON.stringify(key) +
        ':' +
        canonicalJson(record[key], path + '.' + key),
    );
  return '{' + entries.join(',') + '}';
}

/**
 * Code-unit order, as `sort()` with no compare function gives, written out:
 * `localeCompare` would make the canonical bytes depend on the locale.
 */
function byCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** The save's canonical bytes: UTF-8 JSON, object keys in code-unit order. */
export function canonicalBytes(save: Save): Uint8Array {
  return utf8ToBytes(canonicalJson(save, 'save'));
}

const compress = (bytes: Uint8Array): Uint8Array =>
  deflateSync(bytes, { level: LEVEL });

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.byteLength === b.byteLength && a.every((byte, i) => byte === b[i]);

/** The stored blob of `save`. */
export function toBlob(save: Save): Uint8Array {
  const bytes = canonicalBytes(save);
  const body = compress(bytes);
  const blob = new Uint8Array(HEADER_BYTES + body.byteLength);
  blob.set(MAGIC, 0);
  blob[MAGIC.length] = CHECKSUM_BYTES;
  blob.set(sha256(bytes), MAGIC.length + 1);
  blob.set(body, HEADER_BYTES);
  return blob;
}

const corrupt = (reason: CorruptReason): LoadResult => ({
  ok: false,
  refusal: { kind: 'corrupt', reason },
});

/** The reason the header is unreadable, or null when it reads. */
function headerFault(blob: Uint8Array): CorruptReason | null {
  if (blob.byteLength === 0) return 'empty';
  const shown = blob.subarray(0, MAGIC.length);
  if (!sameBytes(shown, MAGIC.subarray(0, shown.byteLength))) {
    return 'notASaveBlob';
  }
  if (blob.byteLength <= MAGIC.length) return 'truncated';
  if (blob[MAGIC.length] !== CHECKSUM_BYTES) return 'checksumLength';
  if (blob.byteLength <= HEADER_BYTES) return 'truncated';
  return null;
}

/** The decompressed body, or why it does not decompress. */
function inflate(body: Uint8Array): Uint8Array | CorruptReason {
  try {
    return inflateSync(body);
  } catch (error) {
    return (error as { code?: unknown }).code === UNEXPECTED_EOF
      ? 'truncated'
      : 'badCompression';
  }
}

/**
 * The JSON value of `bytes`, or undefined when they are not UTF-8 JSON.
 * fflate's decoder does not refuse a bad sequence, so the text must encode
 * back to the same bytes.
 */
function parseJson(bytes: Uint8Array): { value: unknown } | undefined {
  const text = strFromU8(bytes);
  if (!sameBytes(utf8ToBytes(text), bytes)) return undefined;
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return undefined;
  }
}

/** Reads a stored blob: a corrupt one is a typed refusal, never a throw. */
export function loadBlob(blob: unknown, chain: Chain = CHAIN): LoadResult {
  if (!(blob instanceof Uint8Array)) return corrupt('notBytes');
  const fault = headerFault(blob);
  if (fault !== null) return corrupt(fault);
  const body = blob.subarray(HEADER_BYTES);
  const bytes = inflate(body);
  if (typeof bytes === 'string') return corrupt(bytes);
  if (
    !sameBytes(sha256(bytes), blob.subarray(MAGIC.length + 1, HEADER_BYTES))
  ) {
    return corrupt('checksumMismatch');
  }
  if (!sameBytes(compress(bytes), body)) return corrupt('notCanonical');
  const parsed = parseJson(bytes);
  if (parsed === undefined) return corrupt('notJson');
  return load(parsed.value, chain);
}
