import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  API_HOST,
  inputsFrom,
  SITE_HOST,
  verifyDevHosts,
  type Fetch,
} from '../../scripts/verify-dev-hosts';

/**
 * scripts/verify-dev-hosts.ts (#816, #1013) judged against a stand-in of the
 * dev doors, so each way the real ones could go wrong is seen to be named. The
 * stand-in checks the webhook signature over the body it receives, as the
 * site Worker does, so a script that signed wrongly would fail too.
 */

const INPUTS = {
  sitePass: 'site-pass',
  apiPass: 'api-pass',
  webhookSecret: 'secret',
};

interface Answer {
  readonly status: number;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

type Override = Partial<Record<'play' | 'post' | 'hook', Answer>>;

/** Each request's URL and the DEV pass it carried, '-' for none. */
let passes: string[] = [];

/**
 * The doors check a DEV pass (#1078 AC1): each answers 401 to a request
 * without its own door's pass, as the real ones do (deploy-dev run
 * 46105526525, #1155); the webhook path is an open POST at the door.
 */
function hosts(override: Override = {}): Fetch {
  passes = [];
  return (url, init) => {
    const pass = new Headers(init.headers).get('X-Dev-Pass');
    passes.push(`${url} ${pass ?? '-'}`);
    const answer = (fallback: Answer, key: keyof Override): Response => {
      const a = override[key] ?? fallback;
      return new Response(a.status === 204 ? null : (a.body ?? ''), {
        status: a.status,
        headers: a.headers,
      });
    };
    if (url === `${SITE_HOST}/play?q=1`) {
      // The door is the only gate (#1078): no password is sent at all.
      const authorised =
        pass === 'site-pass' && !new Headers(init.headers).has('Authorization');
      return Promise.resolve(
        answer(
          authorised
            ? { status: 307, headers: { Location: '/play/?q=1' } }
            : { status: 401 },
          'play',
        ),
      );
    }
    if (url === `${API_HOST}/health` && init.method === 'POST')
      return Promise.resolve(
        pass === 'api-pass'
          ? answer({ status: 405, headers: { Allow: 'GET' } }, 'post')
          : new Response(null, { status: 401 }),
      );
    if (url === `${SITE_HOST}/hooks/github`) {
      const body = typeof init.body === 'string' ? init.body : '';
      const expected = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
      const signed =
        new Headers(init.headers).get('X-Hub-Signature-256') === expected;
      return Promise.resolve(answer({ status: signed ? 204 : 401 }, 'hook'));
    }
    return Promise.reject(new Error(`unexpected request: ${url}`));
  };
}

describe('verifyDevHosts (#816)', () => {
  it('reads the dev doors on yaweloidle.com, never an old host (#1013)', () => {
    expect([SITE_HOST, API_HOST]).toEqual([
      'https://dev.yaweloidle.com',
      'https://dev-api.yaweloidle.com',
    ]);
  });

  it('finds nothing when every host answers as the real Workers do', async () => {
    expect(await verifyDevHosts(hosts(), INPUTS)).toEqual([]);
  });

  it('names a /play redirect that lost the query', async () => {
    const problems = await verifyDevHosts(
      hosts({ play: { status: 307, headers: { Location: '/play/' } } }),
      INPUTS,
    );
    expect(problems).toEqual([
      `${SITE_HOST}/play?q=1: expected the game's 307 to /play/?q=1, got 307 to /play/`,
    ]);
  });

  it('names a wrong site pass, which the door answers 401', async () => {
    const problems = await verifyDevHosts(hosts(), {
      ...INPUTS,
      sitePass: 'no',
    });
    expect(problems).toEqual([
      `${SITE_HOST}/play?q=1: expected the game's 307 to /play/?q=1, got 401 to null`,
    ]);
  });

  it('sends each door its own DEV pass, and the webhook none (#1155)', async () => {
    await verifyDevHosts(hosts(), INPUTS);
    expect(passes).toEqual([
      `${SITE_HOST}/play?q=1 site-pass`,
      `${API_HOST}/health api-pass`,
      `${SITE_HOST}/hooks/github -`,
      `${SITE_HOST}/hooks/github -`,
    ]);
  });

  it('names a site door that refuses the pass (#1155)', async () => {
    const problems = await verifyDevHosts(hosts(), {
      ...INPUTS,
      sitePass: 'stale',
    });
    expect(problems).toEqual([
      `${SITE_HOST}/play?q=1: expected the game's 307 to /play/?q=1, got 401 to null`,
    ]);
  });

  it('names an API door that refuses the pass (#1155)', async () => {
    const problems = await verifyDevHosts(hosts(), {
      ...INPUTS,
      apiPass: 'stale',
    });
    expect(problems).toEqual([
      `${API_HOST}/health POST: expected the sync Worker's 405 allowing GET, got 401 allowing null`,
    ]);
  });

  it('names a POST that arrived as another method', async () => {
    const problems = await verifyDevHosts(
      hosts({ post: { status: 200 } }),
      INPUTS,
    );
    expect(problems).toEqual([
      `${API_HOST}/health POST: expected the sync Worker's 405 allowing GET, got 200 allowing null`,
    ]);
  });

  it('names a wrong webhook secret: the signed ping is refused', async () => {
    const problems = await verifyDevHosts(hosts(), {
      ...INPUTS,
      webhookSecret: 'other',
    });
    expect(problems).toEqual([
      `${SITE_HOST}/hooks/github: a signed ping should be answered 204, got 401`,
    ]);
  });

  it('names a host that accepts any body, so a changed body would pass', async () => {
    const problems = await verifyDevHosts(
      hosts({ hook: { status: 204 } }),
      INPUTS,
    );
    expect(problems).toEqual([
      `${SITE_HOST}/hooks/github: a ping one byte longer than its signature should be refused 401, got 204`,
    ]);
  });
});

describe('inputsFrom (#1155)', () => {
  const ENV = {
    DEV_PASS_SITE: 'site-pass',
    DEV_PASS_API: 'api-pass',
    ROADMAP_WEBHOOK_SECRET: 'secret',
  };

  it('reads every input from its variable', () => {
    expect(inputsFrom(ENV)).toEqual(INPUTS);
  });

  it.each(Object.keys(ENV))('refuses a missing %s, naming it', (name) => {
    expect(() => inputsFrom({ ...ENV, [name]: undefined })).toThrow(
      `${name} is not set`,
    );
  });

  it.each(Object.keys(ENV))('refuses an empty %s, naming it', (name) => {
    expect(() => inputsFrom({ ...ENV, [name]: '' })).toThrow(
      `${name} is not set`,
    );
  });
});
