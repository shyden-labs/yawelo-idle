/**
 * The dev doors in front of the real dev Workers (#816, #1013; Shyden's
 * ruling on #813: real Workers, no echo stand-ins). Run after each dev deploy,
 * once verify-dev has seen this commit served, it checks what only the
 * deployed door can show: that a request reaches its real Worker unchanged.
 *
 * - Path and query: `/play?q=1` on the site's dev name, with the non-prod
 *   login, is redirected by the real game's assets to `/play/?q=1`.
 * - Method: `POST /health` on the API's dev name is refused by the real sync
 *   Worker with 405 and `Allow: GET`.
 * - Body: a GitHub `ping` signed with the roadmap's webhook secret is
 *   answered 204 by the real site Worker, and the same signature over a body
 *   one byte different is refused 401, so the body arrived byte for byte.
 *
 * Which host reaches which Worker, and every look-alike host, are tested on
 * the door's own logic (apps/door).
 * Nothing is retried; each problem is named, with no header printed.
 */
import { createHmac } from 'node:crypto';
import { DOORS } from '../apps/door/worker/doors.ts';

/** The dev door that reaches `worker`. */
function devHost(worker: string): string {
  const host = [...DOORS].find(([, door]) => door.worker === worker)?.[0];
  if (host === undefined) throw new Error(`no dev door reaches ${worker}`);
  return `https://${host}`;
}

export const SITE_HOST = devHost('yawelo-idle-site-dev');
export const API_HOST = devHost('yawelo-idle-sync-dev');

export const PING = JSON.stringify({
  zen: 'dev-hosts check (#816)',
  hook_id: 0,
});

export interface Inputs {
  readonly password: string;
  readonly webhookSecret: string;
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const sign = (secret: string, body: string): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

/** Every problem the deployed doors show; none means they passed. */
export async function verifyDevHosts(
  fetchFn: Fetch,
  { password, webhookSecret }: Inputs,
): Promise<string[]> {
  const problems: string[] = [];
  const login = `Basic ${btoa(`tester:${password}`)}`;

  const play = await fetchFn(`${SITE_HOST}/play?q=1`, {
    headers: { Authorization: login },
    redirect: 'manual',
  });
  if (play.status !== 307 || play.headers.get('Location') !== '/play/?q=1')
    problems.push(
      `${SITE_HOST}/play?q=1: expected the game's 307 to /play/?q=1, got ${String(play.status)} to ${String(play.headers.get('Location'))}`,
    );

  const post = await fetchFn(`${API_HOST}/health`, {
    method: 'POST',
    redirect: 'manual',
  });
  if (post.status !== 405 || post.headers.get('Allow') !== 'GET')
    problems.push(
      `${API_HOST}/health POST: expected the sync Worker's 405 allowing GET, got ${String(post.status)} allowing ${String(post.headers.get('Allow'))}`,
    );

  const signature = sign(webhookSecret, PING);
  const hook = (body: string) =>
    fetchFn(`${SITE_HOST}/hooks/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'ping',
        'X-Hub-Signature-256': signature,
      },
      body,
      redirect: 'manual',
    });
  const signed = await hook(PING);
  if (signed.status !== 204)
    problems.push(
      `${SITE_HOST}/hooks/github: a signed ping should be answered 204, got ${String(signed.status)}`,
    );
  const altered = await hook(`${PING} `);
  if (altered.status !== 401)
    problems.push(
      `${SITE_HOST}/hooks/github: a ping one byte longer than its signature should be refused 401, got ${String(altered.status)}`,
    );

  return problems;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '')
    throw new Error(`${name} is not set`);
  return value;
}

if (import.meta.main) {
  const problems = await verifyDevHosts(fetch, {
    password: required('DEV_BASIC_AUTH_PASSWORD'),
    webhookSecret: required('ROADMAP_WEBHOOK_SECRET'),
  });
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
  console.log('dev doors: path, query, method and body reach the real Workers');
}
