/**
 * The origin's side of the door (#784 AC4): whether a request came through
 * a door, judged by the door secret it carries. The door (./door.ts) replaces
 * any secret or door name a caller sent, so a request carrying the origin's
 * own secret came through a door, and the door's name it carries is true.
 *
 * Shared by every origin behind a door, so each judges the same way.
 */
import { DOOR_HOST_HEADER, DOOR_SECRET_HEADER } from './door';

/**
 * A constant-time comparison: the runtime's `crypto.subtle.timingSafeEqual`
 * in a Worker. It is handed two SHA-256 digests, so both are always 32 bytes
 * and it never throws on a length a caller chose.
 */
export type Equal = (a: ArrayBuffer, b: ArrayBuffer) => boolean;

const digest = (text: string): Promise<ArrayBuffer> =>
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

/**
 * Whether `request` carries the origin's own door secret. Never when the
 * origin has none: an empty one would let anyone in.
 */
async function carriesSecret(
  request: Request,
  secret: string | undefined,
  equal: Equal,
): Promise<boolean> {
  if (secret === undefined || secret.length === 0) return false;
  const given = request.headers.get(DOOR_SECRET_HEADER);
  if (given === null) return false;
  const [givenDigest, ownDigest] = await Promise.all([
    digest(given),
    digest(secret),
  ]);
  return equal(givenDigest, ownDigest);
}

/**
 * The door `request` came through, or undefined when it is not believed: the
 * origin has no secret (an empty one would let anyone in), the request
 * carries none or the wrong one, or it names no door.
 */
export async function doorOf(
  request: Request,
  secret: string | undefined,
  equal: Equal,
): Promise<string | undefined> {
  if (!(await carriesSecret(request, secret, equal))) return undefined;
  return request.headers.get(DOOR_HOST_HEADER) ?? undefined;
}

/** What an origin behind a door is given by its deploy (#784 AC4). */
export interface OriginEnv {
  /** "false" until the doors go live; any other value, or none, requires the door. */
  readonly DOOR_REQUIRED?: string;
  /** This environment's door secret, which the door adds to every request. */
  readonly DOOR_SECRET?: string;
}

const answer = (status: number, body: string): Response =>
  new Response(body, { status, headers: { 'cache-control': 'no-store' } });

/**
 * The answer an origin gives instead of its own, or undefined to serve the
 * request: 403 for a request without the origin's door secret, 500 naming
 * DOOR_SECRET when the door is required and the deploy left it unset. Only
 * DOOR_REQUIRED of exactly "false" admits every request (before the go-live).
 */
export async function refusal(
  request: Request,
  env: OriginEnv,
  equal: Equal,
): Promise<Response | undefined> {
  if (env.DOOR_REQUIRED === 'false') return undefined;
  if (env.DOOR_SECRET === undefined || env.DOOR_SECRET.length === 0)
    return answer(500, 'origin not configured: DOOR_SECRET');
  if (await carriesSecret(request, env.DOOR_SECRET, equal)) return undefined;
  return answer(403, 'forbidden');
}

/** The Worker runtime's constant-time comparison, as each origin uses it. */
export const workerEqual: Equal = (a, b) => crypto.subtle.timingSafeEqual(a, b);

/**
 * Each origin's entry (#784 AC4): the refusal, or `serve`'s answer to the
 * request untouched. `equal` is the runtime's comparison in a Worker.
 */
export async function behindDoor(
  request: Request,
  env: OriginEnv,
  serve: (admitted: Request) => Promise<Response>,
  equal: Equal = workerEqual,
): Promise<Response> {
  return (await refusal(request, env, equal)) ?? serve(request);
}
