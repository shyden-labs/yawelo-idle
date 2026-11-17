/**
 * Device identity (#163; spec §6.6, D6): an anonymous device registers and
 * gets a high-entropy token, returned once. The Worker keeps only the
 * token's SHA-256 and compares hashes in constant time. Web APIs only, so the
 * unit suite runs it in Node and the Worker runs it in workerd.
 */
import { z } from 'zod';

/** The token's entropy: 32 random bytes, 256 bits. */
export const TOKEN_BYTES = 32;

/** A registration's body: nothing, strictly (no personal data, spec D6). */
export const registrationBody = z.strictObject({});

/** Fills `bytes` with random values; the Web Crypto source by default. */
export type RandomSource = (bytes: Uint8Array) => Uint8Array;

const defaultRandom: RandomSource = (bytes) => crypto.getRandomValues(bytes);

/** Bytes as unpadded base64url, safe in a header and a URL. */
function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

/** A new device token: 32 random bytes as unpadded base64url (43 characters). */
export function newToken(random: RandomSource = defaultRandom): string {
  return base64url(random(new Uint8Array(TOKEN_BYTES)));
}

/** The SHA-256 of the token's text: what the Worker stores and looks up by. */
export async function hashToken(token: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)),
  );
}

/**
 * Whether two hashes are equal, reading every byte whatever it finds, so the
 * time taken does not say how many leading bytes matched.
 */
export function sameHash(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1)
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

/** Finds the player a token hash belongs to, or null (a D1 lookup). */
export type FindPlayer = (hash: Uint8Array) => Promise<string | null>;

export type Authenticated =
  | { readonly ok: true; readonly playerId: string }
  | { readonly ok: false; readonly response: Response };

/** One body for every refusal, so a refusal never says why. */
const unauthorised = (): Response =>
  Response.json(
    { error: 'unauthorised' },
    { status: 401, headers: { 'cache-control': 'no-store' } },
  );

const BEARER = 'Bearer ';

/**
 * The player a request's `Authorization: Bearer <token>` belongs to, or the
 * one 401 every missing, malformed or unknown token gets alike.
 */
export async function authenticate(
  authorization: string | null,
  find: FindPlayer,
): Promise<Authenticated> {
  const token =
    authorization !== null && authorization.startsWith(BEARER)
      ? authorization.slice(BEARER.length)
      : '';
  const playerId = await find(await hashToken(token));
  return playerId === null
    ? { ok: false, response: unauthorised() }
    : { ok: true, playerId };
}
