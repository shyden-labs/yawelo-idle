import { describe, expect, it } from 'vitest';
import { SIGNIN_ORIGIN as DOOR_SIGNIN } from '../../apps/door/worker/dev-pass/door';
import {
  SIGNIN_ORIGIN,
  doorProblems,
  doorVerdict,
  runDoorVerify,
  verifyDoors,
  type DoorAnswer,
  type DoorAnswers,
  type DoorLook,
} from '../../scripts/verify-door';
import type { Probe } from '../../scripts/verify-dev';

/**
 * The front door's check after a production deploy (#1152): each DEV door
 * refuses a request with no pass, sends a page visit to the sign-in, and the
 * TEST door forwards with no check.
 */

const answer = (
  status: number,
  headers: Record<string, string> = {},
): Probe => ({
  status,
  headers: new Headers(headers),
  body: '',
});

const signin = (host: string): string =>
  `https://dev-signin.shyden.co.uk/pass?for=${host}&back=%2F`;

/** The answers a correctly deployed door gives. */
function healthy(): DoorAnswers {
  return {
    'dev.yaweloidle.com': {
      plain: answer(401),
      page: answer(302, { location: signin('dev.yaweloidle.com') }),
    },
    'dev-api.yaweloidle.com': {
      plain: answer(401),
      page: answer(302, { location: signin('dev-api.yaweloidle.com') }),
    },
    'dev-holding.yaweloidle.com': {
      plain: answer(401),
      page: answer(302, { location: signin('dev-holding.yaweloidle.com') }),
    },
    'test.yaweloidle.com': { plain: answer(200), page: answer(200) },
  };
}

const PAGE_HEADERS = {
  accept: 'text/html',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-dest': 'document',
};

/** A look that answers like `answers`, recording each request. */
function lookFrom(answers: DoorAnswers, seen: string[] = []): DoorLook {
  return (url, headers) => {
    const host = new URL(url).host;
    const kind = headers['sec-fetch-mode'] === 'navigate' ? 'page' : 'plain';
    seen.push(`${kind} ${url}`);
    const found = answers[host]?.[kind];
    if (found === undefined) return Promise.reject(new Error(`no ${host}`));
    return Promise.resolve(found);
  };
}

describe('the sign-in the check expects', () => {
  // The script runs under plain Node, which cannot load the Worker's
  // dev-pass/door.ts (its imports have no extension), so it holds the
  // address itself and this pins it to the door's.
  it("is the door's own sign-in origin", () => {
    expect(SIGNIN_ORIGIN).toBe(DOOR_SIGNIN);
  });
});

describe('doorProblems', () => {
  it('finds nothing wrong with a correctly deployed door', () => {
    expect(doorProblems(healthy())).toEqual([]);
  });

  it('names a DEV door that lets a request with no pass through', () => {
    const answers = healthy();
    answers['dev-api.yaweloidle.com'] = {
      ...(healthy()['dev-api.yaweloidle.com'] as DoorAnswer),
      plain: answer(200),
    };
    expect(doorProblems(answers)).toEqual([
      'dev-api.yaweloidle.com: a request with no pass got 200, expected 401',
    ]);
  });

  it('names a DEV door that does not send a page visit to the sign-in', () => {
    const answers = healthy();
    answers['dev.yaweloidle.com'] = {
      ...(healthy()['dev.yaweloidle.com'] as DoorAnswer),
      page: answer(401),
    };
    expect(doorProblems(answers)).toEqual([
      'dev.yaweloidle.com: a page visit with no pass got 401, expected 302 to ' +
        signin('dev.yaweloidle.com'),
    ]);
  });

  it('names a DEV door that sends a page visit somewhere other than its own sign-in', () => {
    const answers = healthy();
    answers['dev-holding.yaweloidle.com'] = {
      ...(healthy()['dev-holding.yaweloidle.com'] as DoorAnswer),
      page: answer(302, { location: signin('dev.yaweloidle.com') }),
    };
    expect(doorProblems(answers)).toEqual([
      `dev-holding.yaweloidle.com: a page visit with no pass went to ${signin('dev.yaweloidle.com')}, expected ${signin('dev-holding.yaweloidle.com')}`,
    ]);
  });

  it('names a TEST door that does not forward', () => {
    const answers = healthy();
    answers['test.yaweloidle.com'] = { plain: answer(401), page: answer(401) };
    expect(doorProblems(answers)).toEqual([
      'test.yaweloidle.com: got 401, expected 200 (TEST has no check)',
    ]);
  });
});

describe('verifyDoors', () => {
  it('asks every door once plainly and once as a page visit, over https at its root', async () => {
    const seen: string[] = [];
    expect(await verifyDoors(lookFrom(healthy(), seen))).toEqual([]);
    expect(seen.sort()).toEqual([
      'page https://dev-api.yaweloidle.com/',
      'page https://dev-holding.yaweloidle.com/',
      'page https://dev.yaweloidle.com/',
      'page https://test.yaweloidle.com/',
      'plain https://dev-api.yaweloidle.com/',
      'plain https://dev-holding.yaweloidle.com/',
      'plain https://dev.yaweloidle.com/',
      'plain https://test.yaweloidle.com/',
    ]);
  });

  it('sends a page visit with the headers a browser navigation carries', async () => {
    const sent: Record<string, string>[] = [];
    const look: DoorLook = (url, headers) => {
      if (headers['sec-fetch-mode'] === 'navigate') sent.push(headers);
      return lookFrom(healthy())(url, headers);
    };
    await verifyDoors(look);
    expect(sent).toEqual([
      PAGE_HEADERS,
      PAGE_HEADERS,
      PAGE_HEADERS,
      PAGE_HEADERS,
    ]);
  });

  it('names a door whose request failed outright', async () => {
    const answers = healthy();
    delete answers['test.yaweloidle.com'];
    expect(await verifyDoors(lookFrom(answers))).toEqual([
      'test.yaweloidle.com: request failed: no test.yaweloidle.com',
    ]);
  });
});

describe('doorVerdict', () => {
  it('passes with one line naming every door checked', () => {
    expect(doorVerdict([])).toEqual({
      code: 0,
      lines: [
        '✓ front door: dev.yaweloidle.com, dev-api.yaweloidle.com, dev-holding.yaweloidle.com refuse a request with no pass and send a page visit to the sign-in; test.yaweloidle.com forwards with no check',
      ],
    });
  });

  it('fails with one line per problem', () => {
    expect(doorVerdict(['a', 'b'])).toEqual({
      code: 1,
      lines: ['✗ front door: a', '✗ front door: b'],
    });
  });
});

describe('runDoorVerify', () => {
  it('prints the pass to the log and returns 0', async () => {
    const log: string[] = [];
    const error: string[] = [];
    const code = await runDoorVerify(lookFrom(healthy()), {
      log: (line) => log.push(line),
      error: (line) => error.push(line),
    });
    expect({ code, logged: log.length, errors: error }).toEqual({
      code: 0,
      logged: 1,
      errors: [],
    });
  });

  it('prints each problem to the error stream and returns 1', async () => {
    const answers = healthy();
    answers['test.yaweloidle.com'] = { plain: answer(500), page: answer(500) };
    const log: string[] = [];
    const error: string[] = [];
    const code = await runDoorVerify(lookFrom(answers), {
      log: (line) => log.push(line),
      error: (line) => error.push(line),
    });
    expect({ code, log, error }).toEqual({
      code: 1,
      log: [],
      error: [
        '✗ front door: test.yaweloidle.com: got 500, expected 200 (TEST has no check)',
      ],
    });
  });
});
