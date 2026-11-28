/**
 * The site Worker, the front door (website spec §7.2): every request passes
 * the non-prod gate (#39) except `/hooks/github`, then `/play` and `/play/*`
 * go to the game Worker through the GAME service binding, `/api/roadmap*` to
 * the `Roadmap` Durable Object (#341), `/api/private/*` to the private API
 * docs on dev alone (#589), and everything else to the site's own
 * prerendered pages, the site being built, through the door and at this
 * Worker's own address alike (Shyden, 2026-11-28, #1078). A visit reads the board once the last read is 10 minutes old (#1074).
 *
 * `DEV_PASSWORD`, `ROADMAP_WEBHOOK_SECRET` and `ROADMAP_APP_KEY` are Worker
 * secrets, uploaded by the deploy from the `dev` environment's secrets (#357,
 * #341); a missing password locks the gate and a missing webhook secret
 * refuses every delivery. `DOOR_SECRET` (#784) is uploaded with them.
 *
 * Behind its door (#784 AC4), a request without this environment's door
 * secret is refused before anything else, the webhook path included
 * (apps/door/worker/origin.ts). DOOR_REQUIRED is "false" until the go-live.
 */
import { gateWebRequest } from '@yawelo-idle/lockdown';
import { refusal, workerEqual } from '../../door/worker/origin';
import type { RoadmapEnv } from './roadmap';
import {
  HOOK_PATH,
  isGamePath,
  isRoadmapPath,
  ROADMAP_PATHS,
  isPrivatePath,
  PRIVATE_PATHS,
  servesPrivate,
  UNREADABLE,
} from './routes';
import { classifyEvent, verifySignature } from './webhook';
import { eventWitness } from './witness';
import { declaredOverCap, readUpToCap } from './body';
import { isSupportPath, serveSupport } from './support';
import { carryBoard } from './carry';
import privateSpec from '../api/private.openapi.json';

export { Roadmap } from './roadmap';

interface SiteEnv extends RoadmapEnv {
  /** Secrets, so `wrangler types` cannot see them; absent means refused. */
  readonly DEV_PASSWORD?: string;
  readonly ROADMAP_WEBHOOK_SECRET?: string;
  /** This environment's door secret (#784), which every door request carries. */
  readonly DOOR_SECRET?: string;
}

const roadmap = (env: SiteEnv) => env.ROADMAP.getByName('board');

const noStore = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** `/hooks/github`: signature first, then only this board's events cause a read. */
async function hook(
  request: Request,
  env: SiteEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== 'POST')
    return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  // A declared length is refused before reading.
  if (declaredOverCap(request.headers))
    return new Response(null, { status: 413 });
  const body =
    request.body === null
      ? new ArrayBuffer(0)
      : await readUpToCap(request.body as ReadableStream<Uint8Array>);
  if (body === 413) return new Response(null, { status: 413 });
  const signature = request.headers.get('X-Hub-Signature-256');
  if (!(await verifySignature(env.ROADMAP_WEBHOOK_SECRET, body, signature)))
    return new Response(null, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return new Response(null, { status: 400 });
  }
  const name = request.headers.get('X-GitHub-Event') ?? '';
  const verdict = classifyEvent(name, payload, {
    id: env.ROADMAP_BOARD_ID,
    repo: env.ROADMAP_REPO,
  });
  if (verdict !== 'read') return new Response(null, { status: 204 });
  ctx.waitUntil(roadmap(env).changed(eventWitness(name, payload)));
  return new Response(null, { status: 202 });
}

/**
 * `/api/private/*` (#589): a bare 404 on the public host, whatever the
 * method; on dev, once past the password, the spec from the Worker and the
 * docs page from the prerendered pages.
 */
async function privateDocs(request: Request, env: SiteEnv): Promise<Response> {
  const { hostname, pathname } = new URL(request.url);
  if (!servesPrivate(hostname)) return new Response(null, { status: 404 });
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (pathname === PRIVATE_PATHS.spec) return noStore(privateSpec);
  return env.ASSETS.fetch(request);
}

/** The three roadmap paths, once the gate has let the request through. */
async function api(request: Request, env: SiteEnv): Promise<Response> {
  const { hostname, pathname } = new URL(request.url);
  const health = pathname === ROADMAP_PATHS.health;
  // Never hinted at on the public host, whatever the method (#846).
  if (health && !servesPrivate(hostname))
    return new Response(null, { status: 404 });
  // Read-only, as the API spec says (#588): any other method is refused.
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (pathname === ROADMAP_PATHS.live) return roadmap(env).fetch(request);
  if (health) return noStore(await roadmap(env).health());
  const snapshot = await roadmap(env).snapshot();
  if (snapshot !== null) return noStore(snapshot);
  return noStore({ error: UNREADABLE }, 503);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const refused = await refusal(request, env, workerEqual);
    if (refused !== undefined) return refused;
    const { pathname } = new URL(request.url);
    if (pathname === HOOK_PATH) return hook(request, env, ctx);
    return gateWebRequest(request, env.DEV_PASSWORD, (allowed) => {
      const { pathname: path } = new URL(allowed.url);
      if (isGamePath(path)) return env.GAME.fetch(allowed);
      if (isRoadmapPath(path)) return api(allowed, env);
      if (isPrivatePath(path)) return privateDocs(allowed, env);
      if (isSupportPath(path))
        return serveSupport(allowed, env.ASSETS, env.SHYDESK_HOST);
      // The site being built, through the door and at this Worker's own
      // address alike (Shyden, 2026-11-28, #1078).
      return env.ASSETS.fetch(allowed).then((page) =>
        carryBoard(path, page, () => roadmap(env).snapshot()),
      );
    });
  },
} satisfies ExportedHandler<SiteEnv>;
