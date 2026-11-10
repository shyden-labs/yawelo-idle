/**
 * The Yawelo Idle sync Worker. In M0 it serves one route, `GET /health`, which
 * the dev deploy's verify job reads to prove two things about the live Worker:
 * it is the commit that was just deployed, and its D1 binding answers a query.
 *
 * On any host but the production API host, every response carries the
 * noindex header and `/robots.txt` blocks crawlers (#39). There is no password:
 * native apps cannot answer a browser challenge (operator decision 2026-10-01).
 *
 * Behind its door (#784 AC4), a request without this environment's door
 * secret is refused before anything else (apps/door/worker/origin.ts).
 */
import { markApiRequest } from '@yawelo-idle/lockdown';
import { refusal, type OriginEnv } from '../../door/worker/origin';

const json = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...headers },
  });

async function health(env: Env): Promise<Response> {
  try {
    await env.DB.prepare('SELECT 1').run();
  } catch (error) {
    // The response says only `unreachable`; the cause goes to the Worker logs.
    console.error('health: D1 query failed', error);
    return json({ ok: false, commit: env.COMMIT, db: 'unreachable' }, 503);
  }
  return json({ ok: true, commit: env.COMMIT, db: 'ok' }, 200);
}

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname !== '/health') {
    return json({ error: 'not_found' }, 404);
  }
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
  }
  return health(env);
}

export default {
  async fetch(request, env): Promise<Response> {
    const refused = await refusal(
      request,
      env,
      crypto.subtle.timingSafeEqual.bind(crypto.subtle),
    );
    if (refused !== undefined) return refused;
    return markApiRequest(request, (marked) => route(marked, env));
  },
} satisfies ExportedHandler<Env & OriginEnv>;
