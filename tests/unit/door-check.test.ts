import { describe, expect, it } from 'vitest';
import {
  analyticsQuery,
  checkDoors,
  countDoors,
  ISSUE_TITLE,
  problemsOf,
  rowsOf,
  type Row,
} from '../../scripts/door-check';
import { DOORS } from '../../apps/door/worker/door';

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
});

describe('the issue', () => {
  it('has one title for every door outage, so an open one is commented on', () => {
    expect(ISSUE_TITLE).toBe('A front door is failing');
  });
});
