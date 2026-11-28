/**
 * Cloudflare Web Analytics' beacon, which Cloudflare injects on every page
 * served through the front door: the site-wide exception (website spec W17;
 * Shyden chose cookieless analytics, #451). Measured on dev 2026-11-23
 * (deploy run 45069145980) and on the API docs pages 2026-11-28 (deploy run
 * 46146286886, once #1078 sent the site smoke through the dev door). It
 * reports to the page's own origin.
 */
export const BEACON = 'https://static.cloudflareinsights.com';

/** The requests a page made to any origin but its own and the beacon's. */
export const foreignTo = (origin: string, requested: readonly string[]) =>
  requested.filter((url) => ![origin, BEACON].includes(new URL(url).origin));
