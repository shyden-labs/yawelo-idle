/**
 * The save key `K` and sealed saves (#165; spec §6.6, D6). `K` is made on
 * the device with WebCrypto and kept in the platform's storage; a save
 * leaves the device only sealed under it with AES-256-GCM, so the sync
 * Worker can never read it. A sealed save is "YIEC", version 1, a fresh
 * 12-byte IV, then the ciphertext and its 16-byte tag.
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

/** "YIEC": a sealed Yawelo Idle save. */
const MAGIC = [0x59, 0x49, 0x45, 0x43] as const;
const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX_LENGTH = MAGIC.length + 1 + IV_LENGTH;

/** `key` imported for AES-GCM only, never extractable again. */
function aesGcmKey(key: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', key.slice(), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

/** This device's `K`: the kept one, else a new one, kept first. */
export async function loadOrCreateSaveKey(
  store: SaveKeyStore,
): Promise<Uint8Array> {
  const kept = await store.get(SAVE_KEY_NAME);
  if (kept !== undefined && kept.byteLength === SAVE_KEY_LENGTH) return kept;
  const fresh = new Uint8Array(SAVE_KEY_LENGTH);
  crypto.getRandomValues(fresh);
  await store.set(SAVE_KEY_NAME, fresh);
  return fresh;
}

/** `bytes` sealed under `key`: prefix (magic, version, a new IV), then AES-256-GCM. */
export async function sealSave(
  key: Uint8Array,
  bytes: Uint8Array,
): Promise<Uint8Array> {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesGcmKey(key),
    bytes.slice(),
  );
  const sealed = new Uint8Array(PREFIX_LENGTH + cipher.byteLength);
  sealed.set(MAGIC, 0);
  sealed[MAGIC.length] = VERSION;
  sealed.set(iv, MAGIC.length + 1);
  sealed.set(new Uint8Array(cipher), PREFIX_LENGTH);
  return sealed;
}

/**
 * The bytes inside `sealed`, or a SaveOpenError. AES-GCM checks the tag
 * before it returns anything, so a changed byte or another key yields no
 * plaintext at all.
 */
export async function openSave(
  key: Uint8Array,
  sealed: Uint8Array,
): Promise<Uint8Array> {
  if (!MAGIC.every((byte, at) => sealed[at] === byte))
    throw new SaveOpenError('notSealed');
  if (sealed[MAGIC.length] !== VERSION)
    throw new SaveOpenError('unknownVersion');
  if (sealed.byteLength < PREFIX_LENGTH + TAG_LENGTH)
    throw new SaveOpenError('tooShort');
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: sealed.slice(MAGIC.length + 1, PREFIX_LENGTH) },
      await aesGcmKey(key),
      sealed.slice(PREFIX_LENGTH),
    );
  } catch {
    throw new SaveOpenError('tampered');
  }
  return new Uint8Array(plain);
}

/** A request as sent: what a leak could hide in. */
export interface OutgoingRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/** `key` as lower-case hex, base64 and unpadded base64url. */
function encodingsOf(key: Uint8Array): { hex: string; others: string[] } {
  const hex = Array.from(key, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const base64 = btoa(String.fromCharCode(...key));
  const base64url = base64
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
  return { hex, others: [base64, base64url] };
}

/** The first request carrying `key` in any encoding, or undefined. */
export function findKeyLeak(
  key: Uint8Array,
  requests: readonly OutgoingRequest[],
): OutgoingRequest | undefined {
  const { hex, others } = encodingsOf(key);
  return requests.find((request) => {
    const seen = [request.url, ...Object.values(request.headers), request.body];
    return seen.some(
      (text) =>
        text.toLowerCase().includes(hex) ||
        others.some((encoded) => text.includes(encoded)),
    );
  });
}
