/**
 * The dev hostnames and the Worker each one reaches through the adapter's
 * Function, functions/[[path]].ts (#429). Every Shyden product's dev lives
 * at dev.{product}.shyden.co.uk (operator, 2026-10-06); the site's name
 * serves the pages and the game behind the dev password, the API's name
 * serves the sync Worker, and the holding name serves the holding page's dev
 * copy, which Shyden checks on his phones (#768).
 *
 * Since DEV moved to the non-PROD account (#784, Shyden 2026-11-16) the
 * adapter, a Pages project left in Shyden Labs Dev, cannot reach the Workers
 * by service binding, which works within one account only. Each dev hostname
 * stands in for the front door that reaches the same Worker and passes the
 * request on through the door's own code (../door/worker/door.ts): to the
 * Worker's workers.dev address, with the dev door secret and the door's name,
 * so the site still knows a request came through dev. (#673). Retired when
 * the doors go live.
 *
 * Maps, not object literals: a lookup by an arbitrary hostname must not find
 * a key every plain object inherits, such as `constructor`.
 */
import { pass, type Fetch } from '../door/worker/door.ts';

export type DevWorker = 'SITE' | 'SYNC' | 'HOLDING';

export const DEV_HOSTS: ReadonlyMap<string, DevWorker> = new Map([
  ['dev.yawelo-idle.shyden.co.uk', 'SITE'],
  ['dev-api.yawelo-idle.shyden.co.uk', 'SYNC'],
  ['dev-holding.yawelo-idle.shyden.co.uk', 'HOLDING'],
]);

/** The front door each dev hostname stands in for (../door/worker/door.ts). */
export const DEV_DOORS: Readonly<Record<DevWorker, string>> = {
  SITE: 'dev.yaweloidle.com',
  SYNC: 'dev-api.yaweloidle.com',
  HOLDING: 'dev-holding.yaweloidle.com',
};

/** What the adapter's deploy gives it: the door's dev half. */
export interface DevHostsEnv {
  /** The non-PROD account's workers.dev domain, `<subdomain>.workers.dev`. */
  readonly ORIGIN_DOMAIN: string;
  /** The dev door secret, which the dev origins compare. */
  readonly DEV_DOOR_SECRET: string;
}

/**
 * The adapter's whole behaviour: the request, through its door, to the
 * Worker its host names, or a 404 that reaches no Worker for any other host
 * (the project's own pages.dev address and every preview deployment's, which
 * are public).
 */
export function forward(
  request: Request,
  env: DevHostsEnv,
  fetch: Fetch,
): Promise<Response> {
  const worker = DEV_HOSTS.get(new URL(request.url).hostname);
  if (worker === undefined)
    return Promise.resolve(
      new Response('not found', {
        status: 404,
        headers: { 'cache-control': 'no-store' },
      }),
    );
  const atDoor = new URL(request.url);
  atDoor.hostname = DEV_DOORS[worker];
  return pass(
    new Request(atDoor, request),
    { ...env, TEST_DOOR_SECRET: '' },
    fetch,
  );
}

/**
 * The Function's handler, re-exported by functions/[[path]].ts as
 * onRequest: the Pages context's request and env, sent on with the runtime's
 * own fetch.
 */
export function handle(context: {
  readonly request: Request;
  readonly env: DevHostsEnv;
}): Promise<Response> {
  return forward(context.request, context.env, (forwarded) => fetch(forwarded));
}
