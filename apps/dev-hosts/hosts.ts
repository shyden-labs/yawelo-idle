/**
 * The dev hostnames and the service binding each one reaches through the
 * adapter's Function, functions/[[path]].ts (#429). Every Shyden product's
 * dev lives at dev.{product}.shyden.co.uk (operator, 2026-10-06); the
 * site's name serves the pages and the game behind the dev password, the
 * API's name serves the sync Worker, and the holding name serves the holding
 * page's dev copy, which Shyden checks on his phones (#768).
 *
 * A Map, not an object literal: a lookup by an arbitrary hostname must not
 * find a key every plain object inherits, such as `constructor`.
 */
export type DevBinding = 'SITE' | 'SYNC' | 'HOLDING';

export const DEV_HOSTS: ReadonlyMap<string, DevBinding> = new Map([
  ['dev.yawelo-idle.shyden.co.uk', 'SITE'],
  ['dev-api.yawelo-idle.shyden.co.uk', 'SYNC'],
  ['dev-holding.yawelo-idle.shyden.co.uk', 'HOLDING'],
]);

/** Anything a service binding offers that the adapter uses. */
export interface Forward {
  readonly fetch: (request: Request) => Promise<Response> | Response;
}

/**
 * The adapter's whole behaviour: the request, unchanged, to the binding its
 * host names, or a 404 that reaches no Worker for any other host (the
 * project's own pages.dev address and every preview deployment's, which are
 * public).
 */
export function forward(
  request: Request,
  bindings: Readonly<Record<DevBinding, Forward>>,
): Promise<Response> | Response {
  const binding = DEV_HOSTS.get(new URL(request.url).hostname);
  if (binding === undefined)
    return new Response('not found', {
      status: 404,
      headers: { 'cache-control': 'no-store' },
    });
  return bindings[binding].fetch(request);
}
