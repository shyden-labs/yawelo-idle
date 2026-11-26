import { describe, expect, it } from 'vitest';
import { standInFor } from '../../scripts/door-stand-in.ts';
import {
  DOOR_HOST_HEADER,
  DOOR_SECRET_HEADER,
} from '../../apps/door/worker/door';

/**
 * CI reaches the dev origins at their workers.dev addresses, never through a
 * door (#1078 AC3, #784 AC1b), so it sends what the door would: the door
 * secret, and the name of the door the origin serves. The name comes from the
 * door map, never written out.
 */
describe('standInFor (#1078)', () => {
  it('names the site Worker’s door and carries the secret', () => {
    expect(standInFor('yawelo-idle-site-dev', 's3cret')).toStrictEqual({
      [DOOR_SECRET_HEADER]: 's3cret',
      [DOOR_HOST_HEADER]: 'dev.yaweloidle.com',
    });
  });

  it('names the sync Worker’s door', () => {
    expect(standInFor('yawelo-idle-sync-dev', 's3cret')).toStrictEqual({
      [DOOR_SECRET_HEADER]: 's3cret',
      [DOOR_HOST_HEADER]: 'dev-api.yaweloidle.com',
    });
  });

  it('refuses a Worker no door reaches', () => {
    expect(() => standInFor('yawelo-idle-web-dev', 's3cret')).toThrow(
      'no door reaches yawelo-idle-web-dev',
    );
  });

  it('refuses a TEST door: CI stands in for DEV doors only', () => {
    expect(() => standInFor('yawelo-idle-holding-test', 's3cret')).toThrow(
      'yawelo-idle-holding-test sits behind a test door, not a dev one',
    );
  });

  it('refuses an empty secret, which no origin would believe', () => {
    expect(() => standInFor('yawelo-idle-site-dev', '')).toThrow(
      'the door secret is empty',
    );
  });
});
