/**
 * The save key `K` and the save's encryption (#165; spec §6.6, D6): the
 * device makes a 256-bit key with WebCrypto and keeps it in the platform's
 * storage; a save leaves the device only as AES-256-GCM ciphertext under it,
 * so the sync Worker cannot read it. `K` itself leaves only by the pairing
 * paths (QR, or the 6-digit window), never in any other request.
 *
 * The encrypted save is the four bytes "YIEC", one format byte (1), the
 * 12-byte IV, then the ciphertext with its 16-byte GCM tag. Each encryption
 * draws a fresh random IV. Decrypting checks the tag before giving back any
 * byte, so a changed byte or a wrong key gives a typed error and no
 * plaintext at all.
 */

/** The platform storage this needs (`platform.storage`). */
export interface KeyStorage {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, bytes: Uint8Array): Promise<void>;
}

/** The storage key `K` lives under. */
export const SAVE_KEY = 'save-key';

/** `K`'s length: 32 bytes, 256 bits. */
export const KEY_BYTES = 32;

/** Why encrypted bytes could not be decrypted. */
export type DecryptFailure =
  /** Not this app's encrypted save. */
  | 'notEncrypted'
  /** A format this app does not know. */
  | 'unknownFormat'
  /** Cut short: no room for the IV and the tag. */
  | 'truncated'
  /** The tag does not match: a changed byte, or the wrong key. */
  | 'authentication';

/** A save that could not be decrypted, and why. */
export class SaveDecryptError extends Error {
  constructor(readonly reason: DecryptFailure) {
    super(`save could not be decrypted: ${reason}`);
    this.name = 'SaveDecryptError';
  }
}

const MAGIC = Uint8Array.of(0x59, 0x49, 0x45, 0x43);
const FORMAT = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + 1 + IV_BYTES;

/** `key` as a WebCrypto AES-GCM key, usable only to encrypt and decrypt. */
const aesKey = (key: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', Uint8Array.from(key), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);

/** This device's `K`: the kept one, or a new one, kept before it is returned. */
export async function ensureSaveKey(storage: KeyStorage): Promise<Uint8Array> {
  const kept = await storage.get(SAVE_KEY);
  if (kept?.length === KEY_BYTES) return kept;
  const key = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  await storage.set(SAVE_KEY, key);
  return key;
}

/** `plain` encrypted under `key`, with a fresh random IV. */
export async function encryptSave(
  key: Uint8Array,
  plain: Uint8Array,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await aesKey(key),
      Uint8Array.from(plain),
    ),
  );
  const sealed = new Uint8Array(HEADER_BYTES + ciphertext.length);
  sealed.set(MAGIC, 0);
  sealed[MAGIC.length] = FORMAT;
  sealed.set(iv, MAGIC.length + 1);
  sealed.set(ciphertext, HEADER_BYTES);
  return sealed;
}

/** The plaintext of `sealed`, or a SaveDecryptError naming why not. */
export async function decryptSave(
  key: Uint8Array,
  sealed: Uint8Array,
): Promise<Uint8Array> {
  if (
    sealed.length < MAGIC.length ||
    MAGIC.some((byte, index) => sealed[index] !== byte)
  )
    throw new SaveDecryptError('notEncrypted');
  if (sealed[MAGIC.length] !== FORMAT)
    throw new SaveDecryptError('unknownFormat');
  if (sealed.length < HEADER_BYTES + TAG_BYTES)
    throw new SaveDecryptError('truncated');
  const iv = sealed.slice(MAGIC.length + 1, HEADER_BYTES);
  try {
    // WebCrypto checks the tag before it gives back any plaintext.
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        await aesKey(key),
        sealed.slice(HEADER_BYTES),
      ),
    );
  } catch {
    throw new SaveDecryptError('authentication');
  }
}

/** One outgoing request, as far as a leak check reads it. */
export interface SentRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/**
 * Whether `key` appears in any of `requests`, in any encoding a request
 * could carry it in: hex, base64 or base64url, either case for hex.
 */
export function leaksKey(
  key: Uint8Array,
  requests: readonly SentRequest[],
): boolean {
  let binary = '';
  for (const byte of key) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  const base64url = base64
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const hex = [...key]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return requests.some((request) => {
    const text = [
      request.url,
      ...Object.values(request.headers),
      request.body,
    ].join('\n');
    return (
      text.toLowerCase().includes(hex) ||
      text.includes(base64) ||
      text.includes(base64url)
    );
  });
}
