/**
 * Every door, by host (#784), with no imports, so scripts that only need the
 * hosts load it under Node's own loader (tests/integration/script-loads.test.ts)
 * without the door's DEV pass code (#1078).
 */

export type Environment = 'dev' | 'test';

export interface Door {
  /** The Worker this door reaches, by its name in the non-PROD account. */
  readonly worker: string;
  /** Whose door secret the request carries. */
  readonly environment: Environment;
}

/**
 * Every door, by host. Doors sit on PROD's zone, yaweloidle.com (Shyden,
 * 2026-11-09). A Map, not an object literal: a lookup by an arbitrary host
 * must not find a key every plain object inherits, such as `constructor`.
 */
export const DOORS: ReadonlyMap<string, Door> = new Map([
  [
    'dev.yaweloidle.com',
    { worker: 'yawelo-idle-site-dev', environment: 'dev' },
  ],
  [
    'dev-api.yaweloidle.com',
    { worker: 'yawelo-idle-sync-dev', environment: 'dev' },
  ],
  [
    'dev-holding.yaweloidle.com',
    { worker: 'yawelo-idle-holding-dev', environment: 'dev' },
  ],
  [
    'test.yaweloidle.com',
    { worker: 'yawelo-idle-holding-test', environment: 'test' },
  ],
]);
