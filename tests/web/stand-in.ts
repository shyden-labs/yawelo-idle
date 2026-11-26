/**
 * The dev smoke's stand-in for the site's door (#1078). The smoke reaches the
 * site Worker at its own workers.dev address, never through a door (#784
 * AC1b), so it sends what the door would: the door secret and the door's name
 * (scripts/door-stand-in.ts). Only to that one origin: never through
 * `extraHTTPHeaders`, which reaches every host the page asks, Cloudflare's
 * beacon and the media host among them, and would hand them the secret.
 */
import type { BrowserContext } from '@playwright/test';

/**
 * The headers to add to a request for `url`: `door` when `url` is on
 * `target`'s exact origin (scheme, host and port), else none.
 */
export function standInHeaders(
  url: string,
  target: string,
  door: Readonly<Record<string, string>>,
): Record<string, string> {
  return new URL(url).origin === new URL(target).origin ? { ...door } : {};
}

/**
 * Adds `door` to every request `context` makes to `target`'s origin; the
 * request itself still goes to the real server, with its own headers kept.
 */
export async function standInForTheDoor(
  context: BrowserContext,
  target: string,
  door: Readonly<Record<string, string>>,
): Promise<void> {
  await context.route(`${new URL(target).origin}/**`, (route) => {
    const request = route.request();
    return route.continue({
      headers: {
        ...request.headers(),
        ...standInHeaders(request.url(), target, door),
      },
    });
  });
}
