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
 * The door `request` came through, or undefined when it is not believed: the
 * origin has no secret (an empty one would let anyone in), the request
 * carries none or the wrong one, or it names no door.
 */
export async function doorOf(
  request: Request,
  secret: string | undefined,
  equal: Equal,
): Promise<string | undefined> {
  if (secret === undefined || secret.length === 0) return undefined;
  const given = request.headers.get(DOOR_SECRET_HEADER);
  if (given === null) return undefined;
  const [givenDigest, ownDigest] = await Promise.all([
    digest(given),
    digest(secret),
  ]);
  if (!equal(givenDigest, ownDigest)) return undefined;
  return request.headers.get(DOOR_HOST_HEADER) ?? undefined;
}
