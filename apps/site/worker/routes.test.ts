import { describe, expect, it } from 'vitest';
import { DOORS } from '../../door/worker/door';
import {
  HOLDING_DOOR,
  HOLDING_HOST,
  isPrivatePath,
  PRIVATE_PATHS,
  servesPrivate,
  showsHolding,
  UNREADABLE,
} from './routes';

/**
 * Which pages a host shows (#673): the dev front door shows the holding page
 * production shows, and the site Worker's own address keeps the site being
 * built. Names are judged exactly, never by prefix or suffix.
 */
describe('showsHolding (#673)', () => {
  it('names the dev front door', () => {
    expect(HOLDING_HOST).toBe('dev.yawelo-idle.shyden.co.uk');
  });

  it('shows the holding page on the dev front door', () => {
    expect(showsHolding('dev.yawelo-idle.shyden.co.uk', undefined)).toBe(true);
  });

  it('shows the site on the site Worker’s own workers.dev address', () => {
    expect(
      showsHolding(
        'yawelo-idle-site-dev.shyden-labs-dev.workers.dev',
        undefined,
      ),
    ).toBe(false);
  });

  it('shows the site on the dev API host', () => {
    expect(showsHolding('dev-api.yawelo-idle.shyden.co.uk', undefined)).toBe(
      false,
    );
  });

  it('shows the site on a host that only starts with the front door', () => {
    expect(
      showsHolding('dev.yawelo-idle.shyden.co.uk.evil.example', undefined),
    ).toBe(false);
  });

  it('shows the site on a host that only ends with the front door', () => {
    expect(showsHolding('evil-dev.yawelo-idle.shyden.co.uk', undefined)).toBe(
      false,
    );
  });
});

/**
 * Behind its door (#784), the dev site Worker is reached at its workers.dev
 * address, so the holding page follows the door the request came through,
 * named only once its door secret is believed (apps/door/worker/origin.ts).
 */
describe('showsHolding behind the doors (#784)', () => {
  const ORIGIN = 'yawelo-idle-site-dev.origins.example.workers.dev';
  const doorTo = (worker: string): string => {
    const found = [...DOORS].find(([, door]) => door.worker === worker);
    if (found === undefined) throw new Error(`no door for ${worker}`);
    return found[0];
  };

  it('is the dev site Worker’s door', () => {
    expect(HOLDING_DOOR).toBe(doorTo('yawelo-idle-site-dev'));
  });

  it('shows the holding page through the dev site’s door', () => {
    expect(showsHolding(ORIGIN, HOLDING_DOOR)).toBe(true);
  });

  it('shows the site through the test site’s door', () => {
    expect(showsHolding(ORIGIN, doorTo('yawelo-idle-site-test'))).toBe(false);
  });

  it('shows the site through the dev API’s door', () => {
    expect(showsHolding(ORIGIN, doorTo('yawelo-idle-sync-dev'))).toBe(false);
  });

  it('shows the site at the workers.dev address with no door believed', () => {
    expect(showsHolding(ORIGIN, undefined)).toBe(false);
  });
});

describe('servesPrivate (#846, #589)', () => {
  it('keeps the health report and private docs off the production host', () => {
    expect(servesPrivate('yawelo-idle.shyden.co.uk')).toBe(false);
  });

  it('keeps it off the production host in any case', () => {
    expect(servesPrivate('YAWELO-IDLE.shyden.co.uk')).toBe(false);
  });

  it('serves it on dev, behind the password', () => {
    expect(
      servesPrivate('yawelo-idle-site-dev.shyden-labs-dev.workers.dev'),
    ).toBe(true);
  });
});

describe('isPrivatePath (#589)', () => {
  it('names the private docs page', () => {
    expect(isPrivatePath(PRIVATE_PATHS.docs)).toBe(true);
  });

  it('names the private spec', () => {
    expect(isPrivatePath(PRIVATE_PATHS.spec)).toBe(true);
  });

  it('names any other path under /api/private/', () => {
    expect(isPrivatePath('/api/private/anything.html')).toBe(true);
  });

  it('names /api/private itself', () => {
    expect(isPrivatePath('/api/private')).toBe(true);
  });

  it('names a percent-encoded spelling of the path', () => {
    expect(isPrivatePath('/api/%70rivate/docs')).toBe(true);
  });

  it('names an encoded slash inside the path', () => {
    expect(isPrivatePath('/api/private%2Fdocs')).toBe(true);
  });

  it('names the path in any case', () => {
    expect(isPrivatePath('/API/Private/docs')).toBe(true);
  });

  it('names the path behind doubled slashes', () => {
    expect(isPrivatePath('//api//private/docs')).toBe(true);
  });

  it('names a path whose encoding is broken, refusing it rather than guessing', () => {
    expect(isPrivatePath('/api/private%E0%A4%A')).toBe(true);
  });

  it('names an encoded path whose encoding is broken elsewhere', () => {
    expect(isPrivatePath('/api/%70rivate/%')).toBe(true);
  });

  it('leaves the public docs page alone', () => {
    expect(isPrivatePath('/api/docs')).toBe(false);
  });

  it('leaves a path that only starts with the same letters alone', () => {
    expect(isPrivatePath('/api/privateer')).toBe(false);
  });
});

describe('UNREADABLE (#846)', () => {
  it('is a fixed plain sentence, naming nothing internal', () => {
    expect(UNREADABLE).toBe('The roadmap could not be read just now.');
  });
});
