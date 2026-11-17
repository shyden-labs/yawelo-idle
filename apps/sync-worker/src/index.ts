/**
 * The Yawelo Idle sync Worker. `GET /health` is what the dev deploy's verify
 * job reads to prove two things about the live Worker: it is the commit that
 * was just deployed, and its D1 binding answers a query. `POST /v1/devices`
 * registers an anonymous device (#163).
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
import { hashToken, newToken, registrationBody } from './devices';

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

/**
 * POST /v1/devices (#163; spec §6.6, D6): a new anonymous player and its first
 * device. The token is returned once and only its SHA-256 is stored; the
 * answer carries nothing about any other player.
 */
async function register(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!registrationBody.safeParse(body).success)
    return json({ error: 'invalid_body' }, 400);
  const playerId = crypto.randomUUID();
  const token = newToken();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO players (id, created_at) VALUES (?, ?)').bind(
      playerId,
      now,
    ),
    env.DB.prepare(
      'INSERT INTO devices (id, player_id, token_hash, created_at) VALUES (?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), playerId, await hashToken(token), now),
  ]);
  return json({ playerId, token }, 201);
}

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === '/v1/devices') {
    if (request.method !== 'POST')
      return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
    return register(request, env);
  }
  if (pathname !== '/health') {
    return json({ error: 'not_found' }, 404);
  }
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
  }
  return health(env);
}

export default {
  fetch(request, env): Promise<Response> {
    return behindDoor(request, env, (admitted) =>
      markApiRequest(admitted, (marked) => route(marked, env)),
    );
  },
} satisfies ExportedHandler<Env & OriginEnv>;
