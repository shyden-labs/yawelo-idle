/**
 * The dev hostname adapter in front of the real dev Workers (#816; Shyden's
 * ruling on #813: real Workers, no echo stand-ins). Run after each dev deploy,
 * once verify-dev has seen this commit served, it checks what only the
 * deployed adapter can show: that a request reaches its real Worker
 * unchanged, and that the adapter's own public address reaches none.
 *
 * - Path and query: `/play?q=1` on the site's dev name, with the non-prod
 *   login, is redirected by the real game's assets to `/play/?q=1`.
 * - Method: `POST /health` on the API's dev name is refused by the real sync
 *   Worker with 405 and `Allow: GET`.
 * - Body: a GitHub `ping` signed with the roadmap's webhook secret is
 *   answered 204 by the real site Worker, and the same signature over a body
 *   one byte different is refused 401, so the body arrived byte for byte.
 * - The adapter's own pages.dev address answers its 404 `not found`.
 *
 * Which host names reach which binding, and every look-alike host, are
 * unit-tested on the adapter's logic (tests/unit/dev-hosts.test.ts).
 * Nothing is retried; each problem is named, with no header printed.
 */
import { createHmac } from 'node:crypto';
import { DEV_HOSTS, type DevBinding } from '../apps/dev-hosts/hosts.ts';

/** The dev hostname the adapter maps to `binding`. */
function devHost(binding: DevBinding): string {
  const host = [...DEV_HOSTS].find(([, b]) => b === binding)?.[0];
  if (host === undefined) throw new Error(`no dev hostname reaches ${binding}`);
  return `https://${host}`;
}

export const SITE_HOST = devHost('SITE');
export const API_HOST = devHost('SYNC');
export const ADAPTER_OWN = 'https://yawelo-idle-dev-hosts.pages.dev';

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

/** Every problem the deployed adapter shows; none means it passed. */
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

  const own = await fetchFn(`${ADAPTER_OWN}/`, { redirect: 'manual' });
  const ownText = await own.text();
  if (own.status !== 404 || ownText !== 'not found')
    problems.push(
      `${ADAPTER_OWN}/: expected the adapter's 404 "not found", got ${String(own.status)}`,
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
  console.log(
    'dev hosts: path, query, method and body reach the real Workers; the adapter keeps its own address',
  );
}
