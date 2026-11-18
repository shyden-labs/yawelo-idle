/**
 * The holding page's dev copy (#621 AC8) behind its door (#784 AC4): its
 * files are served only to a request carrying the dev door secret, which the
 * door adds, and the dev site passes on when it shows the holding page at its
 * own door. Run before its files (`run_worker_first`), so no file, nor the
 * 404 page, answers without the check. DOOR_REQUIRED is "false" until the
 * go-live (apps/door/worker/origin.ts).
 *
 * Its types are declared here rather than taken from the Workers types: the
 * root typecheck reads this file, through its unit test, with Node's.
 */
import {
  behindDoor,
  workerEqual,
  type Equal,
  type OriginEnv,
} from '../../door/worker/origin';

/** The holding page's files: the deploy's assets binding. */
export interface Files {
  fetch(request: Request): Promise<Response>;
}

/** What the deploy gives the holding page's dev copy. */
export interface HoldingEnv extends OriginEnv {
  readonly ASSETS: Files;
}

/** Its answer to `request`; `equal` is the runtime's comparison in a Worker. */
export function serveHolding(
  request: Request,
  env: HoldingEnv,
  equal: Equal = workerEqual,
): Promise<Response> {
  return behindDoor(
    request,
    env,
    (admitted) => env.ASSETS.fetch(admitted),
    equal,
  );
}

export default {
  fetch: (request: Request, env: HoldingEnv): Promise<Response> =>
    serveHolding(request, env),
};
