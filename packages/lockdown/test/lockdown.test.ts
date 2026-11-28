import { describe, expect, it } from 'vitest';
import {
  BLOCKING_ROBOTS_TXT,
  NO_INDEX,
  PROD_API_HOSTNAME,
  PROD_HOSTNAME,
  isProdHost,
  markApiRequest,
  markWebRequest,
  type Serve,
} from '../src/index';

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

function request(
  url: string,
  authorization?: string,
  cookie?: string,
): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set('authorization', authorization);
  if (cookie !== undefined) headers.set('cookie', cookie);
  return new Request(url, { headers });
}

describe('isProdHost', () => {
  it('matches the production hostnames exactly', () => {
    expect(PROD_HOSTNAME).toBe('yaweloidle.com');
    expect(PROD_API_HOSTNAME).toBe('api.yaweloidle.com');
    expect(isProdHost('yaweloidle.com', PROD_HOSTNAME)).toBe(true);
    expect(isProdHost('api.yaweloidle.com', PROD_API_HOSTNAME)).toBe(true);
  });

  it('ignores case, as DNS does', () => {
    expect(isProdHost('YaweloIdle.COM', PROD_HOSTNAME)).toBe(true);
  });

  it.each([
    'dev.yaweloidle.com',
    'test.yaweloidle.com',
    'www.yaweloidle.com',
    'yawelo-idle-web-dev.yawelo-idle-non-prod.workers.dev',
    'yaweloidle.com.evil.com',
    'evilyaweloidle.com',
    'yaweloidle.co',
    'api.yaweloidle.com',
    '',
  ])('refuses the near-miss %j', (hostname) => {
    expect(isProdHost(hostname, PROD_HOSTNAME)).toBe(false);
  });
});

describe('markApiRequest', () => {
  it('adds noindex to every response on a non-prod host, with no password', async () => {
    const { serve, calls } = recordingServe();
    const response = await markApiRequest(
      request(
        'https://yawelo-idle-sync-dev.yawelo-idle-non-prod.workers.dev/health',
      ),
      serve,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(calls).toHaveLength(1);
  });

  it('serves blocking robots.txt on a non-prod host', async () => {
    const { serve, calls } = recordingServe();
    const sync =
      'https://yawelo-idle-sync-dev.yawelo-idle-non-prod.workers.dev';
    const response = await markApiRequest(request(`${sync}/robots.txt`), serve);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
    // The working run: off robots.txt the same host hands the request on.
    const working = recordingServe();
    await markApiRequest(request(`${sync}/health`), working.serve);
    expect(calls).toEqual([]);
  });

  it.each(['/health', '/robots.txt'])(
    'leaves the production API host untouched at %s',
    async (path) => {
      const { serve, calls } = recordingServe();
      const response = await markApiRequest(
        request(`https://api.yaweloidle.com${path}`),
        serve,
      );
      expect(response.headers.get('X-Robots-Tag')).toBeNull();
      expect(calls).toHaveLength(1);
    },
  );
});

/**
 * The site Worker's marking once the door is its gate (#1078 AC3): no
 * password, the origin refusing any request its door did not send.
 */
describe('markWebRequest (#1078)', () => {
  const site = 'https://yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev';

  it('serves a non-prod page with no credentials, noindex added', async () => {
    const { serve, calls } = recordingServe();
    const response = await markWebRequest(request(`${site}/`), serve);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(response.headers.get('WWW-Authenticate')).toBeNull();
    expect(calls).toEqual([`${site}/`]);
  });

  it('serves blocking robots.txt on a non-prod host, serving nothing', async () => {
    const { serve, calls } = recordingServe();
    const response = await markWebRequest(request(`${site}/robots.txt`), serve);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
    expect(calls).toEqual([]);
  });

  it.each(['/', '/robots.txt'])(
    'leaves the production host untouched at %s',
    async (path) => {
      const { serve, calls } = recordingServe();
      const response = await markWebRequest(
        request(`https://yaweloidle.com${path}`),
        serve,
      );
      expect(response.headers.get('X-Robots-Tag')).toBeNull();
      expect(calls).toHaveLength(1);
    },
  );
});
