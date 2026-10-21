import { describe, expect, it } from 'vitest';
import { floorBreach } from '../../../tests/floors';
import { searched } from '../../../tests/searched';
import {
  BLOCKING_ROBOTS_TXT,
  NO_INDEX,
  PROD_API_HOSTNAME,
  PROD_HOSTNAME,
  basicAuthOk,
  gateWebRequest,
  isProdHost,
  markApiRequest,
  type Serve,
} from '../src/index';

const PASSWORD = 'correct horse';

/** `Basic <base64 of user:password>`, encoding the text as UTF-8 first. */
function basic(credentials: string): string {
  const bytes = new TextEncoder().encode(credentials);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

/** A `serve` that records each call and answers with a recognisable body. */
function recordingServe(): { serve: Serve; calls: string[] } {
  const calls: string[] = [];
  const serve: Serve = (request) => {
    calls.push(request.url);
    return Promise.resolve(
      new Response('<!doctype html><title>app bytes</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html', ETag: '"v1"' },
      }),
    );
  };
  return { serve, calls };
}

function request(url: string, authorization?: string): Request {
  return new Request(
    url,
    authorization === undefined ? {} : { headers: { authorization } },
  );
}

describe('isProdHost', () => {
  it('matches the production hostnames exactly', () => {
    expect(PROD_HOSTNAME).toBe('yawelo-idle.shyden.co.uk');
    expect(PROD_API_HOSTNAME).toBe('api.yawelo-idle.shyden.co.uk');
    expect(isProdHost('yawelo-idle.shyden.co.uk', PROD_HOSTNAME)).toBe(true);
    expect(isProdHost('api.yawelo-idle.shyden.co.uk', PROD_API_HOSTNAME)).toBe(
      true,
    );
  });

  it('ignores case, as DNS does', () => {
    expect(isProdHost('Yawelo-Idle.Shyden.CO.UK', PROD_HOSTNAME)).toBe(true);
  });

  it.each([
    'dev.yawelo-idle.shyden.co.uk',
    'yawelo-idle-web-dev.shyden-labs-dev.workers.dev',
    'yawelo-idle.shyden.co.uk.evil.com',
    'evilyawelo-idle.shyden.co.uk',
    'yawelo-idle.shyden.co',
    'api.yawelo-idle.shyden.co.uk',
    '',
  ])('refuses the near-miss %j', (hostname) => {
    expect(isProdHost(hostname, PROD_HOSTNAME)).toBe(false);
  });
});

describe('basicAuthOk', () => {
  it('accepts the right password with any username', async () => {
    expect(await basicAuthOk(basic(`tester:${PASSWORD}`), PASSWORD)).toBe(true);
    expect(await basicAuthOk(basic(`:${PASSWORD}`), PASSWORD)).toBe(true);
  });

  it('matches the Basic scheme case-insensitively (RFC 7617)', async () => {
    const token = basic(`u:${PASSWORD}`).slice('Basic '.length);
    expect(await basicAuthOk(`basic ${token}`, PASSWORD)).toBe(true);
    expect(await basicAuthOk(`BASIC ${token}`, PASSWORD)).toBe(true);
  });

  it('compares a password containing a colon intact', async () => {
    expect(await basicAuthOk(basic('u:a:b:c'), 'a:b:c')).toBe(true);
    expect(await basicAuthOk(basic('u:a:b:c'), 'b:c')).toBe(false);
  });

  it('decodes the credentials as UTF-8', async () => {
    expect(await basicAuthOk(basic('u:pässwörd ✓'), 'pässwörd ✓')).toBe(true);
  });

  it.each([
    ['a wrong password', basic('u:wrong')],
    ['the password with a trailing space', basic(`u:${PASSWORD} `)],
    ['a prefix of the password', basic(`u:${PASSWORD.slice(0, -1)}`)],
    ['the password as the username', basic(`${PASSWORD}:`)],
    ['no colon', basic(PASSWORD)],
    ['a non-Basic scheme', `Bearer ${basic(`u:${PASSWORD}`).slice(6)}`],
    ['a scheme with no token', 'Basic'],
    ['an empty token', 'Basic '],
    ['a whitespace token', 'Basic    '],
    ['invalid base64', 'Basic !!!not-base64!!!'],
    ['base64 of invalid UTF-8', `Basic ${btoa('u:\xff\xfe')}`],
  ])('rejects %s', async (_case, header) => {
    expect(await basicAuthOk(header, PASSWORD)).toBe(false);
  });

  it('rejects a missing header', async () => {
    expect(await basicAuthOk(null, PASSWORD)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['undefined', undefined],
  ])(
    'fails closed when the expected password is %s',
    async (_case, expected) => {
      expect(await basicAuthOk(basic('u:'), expected)).toBe(false);
      expect(await basicAuthOk(basic('u:anything'), expected)).toBe(false);
    },
  );
});

describe('gateWebRequest', () => {
  const dev = 'https://yawelo-idle-web-dev.shyden-labs-dev.workers.dev';

  /**
   * What the gate hands on for `url` with the right password: the working
   * run each "never serves" check is read against, so a recorder or a gate
   * that hands nothing on cannot pass it (#375, Shyden 2026-10-21).
   */
  async function handedOn(url: string): Promise<readonly string[]> {
    const working = recordingServe();
    await gateWebRequest(
      request(url, basic(`tester:${PASSWORD}`)),
      PASSWORD,
      working.serve,
    );
    return working.calls;
  }

  it('serves the production host untouched, without asking for a password', async () => {
    const { serve, calls } = recordingServe();
    const response = await gateWebRequest(
      request('https://YAWELO-IDLE.shyden.co.uk/index.html'),
      undefined,
      serve,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBeNull();
    expect(calls).toEqual(['https://yawelo-idle.shyden.co.uk/index.html']);
  });

  it.each([
    ['no credentials', undefined],
    ['a wrong password', basic('u:wrong')],
  ])(
    'challenges %s on a non-prod host and never serves',
    async (name, authorization) => {
      const { serve, calls } = recordingServe();
      const url = `${dev}/`;
      const response = await gateWebRequest(
        request(url, authorization),
        PASSWORD,
        serve,
      );
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Basic realm="Yawelo Idle Non-Prod"',
      );
      expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
      const sentences = (await response.text()).split('. ');
      expect(
        searched(
          sentences.filter((s) => s.includes('app bytes')),
          { of: sentences, what: 'sentences of the challenge' },
        ),
      ).toEqual([]);
      const handed = await handedOn(url);
      expect(
        searched(calls, { of: handed, what: 'hand-overs with the password' }),
      ).toEqual([]);
      expect(
        floorBreach(
          `lockdown/challenge sentences for ${name}`,
          sentences.length,
        ),
      ).toBeUndefined();
      expect(
        floorBreach(
          `lockdown/hand-overs with the password, for ${name}`,
          handed.length,
        ),
      ).toBeUndefined();
    },
  );

  it('challenges every request when the password is not configured', async () => {
    const { serve, calls } = recordingServe();
    const url = `${dev}/`;
    const response = await gateWebRequest(
      request(url, basic('u:')),
      undefined,
      serve,
    );
    expect(response.status).toBe(401);
    const handed = await handedOn(url);
    expect(
      searched(calls, { of: handed, what: 'hand-overs once one is set' }),
    ).toEqual([]);
    expect(
      floorBreach('lockdown/hand-overs once a password is set', handed.length),
    ).toBeUndefined();
  });

  it('serves blocking robots.txt on a non-prod host without credentials', async () => {
    const { serve, calls } = recordingServe();
    const response = await gateWebRequest(
      request(`${dev}/robots.txt`),
      PASSWORD,
      serve,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
    expect(BLOCKING_ROBOTS_TXT).toContain('User-agent: *\nDisallow: /\n');
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    const handed = await handedOn(`${dev}/`);
    expect(
      searched(calls, { of: handed, what: 'hand-overs off robots.txt' }),
    ).toEqual([]);
    expect(
      floorBreach(
        'lockdown/hand-overs off robots.txt on the web host',
        handed.length,
      ),
    ).toBeUndefined();
  });

  it('serves an authorised request with noindex added and the rest kept', async () => {
    const { serve, calls } = recordingServe();
    const response = await gateWebRequest(
      request(`${dev}/assets/app.js`, basic(`tester:${PASSWORD}`)),
      PASSWORD,
      serve,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(response.headers.get('ETag')).toBe('"v1"');
    expect(await response.text()).toContain('app bytes');
    expect(calls).toEqual([`${dev}/assets/app.js`]);
  });
});

describe('markApiRequest', () => {
  it('adds noindex to every response on a non-prod host, with no password', async () => {
    const { serve, calls } = recordingServe();
    const response = await markApiRequest(
      request(
        'https://yawelo-idle-sync-dev.shyden-labs-dev.workers.dev/health',
      ),
      serve,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(calls).toHaveLength(1);
  });

  it('serves blocking robots.txt on a non-prod host', async () => {
    const { serve, calls } = recordingServe();
    const sync = 'https://yawelo-idle-sync-dev.shyden-labs-dev.workers.dev';
    const response = await markApiRequest(request(`${sync}/robots.txt`), serve);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
    // The working run: off robots.txt the same host hands the request on.
    const working = recordingServe();
    await markApiRequest(request(`${sync}/health`), working.serve);
    expect(
      searched(calls, {
        of: working.calls,
        what: 'hand-overs off robots.txt',
      }),
    ).toEqual([]);
    expect(
      floorBreach(
        'lockdown/hand-overs off robots.txt on the sync host',
        working.calls.length,
      ),
    ).toBeUndefined();
  });

  it.each(['/health', '/robots.txt'])(
    'leaves the production API host untouched at %s',
    async (path) => {
      const { serve, calls } = recordingServe();
      const response = await markApiRequest(
        request(`https://api.yawelo-idle.shyden.co.uk${path}`),
        serve,
      );
      expect(response.headers.get('X-Robots-Tag')).toBeNull();
      expect(calls).toHaveLength(1);
    },
  );
});
