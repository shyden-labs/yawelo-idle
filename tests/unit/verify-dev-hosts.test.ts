import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ADAPTER_OWN,
  API_HOST,
  SITE_HOST,
  verifyDevHosts,
  type Fetch,
} from '../../scripts/verify-dev-hosts';

/**
 * scripts/verify-dev-hosts.ts (#816) judged against a stand-in of the dev
 * hosts, so each way the real ones could go wrong is seen to be named. The
 * stand-in checks the webhook signature over the body it receives, as the
 * site Worker does, so a script that signed wrongly would fail too.
 */

const INPUTS = { password: 'pw', webhookSecret: 'secret' };

interface Answer {
  readonly status: number;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

type Override = Partial<Record<'play' | 'post' | 'hook' | 'own', Answer>>;

function hosts(override: Override = {}): Fetch {
  return (url, init) => {
    const answer = (fallback: Answer, key: keyof Override): Response => {
      const a = override[key] ?? fallback;
      return new Response(a.status === 204 ? null : (a.body ?? ''), {
        status: a.status,
        headers: a.headers,
      });
    };
    if (url === `${SITE_HOST}/play?q=1`) {
      const authorised =
        new Headers(init.headers).get('Authorization') ===
        `Basic ${btoa('tester:pw')}`;
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
        answer({ status: 405, headers: { Allow: 'GET' } }, 'post'),
      );
    if (url === `${SITE_HOST}/hooks/github`) {
      const body = typeof init.body === 'string' ? init.body : '';
      const expected = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
      const signed =
        new Headers(init.headers).get('X-Hub-Signature-256') === expected;
      return Promise.resolve(answer({ status: signed ? 204 : 401 }, 'hook'));
    }
    if (url === `${ADAPTER_OWN}/`)
      return Promise.resolve(answer({ status: 404, body: 'not found' }, 'own'));
    return Promise.reject(new Error(`unexpected request: ${url}`));
  };
}

describe('verifyDevHosts (#816)', () => {
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

  it('names a wrong login, which the site answers 401', async () => {
    const problems = await verifyDevHosts(hosts(), {
      ...INPUTS,
      password: 'no',
    });
    expect(problems).toEqual([
      `${SITE_HOST}/play?q=1: expected the game's 307 to /play/?q=1, got 401 to null`,
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

  it('names the adapter’s own address reaching a Worker', async () => {
    const problems = await verifyDevHosts(
      hosts({ own: { status: 200, body: 'a page' } }),
      INPUTS,
    );
    expect(problems).toEqual([
      `${ADAPTER_OWN}/: expected the adapter's 404 "not found", got 200`,
    ]);
  });

  it('names a 404 that is not the adapter’s own', async () => {
    const problems = await verifyDevHosts(
      hosts({ own: { status: 404, body: 'Cloudflare: no such project' } }),
      INPUTS,
    );
    expect(problems).toEqual([
      `${ADAPTER_OWN}/: expected the adapter's 404 "not found", got 404`,
    ]);
  });
});
