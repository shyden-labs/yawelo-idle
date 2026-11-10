/**
 * The daily door check (#784 AC6; Shyden, 2026-11-09: "a daily job reads each
 * door's requests and errors from Cloudflare").
 *
 *     CLOUDFLARE_API_TOKEN=… GH_TOKEN=… GITHUB_REPOSITORY=owner/name \
 *       [PLANT_FAILING_DOOR=<door host>] node scripts/door-check.ts
 *
 * Reads the last 24 hours of PROD's zone from Cloudflare's GraphQL analytics
 * (httpRequestsAdaptiveGroups, by host and status), prints each door's
 * requests and 5xx answers, and reports any door that answered a 5xx, or an
 * answer it could not read, on one issue for Shyden (scripts/issue-report.ts).
 * Either goes red as well. The token needs Zone Read and Analytics Read on
 * PROD's zone alone; it lives in the `door-cron` environment, which admits
 * main alone (.github/workflows/door-check.yml).
 *
 * PLANT_FAILING_DOOR stands in three 5xx answers for that door: the planted
 * failure that proves the check speaks, on GitHub itself.
 */
import { execFileSync } from 'node:child_process';
import { DOORS } from '../apps/door/worker/door.ts';
import { report } from './issue-report.ts';

/** The one title every door outage's issue carries. */
export const ISSUE_TITLE = 'A front door is failing';

/** PROD's zone, which holds every door (apps/door/wrangler.jsonc). */
export const PROD_ZONE = 'yaweloidle.com';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One analytics group: how many requests a host answered with a status. */
export interface Row {
  readonly host: string;
  readonly status: number;
  readonly count: number;
}

export interface DoorCount {
  readonly host: string;
  readonly requests: number;
  readonly errors: number;
}

/** Every door's requests and 5xx answers, zeros included, in `hosts` order. */
export function countDoors(
  rows: readonly Row[],
  hosts: readonly string[],
): DoorCount[] {
  return hosts.map((host) => {
    const mine = rows.filter((row) => row.host === host);
    return {
      host,
      requests: mine.reduce((sum, row) => sum + row.count, 0),
      errors: mine
        .filter((row) => row.status >= 500 && row.status <= 599)
        .reduce((sum, row) => sum + row.count, 0),
    };
  });
}

/** One line per door that answered a 5xx. */
export function problemsOf(counts: readonly DoorCount[]): string[] {
  return counts
    .filter((count) => count.errors > 0)
    .map(
      ({ host, requests, errors }) =>
        `${host} answered ${String(errors)} of ${String(requests)} requests with a 5xx in the last 24 hours`,
    );
}

/** The GraphQL query for the doors' requests between `since` and `until`. */
export function analyticsQuery(
  zone: string,
  since: Date,
  until: Date,
  hosts: readonly string[],
): { query: string; variables: Record<string, unknown> } {
  return {
    query: `query Doors($zone: string!, $since: Time!, $until: Time!, $hosts: [string!]) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      httpRequestsAdaptiveGroups(
        limit: 1000
        filter: { datetime_geq: $since, datetime_lt: $until, clientRequestHTTPHost_in: $hosts }
      ) {
        count
        dimensions { clientRequestHTTPHost edgeResponseStatus }
      }
    }
  }
}`,
    variables: {
      zone,
      since: since.toISOString(),
      until: until.toISOString(),
      hosts: [...hosts],
    },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The rows in Cloudflare's answer; throws naming what is wrong with it. */
export function rowsOf(answer: unknown): Row[] {
  if (!isRecord(answer))
    throw new Error('Cloudflare analytics answered no object');
  if (Array.isArray(answer.errors) && answer.errors.length > 0)
    throw new Error(
      `Cloudflare analytics refused: ${answer.errors
        .map((error) => (isRecord(error) ? String(error.message) : '?'))
        .join('; ')}`,
    );
  const viewer = isRecord(answer.data) ? answer.data.viewer : undefined;
  const zones = isRecord(viewer) ? viewer.zones : undefined;
  const zone: unknown = Array.isArray(zones) ? zones[0] : undefined;
  if (!isRecord(zone)) throw new Error('Cloudflare analytics returned no zone');
  const groups = zone.httpRequestsAdaptiveGroups;
  if (!Array.isArray(groups))
    throw new Error('Cloudflare analytics returned no request groups');
  return groups.map((group: unknown) => {
    const dimensions = isRecord(group) ? group.dimensions : undefined;
    if (
      !isRecord(group) ||
      typeof group.count !== 'number' ||
      !isRecord(dimensions) ||
      typeof dimensions.clientRequestHTTPHost !== 'string' ||
      typeof dimensions.edgeResponseStatus !== 'number'
    )
      throw new Error(
        'Cloudflare analytics returned a group of an unknown shape',
      );
    return {
      host: dimensions.clientRequestHTTPHost,
      status: dimensions.edgeResponseStatus,
      count: group.count,
    };
  });
}

export interface CheckDeps {
  readonly hosts: readonly string[];
  /** The last day's rows; rejects when they cannot be read. */
  readonly readRows: () => Promise<Row[]>;
  /** Reports problems on the issue; says what it did. */
  readonly report: (problems: readonly string[]) => string[];
}

/** Runs the check once: what it found and did, and whether it passed. */
export async function checkDoors(
  deps: CheckDeps,
): Promise<{ ok: boolean; lines: string[] }> {
  let counts: DoorCount[];
  try {
    counts = countDoors(await deps.readRows(), deps.hosts);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const problems = [`the doors' analytics could not be read: ${reason}`];
    return { ok: false, lines: [...problems, ...deps.report(problems)] };
  }
  const lines = counts.map(
    ({ host, requests, errors }) =>
      `${errors > 0 ? '✗' : '✓'} ${host}: ${String(requests)} requests, ${String(errors)} answered 5xx`,
  );
  const problems = problemsOf(counts);
  if (problems.length === 0) return { ok: true, lines };
  return { ok: false, lines: [...lines, ...deps.report(problems)] };
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '')
    throw new Error(`${name} is not set`);
  return value;
}

async function cloudflare(
  token: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok)
    throw new Error(`Cloudflare ${path}: status ${String(response.status)}`);
  return response.json();
}

/** PROD's zone id, found by its name with the token. */
async function zoneId(token: string): Promise<string> {
  const answer = await cloudflare(token, `/zones?name=${PROD_ZONE}`);
  const result = isRecord(answer) ? answer.result : undefined;
  const zone: unknown = Array.isArray(result) ? result[0] : undefined;
  if (!isRecord(zone) || typeof zone.id !== 'string')
    throw new Error(`the token reaches no zone named ${PROD_ZONE}`);
  return zone.id;
}

async function readRows(hosts: readonly string[]): Promise<Row[]> {
  const token = required('CLOUDFLARE_API_TOKEN');
  const until = new Date();
  const since = new Date(until.getTime() - DAY_MS);
  return rowsOf(
    await cloudflare(
      token,
      '/graphql',
      analyticsQuery(await zoneId(token), since, until, hosts),
    ),
  );
}

if (import.meta.main) {
  const repo = required('GITHUB_REPOSITORY');
  const hosts = [...DOORS.keys()];
  const plant = process.env['PLANT_FAILING_DOOR'] ?? '';
  const { ok, lines } = await checkDoors({
    hosts,
    readRows: async () => [
      ...(await readRows(hosts)),
      ...(plant === '' ? [] : [{ host: plant, status: 500, count: 3 }]),
    ],
    report: (problems) =>
      report(
        repo,
        (args) =>
          execFileSync('gh', args, {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
          }),
        {
          title: ISSUE_TITLE,
          lead: 'The daily door check (door-check.yml, #784 AC6) found:',
          problems,
          footer:
            'People reach dev and test only through the doors. Read the ' +
            "door's Worker logs in PROD's account, fix the cause, and add " +
            'this issue to the board.',
        },
      ),
  });
  for (const line of lines) console.log(line);
  if (!ok) process.exit(1);
}
