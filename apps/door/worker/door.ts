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

/** The header carrying the door secret; any value a caller sent is replaced. */
export const DOOR_SECRET_HEADER = 'x-yawelo-door-secret';

/**
 * The header naming the door a request came through, so an origin can answer
 * by door (the dev site shows the holding page at its door). Trusted by an
 * origin only alongside a valid secret; any value a caller sent is replaced.
 */
export const DOOR_HOST_HEADER = 'x-yawelo-door';

export type Environment = 'dev' | 'test';

export interface Door {
  /** The Worker this door reaches, by its name in the non-PROD account. */
  readonly worker: string;
  /** Whose door secret the request carries. */
  readonly environment: Environment;
}

/**
 * Every door, by host. Doors sit on PROD's zone, yaweloidle.com (Shyden,
 * 2026-11-09). A Map, not an object literal: a lookup by an arbitrary host
 * must not find a key every plain object inherits, such as `constructor`.
 */
export const DOORS: ReadonlyMap<string, Door> = new Map([
  [
    'dev.yaweloidle.com',
    { worker: 'yawelo-idle-site-dev', environment: 'dev' },
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
    { worker: 'yawelo-idle-site-test', environment: 'test' },
  ],
]);

/** What the deploy gives the door: no binding, only these three values. */
export interface DoorEnv {
  /** The non-PROD account's workers.dev domain, `<subdomain>.workers.dev`. */
  readonly ORIGIN_DOMAIN: string;
  readonly DEV_DOOR_SECRET: string;
  readonly TEST_DOOR_SECRET: string;
}

export type Fetch = (request: Request) => Promise<Response>;

const SECRET_OF: Readonly<Record<Environment, keyof DoorEnv>> = {
  dev: 'DEV_DOOR_SECRET',
  test: 'TEST_DOOR_SECRET',
};

const answer = (status: number, body: string): Response =>
  new Response(body, { status, headers: { 'cache-control': 'no-store' } });

/**
 * Passes `request` through its door, or answers without reaching any origin:
 * 404 for a host that is no door, 500 naming a value the deploy left unset.
 * The origin's answer comes back as it is, so a WebSocket upgrade (the live
 * roadmap, apps/site/worker/roadmap.ts) passes through, and a redirect is the
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

  const target = new URL(request.url);
  target.protocol = 'https:';
  target.hostname = `${door.worker}.${env.ORIGIN_DOMAIN}`;
  target.port = '';
  const forwarded = new Request(target, request);
  const headers = new Headers(forwarded.headers);
  headers.set(DOOR_SECRET_HEADER, env[secretName]);
  headers.set(DOOR_HOST_HEADER, host);
  return fetch(new Request(forwarded, { headers, redirect: 'manual' }));
}
