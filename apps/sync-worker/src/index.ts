/**
 * The Yawelo Idle sync Worker. `GET /health` is what the dev deploy's verify
 * job reads to prove two things about the live Worker: it is the commit that
 * was just deployed, and its D1 binding answers a query. `POST /v1/devices`
 * registers an anonymous device (#163). Every route is in one table, with its
 * input checks and request limit (routes.ts, #164).
 *
 * On any host but the production API host, every response carries the
 * noindex header and `/robots.txt` blocks crawlers (#39). There is no password:
 * native apps cannot answer a browser challenge (operator decision 2026-10-01).
 *
 * Behind its door (#784 AC4), a request without this environment's door
 * secret is refused before anything else (apps/door/worker/origin.ts).
 */
import { markApiRequest } from '@yawelo-idle/lockdown';
import { behindDoor, type OriginEnv } from '../../door/worker/origin';
import { route } from './routes';

export default {
  fetch(request, env): Promise<Response> {
    return behindDoor(request, env, (admitted) =>
      markApiRequest(admitted, (marked) => route(marked, env)),
    );
  },
} satisfies ExportedHandler<Env & OriginEnv>;
