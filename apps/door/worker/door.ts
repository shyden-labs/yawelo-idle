/**
 * The front door's whole behaviour (#784 AC4): a person reaches DEV or TEST at
 * a name on PROD's zone, and the door passes each request on, whole, to that
 * environment's Worker at its workers.dev address in the non-PROD account,
 * with that environment's door secret. Each origin will accept only requests
 * carrying its secret, so the door is the one public way in (the doors and
 * the origins' refusal go live together, 2026-11-15).
 *
 * The door holds no binding (tests/unit/door-config.test.ts): its origin
 * domain and the two secrets are set by the deploy. CI and tests reach the
 * origins at their workers.dev addresses, never through a door (#784 AC1b).
 */

import { handleDevDoor } from './dev-pass/door';
import type { PublicKeys } from './dev-pass/pass';
import { DOORS, type Environment } from './doors';

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

export { DOORS, type Door, type Environment } from './doors';

/** What the deploy gives the door: no binding, only these four values. */
export interface DoorEnv {
  /** The non-PROD account's workers.dev domain, `<subdomain>.workers.dev`. */
  readonly ORIGIN_DOMAIN: string;
  readonly DEV_DOOR_SECRET: string;
  readonly TEST_DOOR_SECRET: string;
  /**
   * The DEV pass public keys, JSON `{ "<kid>": "<x>" }` (#1078): the sign-in's
   * keys, a set so a rotation can overlap (repo-template docs/dev-pass.md).
   */
  readonly DEV_PASS_KEYS: string;
}

export type Fetch = (request: Request) => Promise<Response>;

const SECRET_OF: Readonly<Record<Environment, keyof DoorEnv>> = {
  dev: 'DEV_DOOR_SECRET',
  test: 'TEST_DOOR_SECRET',
};

const answer = (status: number, body: string): Response =>
  new Response(body, { status, headers: { 'cache-control': 'no-store' } });

/** The DEV pass keys from their JSON, or undefined unless a set of named keys. */
function parseKeys(json: string | undefined): PublicKeys | undefined {
  if (!json) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return undefined;
  const entries = Object.entries(parsed);
  if (entries.length === 0) return undefined;
  if (!entries.every(([, x]) => typeof x === 'string' && x !== ''))
    return undefined;
  return parsed as PublicKeys;
}

/**
 * Passes `request` through its door, or answers without reaching any origin:
 * 404 for a host that is no door, 500 naming a value the deploy left unset.
 * A dev door first checks the DEV pass (#1078, repo-template#207): with no
 * valid pass for this door the request goes no further, and the origin never
 * sees a pass. The test door checks none. The origin's answer comes back as
 * it is, so a WebSocket upgrade (the live roadmap,
 * apps/site/worker/roadmap.ts) passes through, and a redirect is the
 * caller's to follow.
 */
export async function pass(
  request: Request,
  env: DoorEnv,
  fetch: Fetch,
): Promise<Response> {
  const host = new URL(request.url).hostname;
  const door = DOORS.get(host);
  if (door === undefined) return answer(404, 'not found');
  const secretName = SECRET_OF[door.environment];
  // An unset secret or variable arrives as undefined, whatever the type says.
  for (const name of ['ORIGIN_DOMAIN', secretName] as const)
    if (!env[name]) return answer(500, `door not configured: ${name}`);

  const forward = (incoming: Request): Promise<Response> => {
    const target = new URL(incoming.url);
    target.protocol = 'https:';
    target.hostname = `${door.worker}.${env.ORIGIN_DOMAIN}`;
    target.port = '';
    const forwarded = new Request(target, incoming);
    const headers = new Headers(forwarded.headers);
    headers.set(DOOR_SECRET_HEADER, env[secretName]);
    headers.set(DOOR_HOST_HEADER, host);
    const client = incoming.headers.get('cf-connecting-ip');
    if (client === null) headers.delete(DOOR_CLIENT_HEADER);
    else headers.set(DOOR_CLIENT_HEADER, client);
    return fetch(new Request(forwarded, { headers, redirect: 'manual' }));
  };
  if (door.environment === 'test') return forward(request);

  const keys = parseKeys(env.DEV_PASS_KEYS);
  if (keys === undefined)
    return answer(500, 'door not configured: DEV_PASS_KEYS');
  return handleDevDoor(
    request,
    {
      host,
      keys,
      secretHeader: DOOR_SECRET_HEADER,
      secret: env[secretName],
      now: Math.floor(Date.now() / 1000),
    },
    forward,
  );
}
