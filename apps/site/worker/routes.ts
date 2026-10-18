/**
 * Which Worker answers which path. Kept out of index.ts because a Worker's
 * entry module may export only handlers: workerd refuses any other export at
 * startup (measured, #332).
 */

/** Where GitHub's org webhooks deliver (#341). */
export const HOOK_PATH = '/hooks/github';

/**
 * Paths a caller without the password must reach. GitHub's webhook cannot
 * send Basic credentials, and each delivery is signed instead (#341).
 */
export const EXEMPT_PATHS: readonly string[] = [HOOK_PATH];

/**
 * The roadmap's paths (#341), behind the password on dev like every page:
 * each browser engine sends its cached Basic credentials on the socket
 * upgrade too (spec §10 R6, measured 2026-10-06).
 */
export const ROADMAP_PATHS = {
  snapshot: '/api/roadmap.json',
  health: '/api/roadmap/health',
  live: '/api/roadmap/live',
} as const;

/** Whether `pathname` is one of the roadmap's paths. */
export function isRoadmapPath(pathname: string): boolean {
  return (Object.values(ROADMAP_PATHS) as readonly string[]).includes(pathname);
}

/**
 * The dev front door (apps/dev-hosts/hosts.ts maps it to this Worker), whose
 * pages are the holding page production shows (#673; Shyden, 2026-10-18:
 * "Dev shows holding"). The site being built stays at this Worker's own
 * workers.dev address, behind the same gate.
 */
export const HOLDING_HOST = 'dev.yawelo-idle.shyden.co.uk';

/** Whether a page request on `hostname` is the holding page's to answer. */
export function showsHolding(hostname: string): boolean {
  return hostname === HOLDING_HOST;
}

/** The game's paths, forwarded to the game Worker. */
export function isGamePath(pathname: string): boolean {
  return pathname === '/play' || pathname.startsWith('/play/');
}
