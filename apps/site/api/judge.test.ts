import { describe, expect, it } from 'vitest';
import { differences, judged, judgeFor, privateJudge } from './judge';

/**
 * The spec judge itself (#588, #589), so a contract test's pass means the
 * answer matched, never that nothing was compared. Pure: no Worker, no
 * network; the contract tests that call the real Worker are in the
 * harness suite (apps/site/test/roadmap).
 */
const SNAPSHOT = '/api/roadmap.json';
const HEALTH = '/api/roadmap/health';
const HOOK = '/hooks/github';
const UNREADABLE = { error: 'The roadmap could not be read just now.' };
const JSON_NO_STORE = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

/** A health report as the Worker serves it after one good read. */
const HEALTH_BODY = {
  lastEventAt: null,
  lastCheckAt: '2026-11-05T01:00:00.000Z',
  version: 1,
  drift: 0,
  driftTotal: 0,
  lastDriftAt: null,
  pendingDriftSince: null,
  staleReads: 0,
  lastStaleReadAt: null,
  unseenEvents: 0,
  readFailingSince: null,
  readError: null,
  dropped: { draft: 0, pullRequest: 0, anotherRepository: 0 },
};

describe('the roadmap judge', () => {
  it('passes an answer that matches the spec', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 503,
        headers: new Headers(JSON_NO_STORE),
        body: UNREADABLE,
      }),
    ).toEqual([]);
  });

  it('names a field the spec does not list', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 503,
        headers: new Headers(JSON_NO_STORE),
        body: { ...UNREADABLE, extra: 1 },
      }),
    ).toEqual(['body must NOT have additional properties']);
  });

  it('names a status the spec does not document', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 500,
        headers: new Headers(),
        body: null,
      }),
    ).toEqual([
      'GET /api/roadmap.json answered 500, which the spec does not document',
    ]);
  });

  it('names a path the spec does not document', () => {
    expect(
      differences('/nowhere', 'get', {
        status: 200,
        headers: new Headers(),
        body: null,
      }),
    ).toEqual(['GET /nowhere answered 200, which the spec does not document']);
  });

  it('names a missing header', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 503,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: UNREADABLE,
      }),
    ).toEqual(['header Cache-Control is missing']);
  });

  it('names a header whose value the spec refuses', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 503,
        headers: new Headers({
          ...JSON_NO_STORE,
          'Cache-Control': 'max-age=60',
        }),
        body: UNREADABLE,
      }),
    ).toEqual(['header Cache-Control must be equal to constant']);
  });

  it('names a body type the spec does not document', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 503,
        headers: new Headers({
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store',
        }),
        body: '<p>',
      }),
    ).toEqual(['Content-Type text/html is not one of application/json']);
  });

  it('names an answer with no Content-Type where the spec documents one', () => {
    expect(
      differences(SNAPSHOT, 'get', {
        status: 503,
        headers: new Headers({ 'Cache-Control': 'no-store' }),
        body: '',
      }),
    ).toEqual(['Content-Type (none) is not one of application/json']);
  });

  it('reads a JSON answer and judges its parsed body', async () => {
    const response = new Response(JSON.stringify(UNREADABLE), {
      status: 503,
      headers: JSON_NO_STORE,
    });
    expect(await judged(SNAPSHOT, 'get', response)).toEqual([]);
  });

  it('reads a text answer and judges it as text', async () => {
    const response = new Response('<p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
    });
    expect(await judged(SNAPSHOT, 'get', response)).toEqual([
      'Content-Type text/html is not one of application/json',
    ]);
  });
});

describe('the private judge (#589)', () => {
  it('passes a health report that matches the spec', () => {
    expect(
      privateJudge.differences(HEALTH, 'get', {
        status: 200,
        headers: new Headers(JSON_NO_STORE),
        body: HEALTH_BODY,
      }),
    ).toEqual([]);
  });

  it('names a health field the spec does not list', () => {
    expect(
      privateJudge.differences(HEALTH, 'get', {
        status: 200,
        headers: new Headers(JSON_NO_STORE),
        body: { ...HEALTH_BODY, extra: 1 },
      }),
    ).toEqual(['body must NOT have additional properties']);
  });

  it('names a health field that is missing', () => {
    const withoutError: Partial<typeof HEALTH_BODY> = { ...HEALTH_BODY };
    delete withoutError.readError;
    expect(
      privateJudge.differences(HEALTH, 'get', {
        status: 200,
        headers: new Headers(JSON_NO_STORE),
        body: withoutError,
      }),
    ).toEqual(["body must have required property 'readError'"]);
  });

  it('names a time that is not an RFC 3339 date-time', () => {
    expect(
      privateJudge.differences(HEALTH, 'get', {
        status: 200,
        headers: new Headers(JSON_NO_STORE),
        body: { ...HEALTH_BODY, lastCheckAt: 'yesterday' },
      }),
    ).toEqual(['body/lastCheckAt must match format "date-time"']);
  });

  it('passes a webhook answer with no body', () => {
    expect(
      privateJudge.differences(HOOK, 'post', {
        status: 202,
        headers: new Headers(),
        body: null,
      }),
    ).toEqual([]);
  });

  it('names a webhook body the spec does not document', () => {
    expect(
      privateJudge.differences(HOOK, 'post', {
        status: 202,
        headers: new Headers(),
        body: 'queued',
      }),
    ).toEqual(['the spec documents no body, but one was sent']);
  });

  it('judges against its own spec, never the roadmap’s', () => {
    expect(
      privateJudge.differences(SNAPSHOT, 'get', {
        status: 200,
        headers: new Headers(),
        body: null,
      }),
    ).toEqual([
      'GET /api/roadmap.json answered 200, which the spec does not document',
    ]);
  });
});

describe('judgeFor', () => {
  it('names a reference the spec cannot resolve', () => {
    const judge = judgeFor({
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Missing' },
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(
      judge.differences('/x', 'get', {
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: {},
      }),
    ).toEqual(['body: no schema at #/components/schemas/Missing']);
  });
});
