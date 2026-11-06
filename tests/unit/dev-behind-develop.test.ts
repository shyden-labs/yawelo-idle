import { describe, expect, it } from 'vitest';
import {
  ISSUE_TITLE,
  checkDev,
  judgeDev,
  type GitHub,
} from '../../scripts/dev-behind-develop';

/**
 * Dev never falls behind develop silently (#497 AC1, AC2): a daily check
 * compares develop's head with the commit dev's sync API reports, and opens
 * (or comments on) an issue assigned to ShydenMcM when dev is behind.
 */

const HEAD = 'a'.repeat(40);
const OLDER = 'b'.repeat(40);
const NOW = new Date('2026-11-06T12:00:00Z');
const minutesBefore = (minutes: number): string =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe('judgeDev', () => {
  it('is current when dev serves the head', () => {
    expect(
      judgeDev({ sha: HEAD, committedAt: minutesBefore(600) }, HEAD, NOW),
    ).toEqual({ kind: 'current' });
  });

  it('waits while the head is 30 minutes old or younger (a deploy may be running)', () => {
    expect(
      judgeDev({ sha: HEAD, committedAt: minutesBefore(30) }, OLDER, NOW),
    ).toEqual({ kind: 'deploying' });
  });

  it('is behind once the head is older than 30 minutes and dev serves another commit', () => {
    expect(
      judgeDev({ sha: HEAD, committedAt: minutesBefore(31) }, OLDER, NOW),
    ).toEqual({
      kind: 'behind',
      reason: `dev serves ${OLDER}, develop's head is ${HEAD} (committed ${minutesBefore(31)}, 31 minutes ago)`,
    });
  });

  it('is behind when dev cannot be read at all, whatever the head’s age', () => {
    expect(
      judgeDev(
        { sha: HEAD, committedAt: minutesBefore(1) },
        { error: 'sync /health status 503' },
        NOW,
      ),
    ).toEqual({
      kind: 'behind',
      reason: `dev's served commit could not be read (sync /health status 503); develop's head is ${HEAD}`,
    });
  });

  it('refuses a head date it cannot parse, naming it', () => {
    expect(() =>
      judgeDev({ sha: HEAD, committedAt: 'yesterday' }, OLDER, NOW),
    ).toThrow('develop head date "yesterday" is not a date');
  });
});

interface Call {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
}

/** A GitHub stand-in: answers by path, records every call. */
function fakeGitHub(openIssues: readonly unknown[][]): {
  github: GitHub;
  calls: Call[];
} {
  const calls: Call[] = [];
  const github: GitHub = {
    request(method, path, body) {
      calls.push(
        body === undefined ? { method, path } : { method, path, body },
      );
      if (path === '/repos/o/r/commits/develop')
        return Promise.resolve({
          sha: HEAD,
          commit: { committer: { date: minutesBefore(120) } },
        });
      if (path.startsWith('/repos/o/r/actions/workflows/deploy-dev.yml/runs'))
        return Promise.resolve({
          workflow_runs: [
            {
              html_url: 'https://github.com/o/r/actions/runs/7',
              head_sha: OLDER,
              conclusion: 'success',
            },
          ],
        });
      const page =
        /^\/repos\/o\/r\/issues\?state=open&per_page=100&page=(\d+)$/.exec(
          path,
        );
      if (page !== null)
        return Promise.resolve(openIssues[Number(page[1]) - 1] ?? []);
      if (method === 'POST') return Promise.resolve({ number: 900 });
      throw new Error(`unexpected ${method} ${path}`);
    },
  };
  return { github, calls };
}

const writes = (calls: readonly Call[]): Call[] =>
  calls.filter((c) => c.method !== 'GET');

describe('checkDev', () => {
  it('writes nothing when dev serves the head', async () => {
    const { github, calls } = fakeGitHub([]);
    const said = await checkDev({
      github,
      repo: 'o/r',
      now: NOW,
      readServed: () => Promise.resolve(HEAD),
    });
    expect(writes(calls)).toEqual([]);
    expect(said).toBe(`✓ dev serves develop's head ${HEAD}`);
  });

  // AC2's planted failure: the served commit stood in as an older one.
  it('opens an issue assigned to ShydenMcM naming both commits and the newest deploy-dev run', async () => {
    const { github, calls } = fakeGitHub([[{ number: 5, title: 'Other' }]]);
    const said = await checkDev({
      github,
      repo: 'o/r',
      now: NOW,
      readServed: () => Promise.resolve(OLDER),
    });
    const reason = `dev serves ${OLDER}, develop's head is ${HEAD} (committed ${minutesBefore(120)}, 120 minutes ago)`;
    const body = `${reason}.\n\nNewest deploy-dev run on develop: https://github.com/o/r/actions/runs/7 (commit ${OLDER}, success).\n\nTo recover, dispatch deploy-dev on develop: \`gh workflow run deploy-dev.yml --ref develop\`. Opened by the daily dev-behind-develop check (#497); add it to the board.`;
    expect(writes(calls)).toEqual([
      {
        method: 'POST',
        path: '/repos/o/r/issues',
        body: { title: ISSUE_TITLE, body, assignees: ['ShydenMcM'] },
      },
    ]);
    expect(said).toBe(`✗ ${reason}: opened #900`);
  });

  it('comments on the open issue instead of opening another, found past the first page', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      title: `Ticket ${String(i + 1)}`,
    }));
    const { github, calls } = fakeGitHub([
      fullPage,
      [{ number: 412, title: ISSUE_TITLE }],
    ]);
    const said = await checkDev({
      github,
      repo: 'o/r',
      now: NOW,
      readServed: () => Promise.resolve(OLDER),
    });
    expect(writes(calls).map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /repos/o/r/issues/412/comments',
    ]);
    expect(said).toMatch(/: commented on #412$/);
  });

  it('ignores a pull request that carries the title (GitHub lists them as issues)', async () => {
    const { github, calls } = fakeGitHub([
      [{ number: 3, title: ISSUE_TITLE, pull_request: {} }],
    ]);
    await checkDev({
      github,
      repo: 'o/r',
      now: NOW,
      readServed: () => Promise.resolve(OLDER),
    });
    expect(writes(calls).map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /repos/o/r/issues',
    ]);
  });

  it('opens the issue when dev cannot be read', async () => {
    const { github, calls } = fakeGitHub([]);
    const said = await checkDev({
      github,
      repo: 'o/r',
      now: NOW,
      readServed: () => Promise.reject(new Error('connect ETIMEDOUT')),
    });
    expect(writes(calls)).toHaveLength(1);
    expect(said).toBe(
      `✗ dev's served commit could not be read (connect ETIMEDOUT); develop's head is ${HEAD}: opened #900`,
    );
  });

  it('names a missing deploy-dev run rather than inventing one', async () => {
    const { github, calls } = fakeGitHub([]);
    const original = github.request.bind(github);
    github.request = (method, path, body) =>
      path.startsWith('/repos/o/r/actions/workflows/deploy-dev.yml/runs')
        ? Promise.resolve({ workflow_runs: [] })
        : original(method, path, body);
    await checkDev({
      github,
      repo: 'o/r',
      now: NOW,
      readServed: () => Promise.resolve(OLDER),
    });
    const post = writes(calls)[0]?.body as { body: string };
    expect(post.body).toContain(
      'Newest deploy-dev run on develop: none found.',
    );
  });

  it('reads the newest deploy-dev run on develop only', async () => {
    const { github, calls } = fakeGitHub([]);
    await checkDev({
      github,
      repo: 'o/r',
      now: NOW,
      readServed: () => Promise.resolve(OLDER),
    });
    expect(calls.map((c) => c.path)).toContain(
      '/repos/o/r/actions/workflows/deploy-dev.yml/runs?branch=develop&per_page=1',
    );
  });
});
