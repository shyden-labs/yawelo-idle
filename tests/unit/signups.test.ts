import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerDevice,
  type NewDevice,
} from '../../apps/sync-worker/src/devices';
import {
  resetSignupsWarning,
  signupsOpen,
} from '../../apps/sync-worker/src/signups';

/**
 * The sign-up switch (#1079; global rule, Shyden 2026-11-22,
 * repo-template#207): `SIGNUPS` per environment, "open" or "closed". A new
 * device registration is refused while closed; an unset or unknown value is
 * closed and named once in the log, never silently open.
 */
afterEach(() => {
  vi.restoreAllMocks();
  resetSignupsWarning();
});

describe('signupsOpen (#1079)', () => {
  it('is open for "open"', () => {
    expect(signupsOpen('open')).toBe(true);
  });

  it.each(['closed', '', 'OPEN', ' open', 'yes', 'true'])(
    'is closed for %j',
    (value) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(signupsOpen(value)).toBe(false);
    },
  );

  it('is closed when unset', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(signupsOpen(undefined)).toBe(false);
  });

  it('names SIGNUPS in the log once when the value is neither open nor closed', () => {
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    signupsOpen(undefined);
    signupsOpen('nonsense');
    expect(logged.mock.calls).toEqual([
      ['SIGNUPS is neither "open" nor "closed": new sign-ups are closed'],
    ]);
  });

  it('logs nothing for "closed", which is a choice', () => {
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    signupsOpen('closed');
    expect(logged).not.toHaveBeenCalled();
  });
});

describe('registerDevice behind the switch (#1079)', () => {
  const post = () =>
    new Request('https://dev-api.yaweloidle.com/v1/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  const deps = (signups: string | undefined) => {
    let next = 0;
    return {
      uuid: () => `id-${String((next += 1))}`,
      now: () => 1_000,
      signups,
    };
  };

  it('refuses a new device while sign-ups are closed, saving nothing', async () => {
    const saved: NewDevice[] = [];
    const response = await registerDevice(
      post(),
      (device) => {
        saved.push(device);
        return Promise.resolve();
      },
      deps('closed'),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'signups_closed' });
    expect(saved).toEqual([]);
  });

  it('registers a new device while sign-ups are open', async () => {
    const saved: NewDevice[] = [];
    const response = await registerDevice(
      post(),
      (device) => {
        saved.push(device);
        return Promise.resolve();
      },
      deps('open'),
    );
    expect(response.status).toBe(201);
    expect(saved).toHaveLength(1);
  });

  it('still answers a wrong method with 405 while closed', async () => {
    const response = await registerDevice(
      new Request('https://dev-api.yaweloidle.com/v1/devices'),
      () => Promise.resolve(),
      deps('closed'),
    );
    expect(response.status).toBe(405);
  });
});
