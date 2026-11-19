/**
 * Device identity (#163; spec §6.6, D6): an anonymous device registers and
 * gets a high-entropy token, returned once. The Worker keeps only the
 * token's SHA-256 and compares hashes in constant time. Web APIs only, so the
 * unit suite runs it in Node and the Worker runs it in workerd.
 */
import { z } from 'zod';
import { readBody } from './validate';

/** The token's entropy: 32 random bytes, 256 bits. */
export const TOKEN_BYTES = 32;

/**
 * The largest registration body accepted (#164): the body is `{}`, so 64
 * bytes leaves room for whitespace a client may add and nothing more.
 */
export const REGISTRATION_MAX_BYTES = 64;
/** A registration's body: nothing, strictly (no personal data, spec D6). */
export const registrationBody = z.strictObject({});

/** Fills `bytes` with random values; the Web Crypto source by default. */
export type RandomSource = (
  bytes: Uint8Array<ArrayBuffer>,
) => Uint8Array<ArrayBuffer>;

const defaultRandom: RandomSource = (bytes) => {
  crypto.getRandomValues(bytes);
  return bytes;
};

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
    authorization?.startsWith(BEARER) === true
      ? authorization.slice(BEARER.length)
      : '';
  const playerId = await find(await hashToken(token));
  return playerId === null
    ? { ok: false, response: unauthorised() }
    : { ok: true, playerId };
}

/** The rows one registration adds: a new player and its first device. */
export interface NewDevice {
  readonly playerId: string;
  readonly deviceId: string;
  readonly tokenHash: Uint8Array;
  readonly createdAt: number;
}

/** Stores a registration (two D1 inserts in one batch). */
export type SaveDevice = (device: NewDevice) => Promise<void>;

/** Ids, the clock and randomness, so tests can stand them in. */
export interface RegisterDeps {
  readonly uuid: () => string;
  readonly now: () => number;
  readonly random?: RandomSource;
}

const json = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...headers },
  });

/**
 * POST /v1/devices (#163; spec §6.6, D6): a new anonymous player and its first
 * device. The token is returned once and only its SHA-256 is saved; the
 * answer carries nothing about any other player.
 */
export async function registerDevice(
  request: Request,
  save: SaveDevice,
  deps: RegisterDeps,
): Promise<Response> {
  if (request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  const body = await readBody(
    request,
    registrationBody,
    REGISTRATION_MAX_BYTES,
  );
  if (!body.ok) return body.response;
  const playerId = deps.uuid();
  const token = newToken(deps.random);
  await save({
    playerId,
    deviceId: deps.uuid(),
    tokenHash: await hashToken(token),
    createdAt: deps.now(),
  });
  return json({ playerId, token }, 201);
}
