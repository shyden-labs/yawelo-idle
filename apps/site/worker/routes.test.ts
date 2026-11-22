import { describe, expect, it } from 'vitest';
import {
  DOOR_HOST_HEADER,
  DOOR_SECRET_HEADER,
  DOORS,
} from '../../door/worker/door';
import type { Equal } from '../../door/worker/origin';
import {
  doorTo as siteDoorTo,
  HOLDING_DOOR,
  pagesFor,
  servePages,
  isPrivatePath,
  PRIVATE_PATHS,
  servesPrivate,
  showsHolding,
  UNREADABLE,
} from './routes';

/**
 * A host name alone never shows the holding page (#1013): the dev front door
 * is dev.yaweloidle.com's door, and only a believed door does.
 */
describe('pagesFor by host name (#673, #1013)', () => {
  const sameBytes: Equal = () => true;
  it.each([
    'dev.yaweloidle.com',
    'yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev',
    'dev-api.yaweloidle.com',
  ])('gives the site being built on %s with no door', async (hostname) => {
    expect(
      await pagesFor(new Request(`https://${hostname}/`), 'secret', sameBytes),
    ).toBe('site');
  });
});

/**
 * Behind its door (#784), the dev site Worker is reached at its workers.dev
 * address, so the holding page follows the door the request came through,
 * named only once its door secret is believed (apps/door/worker/origin.ts).
 */
describe('showsHolding behind the doors (#784)', () => {
  const doorTo = (worker: string): string => {
    const found = [...DOORS].find(([, door]) => door.worker === worker);
    if (found === undefined) throw new Error(`no door for ${worker}`);
    return found[0];
  };

  it('is the dev site Worker’s door', () => {
    expect(HOLDING_DOOR).toBe(doorTo('yawelo-idle-site-dev'));
  });

  it('shows the holding page through the dev site’s door', () => {
    expect(showsHolding(HOLDING_DOOR)).toBe(true);
  });

  it('shows the site through the TEST holding page’s door (#1021)', () => {
    expect(showsHolding(doorTo('yawelo-idle-holding-test'))).toBe(false);
  });

  it('shows the site through the dev API’s door', () => {
    expect(showsHolding(doorTo('yawelo-idle-sync-dev'))).toBe(false);
  });

  it('shows the site at the workers.dev address with no door believed', () => {
    expect(showsHolding(undefined)).toBe(false);
  });
});

describe('servesPrivate (#846, #589)', () => {
  it('keeps the health report and private docs off the production host', () => {
    expect(servesPrivate('yaweloidle.com')).toBe(false);
  });

  it('keeps it off the production host in any case', () => {
    expect(servesPrivate('YAWELOIDLE.com')).toBe(false);
  });

  it('serves it on dev, behind the password', () => {
    expect(
      servesPrivate('yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev'),
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

/**
 * Which pages a request gets (#673, #784): the holding page on the dev front
 * door's host, or through the dev site's door with the door secret; else the
 * site being built. The comparison is stood in by a byte comparison.
 */
describe('pagesFor (#784)', () => {
  const SECRET = 'door-secret';
  const ORIGIN = 'https://yawelo-idle-site-dev.origins.example.workers.dev/';
  const sameBytes: Equal = (a, b) => {
    const left = new Uint8Array(a);
    const right = new Uint8Array(b);
    return (
      left.length === right.length && left.every((byte, i) => byte === right[i])
    );
  };
  const throughDoor = (secret: string) =>
    new Request(ORIGIN, {
      headers: {
        [DOOR_SECRET_HEADER]: secret,
        [DOOR_HOST_HEADER]: HOLDING_DOOR,
      },
    });

  it('gives the holding page through the dev site’s door with its secret', async () => {
    expect(await pagesFor(throughDoor(SECRET), SECRET, sameBytes)).toBe(
      'holding',
    );
  });

  it('gives the site being built through the door with a wrong secret', async () => {
    expect(await pagesFor(throughDoor('not-it'), SECRET, sameBytes)).toBe(
      'site',
    );
  });

  it('gives the site being built while the Worker has no door secret', async () => {
    expect(await pagesFor(throughDoor(SECRET), undefined, sameBytes)).toBe(
      'site',
    );
  });
});

/**
 * The Worker's pages (#784): the chosen pages' binding answers, given the
 * request untouched. The bindings are stood in by fetchers that name
 * themselves and record what they were handed.
 */
describe('servePages (#784)', () => {
  const SECRET = 'door-secret';
  const sameBytes: Equal = (a, b) => {
    const left = new Uint8Array(a);
    const right = new Uint8Array(b);
    return (
      left.length === right.length && left.every((byte, i) => byte === right[i])
    );
  };
  const named = (name: string, seen: Request[]) => ({
    fetch: (request: Request): Promise<Response> => {
      seen.push(request);
      return Promise.resolve(new Response(name));
    },
  });

  it('answers from the holding binding through the dev site’s door', async () => {
    const seen: Request[] = [];
    const request = new Request(
      'https://yawelo-idle-site-dev.origins.example.workers.dev/',
      {
        headers: {
          [DOOR_SECRET_HEADER]: SECRET,
          [DOOR_HOST_HEADER]: HOLDING_DOOR,
        },
      },
    );
    const response = await servePages(
      request,
      SECRET,
      sameBytes,
      named('holding', seen),
      named('site', seen),
    );
    expect(await response.text()).toBe('holding');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(request);
  });

  it('answers from the site binding elsewhere', async () => {
    const seen: Request[] = [];
    const request = new Request(
      'https://yawelo-idle-site-dev.origins.example.workers.dev/',
    );
    const response = await servePages(
      request,
      SECRET,
      sameBytes,
      named('holding', seen),
      named('site', seen),
    );
    expect(await response.text()).toBe('site');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(request);
  });
});

/** Every door the site names must exist (#784): a missing one fails loudly. */
describe('doorTo (#784)', () => {
  it('names the door that reaches a Worker', () => {
    expect(siteDoorTo('yawelo-idle-site-dev')).toBe(HOLDING_DOOR);
  });

  it('refuses a Worker no door reaches, naming it', () => {
    expect(() => siteDoorTo('yawelo-idle-nobody')).toThrow(
      'no door reaches yawelo-idle-nobody',
    );
  });
});

/**
 * The support pages and the full site's own files go through the holding
 * door to the site being built (Shyden, 2026-11-22, #860): ShyDesk allows its
 * piece on dev.yaweloidle.com, which shows the holding page.
 */
describe('servePages lets the support pages through the door (#860)', () => {
  const SECRET = 'door-secret';
  const sameBytes: Equal = (a, b) => {
    const left = new Uint8Array(a);
    const right = new Uint8Array(b);
    return (
      left.length === right.length && left.every((byte, i) => byte === right[i])
    );
  };
  const named = (name: string) => ({
    fetch: (): Promise<Response> => Promise.resolve(new Response(name)),
  });
  const throughDoor = (path: string) =>
    new Request(
      `https://yawelo-idle-site-dev.origins.example.workers.dev${path}`,
      {
        headers: {
          [DOOR_SECRET_HEADER]: SECRET,
          [DOOR_HOST_HEADER]: HOLDING_DOOR,
        },
      },
    );
  const answer = async (path: string) =>
    (
      await servePages(
        throughDoor(path),
        SECRET,
        sameBytes,
        named('holding'),
        named('site'),
      )
    ).text();

  it.each([
    '/support',
    '/support/ticket',
    '/id/support',
    '/id/support/ticket',
    '/_site/Base.abc123.css',
  ])('answers %s from the site through the dev site’s door', async (path) => {
    expect(await answer(path)).toBe('site');
  });

  it.each([
    '/',
    '/id/',
    '/roadmap',
    '/support-api/embed.js',
    '/_astro/Holding.abc.css',
  ])('keeps %s on the holding page through the door', async (path) => {
    expect(await answer(path)).toBe('holding');
  });
});
