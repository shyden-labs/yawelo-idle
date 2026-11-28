/**
 * Every door, by host (#784), with no imports, so scripts that only need the
 * hosts load it under Node's own loader (tests/integration/script-loads.test.ts)
 * without the door's DEV pass code (#1078).
 */

/** The header carrying the door secret; any value a caller sent is replaced. */
export const DOOR_SECRET_HEADER = 'x-yawelo-door-secret';

/**
 * The header naming the door a request came through, so an origin can answer
 * by door (the dev site shows the holding page at its door). Trusted by an
 * origin only alongside a valid secret; any value a caller sent is replaced.
 */
export const DOOR_HOST_HEADER = 'x-yawelo-door';

/**
 * The header carrying the caller's address as Cloudflare gave it to the door
 * (#164 AC2): past the door, an origin's own `CF-Connecting-IP` is
 * Cloudflare's Worker address, the same for everyone. Trusted by an origin
 * only alongside a valid secret; any value a caller sent is replaced.
 */
export const DOOR_CLIENT_HEADER = 'x-yawelo-client';

export type Environment = 'dev' | 'test';

export interface Door {
  /** The Worker this door reaches, by its name in the non-PROD account. */
  readonly worker: string;
  /** Whose door secret the request carries. */
  readonly environment: Environment;
  /**
   * Its pages embed another product's piece (ShyDesk's support form,
   * shyden-labs/repo-template#209): the door swaps a visitor's DEV pass for
   * that product's embed pass through the sign-in (#1078, shydesk#302).
   */
  readonly embeds?: true;
  /**
   * Exact paths whose POST goes on with no DEV pass, the origin checking the
   * caller itself: GitHub's roadmap webhook, signed with its HMAC (Shyden,
   * 2026-11-26, #1078).
   */
  readonly openPost?: readonly string[];
}

/**
 * Every door, by host. Doors sit on PROD's zone, yaweloidle.com (Shyden,
 * 2026-11-09). A Map, not an object literal: a lookup by an arbitrary host
 * must not find a key every plain object inherits, such as `constructor`.
 */
export const DOORS: ReadonlyMap<string, Door> = new Map([
  [
    'dev.yaweloidle.com',
    {
      worker: 'yawelo-idle-site-dev',
      environment: 'dev',
      embeds: true,
      openPost: ['/hooks/github'],
    },
  ],
  [
    'dev-api.yaweloidle.com',
    { worker: 'yawelo-idle-sync-dev', environment: 'dev' },
  ],
  [
    'dev-holding.yaweloidle.com',
    { worker: 'yawelo-idle-holding-dev', environment: 'dev' },
  ],
  [
    'test.yaweloidle.com',
    { worker: 'yawelo-idle-holding-test', environment: 'test' },
  ],
]);
