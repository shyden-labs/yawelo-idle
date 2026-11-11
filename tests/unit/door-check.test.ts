import { describe, expect, it } from 'vitest';
import {
  analyticsQuery,
  checkDoors,
  countDoors,
  ISSUE_TITLE,
  main,
  outage,
  problemsOf,
  readDoorRows,
  rowsOf,
  withPlant,
  type Row,
} from '../../scripts/door-check';
import { DOORS } from '../../apps/door/worker/door';
import type { Outage } from '../../scripts/issue-report';

/**
 * The daily door check (#784 AC6): reads each door's requests and 5xx
 * answers over the last day from Cloudflare's analytics for PROD's zone, and
 * reports any door that failed, or an unreadable answer, to Shyden on one
 * issue (global rule: nothing we rely on stops silently).
 */

const HOSTS = [...DOORS.keys()];
const [DEV, API] = HOSTS as [string, string, ...string[]];

describe('countDoors', () => {
  it('lists every door, with zeros for a door nobody used', () => {
    expect(countDoors([], HOSTS)).toEqual(
      HOSTS.map((host) => ({ host, requests: 0, errors: 0 })),
    );
  });

  it('adds every status a door answered, counting 5xx as errors', () => {
    const rows: Row[] = [
      { host: DEV, status: 200, count: 40 },
      { host: DEV, status: 404, count: 3 },
      { host: DEV, status: 502, count: 2 },
      { host: DEV, status: 500, count: 1 },
    ];
    expect(countDoors(rows, HOSTS)[0]).toEqual({
      host: DEV,
      requests: 46,
      errors: 3,
    });
  });

  it('counts 499 as no error and 599 as one', () => {
    const rows: Row[] = [
      { host: API, status: 499, count: 5 },
      { host: API, status: 599, count: 7 },
    ];
    expect(countDoors(rows, HOSTS)[1]).toEqual({
      host: API,
      requests: 12,
      errors: 7,
    });
  });

  it('ignores a host that is no door', () => {
    expect(
      countDoors([{ host: 'yaweloidle.com', status: 500, count: 9 }], HOSTS),
    ).toEqual(HOSTS.map((host) => ({ host, requests: 0, errors: 0 })));
  });
});

describe('problemsOf', () => {
  it('finds nothing when no door answered 5xx', () => {
    expect(
      problemsOf([
        { host: DEV, requests: 10, errors: 0 },
        { host: API, requests: 0, errors: 0 },
      ]),
    ).toEqual([]);
  });

  it('names each failing door with its 5xx and request counts', () => {
    expect(
      problemsOf([
        { host: DEV, requests: 10, errors: 2 },
        { host: API, requests: 4, errors: 4 },
      ]),
    ).toEqual([
      `${DEV} answered 2 of 10 requests with a 5xx in the last 24 hours`,
      `${API} answered 4 of 4 requests with a 5xx in the last 24 hours`,
    ]);
  });
});

describe('analyticsQuery', () => {
  const since = new Date('2026-11-14T01:00:00.000Z');
  const until = new Date('2026-11-15T01:00:00.000Z');
  const { query, variables } = analyticsQuery('zone-tag', since, until, HOSTS);

  it("asks the zone's HTTP requests, grouped by host and status", () => {
    expect(query).toContain('zones(filter: { zoneTag: $zone })');
    expect(query).toContain('httpRequestsAdaptiveGroups(');
    expect(query).toContain('clientRequestHTTPHost_in: $hosts');
    expect(query).toContain(
      'dimensions { clientRequestHTTPHost edgeResponseStatus }',
    );
  });

  it('passes the zone, the window and the door hosts as variables', () => {
    expect(variables).toEqual({
      zone: 'zone-tag',
      since: '2026-11-14T01:00:00.000Z',
      until: '2026-11-15T01:00:00.000Z',
      hosts: HOSTS,
    });
  });
});

describe('rowsOf', () => {
  const answer = (groups: unknown) => ({
    data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: groups }] } },
    errors: null,
  });

  it("reads each group's host, status and count", () => {
    expect(
      rowsOf(
        answer([
          {
            count: 4,
            dimensions: { clientRequestHTTPHost: DEV, edgeResponseStatus: 200 },
          },
        ]),
      ),
    ).toEqual([{ host: DEV, status: 200, count: 4 }]);
  });

  it("refuses an answer carrying Cloudflare's errors, naming them", () => {
    expect(() =>
      rowsOf({ data: null, errors: [{ message: 'not authorized' }] }),
    ).toThrow('Cloudflare analytics refused: not authorized');
  });

  it('refuses an answer with no zone, naming the zone it lacked', () => {
    expect(() =>
      rowsOf({ data: { viewer: { zones: [] } }, errors: null }),
    ).toThrow('Cloudflare analytics returned no zone');
  });

  it('refuses an answer that is not an object', () => {
    expect(() => rowsOf(null)).toThrow(
      'Cloudflare analytics answered no object',
    );
  });

  it('refuses an array as the answer', () => {
    expect(() => rowsOf([])).toThrow('Cloudflare analytics answered no object');
  });

  it("names an error of an unknown shape as '?'", () => {
    expect(() => rowsOf({ data: null, errors: ['boom'] })).toThrow(
      'Cloudflare analytics refused: ?',
    );
  });

  it('refuses a zone with no request groups', () => {
    expect(() => rowsOf(answer(undefined))).toThrow(
      'Cloudflare analytics returned no request groups',
    );
  });

  it('refuses a group that is not an object', () => {
    expect(() => rowsOf(answer([4]))).toThrow(
      'Cloudflare analytics returned a group of an unknown shape',
    );
  });

  it('refuses a group of the wrong shape', () => {
    expect(() => rowsOf(answer([{ count: '4', dimensions: {} }]))).toThrow(
      'Cloudflare analytics returned a group of an unknown shape',
    );
  });
});

describe('checkDoors', () => {
  const quiet = HOSTS.map((host) => ({ host, status: 200, count: 1 }));

  it('reports nothing and passes when every door answered without a 5xx', async () => {
    const reported: string[][] = [];
    const result = await checkDoors({
      hosts: HOSTS,
      readRows: () => Promise.resolve(quiet),
      report: (problems) => {
        reported.push([...problems]);
        return [];
      },
    });
    expect(result.ok).toBe(true);
    expect(reported).toEqual([]);
    expect(result.lines).toEqual(
      HOSTS.map((host) => `✓ ${host}: 1 requests, 0 answered 5xx`),
    );
  });

  it('reports each failing door and fails', async () => {
    const reported: string[][] = [];
    const result = await checkDoors({
      hosts: HOSTS,
      readRows: () =>
        Promise.resolve([...quiet, { host: DEV, status: 502, count: 3 }]),
      report: (problems) => {
        reported.push([...problems]);
        return ['opened #1'];
      },
    });
    expect(result.ok).toBe(false);
    expect(reported).toEqual([
      [`${DEV} answered 3 of 4 requests with a 5xx in the last 24 hours`],
    ]);
    expect(result.lines).toContain(`✗ ${DEV}: 4 requests, 3 answered 5xx`);
    expect(result.lines).toContain('opened #1');
  });

  it('reports an unreadable answer and fails, never passing silently', async () => {
    const reported: string[][] = [];
    const result = await checkDoors({
      hosts: HOSTS,
      readRows: () =>
        Promise.reject(new Error('DOOR_ANALYTICS_TOKEN is not set')),
      report: (problems) => {
        reported.push([...problems]);
        return ['commented on #1'];
      },
    });
    expect(result.ok).toBe(false);
    expect(reported).toEqual([
      [
        "the doors' analytics could not be read: DOOR_ANALYTICS_TOKEN is not set",
      ],
    ]);
  });

  it('names a rejection that is not an Error by its text', async () => {
    const result = await checkDoors({
      hosts: HOSTS,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the case under test
      readRows: () => Promise.reject('offline'),
      report: () => [],
    });
    expect(result).toEqual({
      ok: false,
      lines: ["the doors' analytics could not be read: offline"],
    });
  });
});

describe('the issue', () => {
  it('has one title for every door outage, so an open one is commented on', () => {
    expect(ISSUE_TITLE).toBe('A front door is failing');
  });

  it('carries the problems under the title, naming the check', () => {
    expect(outage(['a door failed'])).toMatchObject({
      title: ISSUE_TITLE,
      lead: 'The daily door check (door-check.yml, #784 AC6) found:',
      problems: ['a door failed'],
    });
  });
});

describe('readDoorRows: the two Cloudflare calls', () => {
  const NOW = new Date('2026-11-15T01:00:00.000Z');
  const groups = [
    {
      count: 4,
      dimensions: { clientRequestHTTPHost: DEV, edgeResponseStatus: 200 },
    },
  ];
  const fakeFetch = (
    asked: { url: string; init: RequestInit | undefined }[],
    answers: unknown[],
    status = 200,
  ): typeof fetch =>
    ((url: string, init?: RequestInit) => {
      asked.push({ url, init });
      return Promise.resolve(
        new Response(JSON.stringify(answers.shift()), { status }),
      );
    }) as typeof fetch;

  it("finds PROD's zone by name, then asks its last 24 hours", async () => {
    const asked: { url: string; init: RequestInit | undefined }[] = [];
    const rows = await readDoorRows(
      'token',
      HOSTS,
      NOW,
      fakeFetch(asked, [
        { result: [{ id: 'zone-1' }] },
        {
          data: { viewer: { zones: [{ httpRequestsAdaptiveGroups: groups }] } },
        },
      ]),
    );
    expect(rows).toEqual([{ host: DEV, status: 200, count: 4 }]);
    expect(asked.map(({ url }) => url)).toEqual([
      'https://api.cloudflare.com/client/v4/zones?name=yaweloidle.com',
      'https://api.cloudflare.com/client/v4/graphql',
    ]);
    expect(asked[0]?.init?.headers).toEqual({
      authorization: 'Bearer token',
      'content-type': 'application/json',
    });
    expect(JSON.parse(asked[1]?.init?.body as string)).toEqual(
      analyticsQuery(
        'zone-1',
        new Date('2026-11-14T01:00:00.000Z'),
        NOW,
        HOSTS,
      ),
    );
  });

  it('refuses a zones answer that is not an object', async () => {
    await expect(
      readDoorRows('token', HOSTS, NOW, fakeFetch([], [[]])),
    ).rejects.toThrow('the token reaches no zone named yaweloidle.com');
  });

  it('refuses a token that reaches no zone of that name', async () => {
    await expect(
      readDoorRows('token', HOSTS, NOW, fakeFetch([], [{ result: [] }])),
    ).rejects.toThrow('the token reaches no zone named yaweloidle.com');
  });

  it('refuses an answer that is not 200, naming the path and status', async () => {
    await expect(
      readDoorRows('token', HOSTS, NOW, fakeFetch([], [{}], 403)),
    ).rejects.toThrow('Cloudflare /zones?name=yaweloidle.com: status 403');
  });
});

describe('withPlant: the planted failure', () => {
  it('adds three 5xx answers for the named door', () => {
    expect(withPlant([], DEV)).toEqual([{ host: DEV, status: 500, count: 3 }]);
  });

  it('adds nothing when no door is named', () => {
    expect(withPlant([{ host: DEV, status: 200, count: 1 }], '')).toEqual([
      { host: DEV, status: 200, count: 1 },
    ]);
  });
});

describe('main: the run the workflow starts', () => {
  const NOW = new Date('2026-11-15T01:00:00.000Z');
  const ENV = {
    GITHUB_REPOSITORY: 'shyden-labs/yawelo-idle',
    CLOUDFLARE_API_TOKEN: 'token',
  };
  const quietFetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          (quietFetch as unknown as { calls: number }).calls++ === 0
            ? { result: [{ id: 'zone-1' }] }
            : {
                data: {
                  viewer: {
                    zones: [
                      {
                        httpRequestsAdaptiveGroups: HOSTS.map((host) => ({
                          count: 1,
                          dimensions: {
                            clientRequestHTTPHost: host,
                            edgeResponseStatus: 200,
                          },
                        })),
                      },
                    ],
                  },
                },
              },
        ),
      ),
    )) as unknown as typeof fetch & { calls: number };
  const run = (env: Record<string, string | undefined>) => {
    quietFetch.calls = 0;
    const reports: { repo: string; outage: Outage }[] = [];
    const logged: string[] = [];
    const done = main(env, {
      fetcher: quietFetch,
      now: NOW,
      report: (repo, outage) => {
        reports.push({ repo, outage });
        return ['reported'];
      },
      log: (line) => logged.push(line),
    });
    return { done, reports, logged };
  };

  it('passes, logs each door and reports nothing when every door is quiet', async () => {
    const { done, reports, logged } = run(ENV);
    expect(await done).toBe(0);
    expect(reports).toEqual([]);
    expect(logged).toEqual(
      HOSTS.map((host) => `✓ ${host}: 1 requests, 0 answered 5xx`),
    );
  });

  it('fails and reports the planted door on the repo when one is planted', async () => {
    const { done, reports, logged } = run({ ...ENV, PLANT_FAILING_DOOR: DEV });
    expect(await done).toBe(1);
    expect(reports.map(({ repo }) => repo)).toEqual([
      'shyden-labs/yawelo-idle',
    ]);
    expect(reports[0]?.outage.title).toBe(ISSUE_TITLE);
    expect(reports[0]?.outage.problems.join('\n')).toContain(DEV);
    expect(logged).toContain(`✗ ${DEV}: 4 requests, 3 answered 5xx`);
    expect(logged.at(-1)).toBe('reported');
  });

  it('refuses to start without the repository', async () => {
    await expect(run({ CLOUDFLARE_API_TOKEN: 'token' }).done).rejects.toThrow(
      'GITHUB_REPOSITORY is not set',
    );
  });

  it('refuses an empty repository', async () => {
    await expect(run({ ...ENV, GITHUB_REPOSITORY: '' }).done).rejects.toThrow(
      'GITHUB_REPOSITORY is not set',
    );
  });

  it('fails and reports a missing Cloudflare token', async () => {
    const { done, reports } = run({
      GITHUB_REPOSITORY: 'shyden-labs/yawelo-idle',
    });
    expect(await done).toBe(1);
    expect(reports[0]?.outage.problems).toEqual([
      "the doors' analytics could not be read: CLOUDFLARE_API_TOKEN is not set",
    ]);
  });
});
