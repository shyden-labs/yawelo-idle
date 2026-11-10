/**
 * The holding page's dev copy (#621 AC8) behind its door (#784 AC4): its
 * files are served only to a request carrying the dev door secret, which the
 * door adds, and the dev site passes on when it shows the holding page at its
 * own door. Run before its files (`run_worker_first`), so no file, nor the
 * 404 page, answers without the check. DOOR_REQUIRED is "false" until the
 * go-live (apps/door/worker/origin.ts).
 */
import { behindDoor, type OriginEnv } from '../../door/worker/origin';

/** What the deploy gives the holding page's dev copy. */
export interface HoldingEnv extends OriginEnv {
  readonly ASSETS: Fetcher;
}

export default {
  fetch: (request, env) =>
    behindDoor(request, env, (admitted) => env.ASSETS.fetch(admitted)),
} satisfies ExportedHandler<HoldingEnv>;
