import { describe, expect, it } from 'vitest';
import { boardOrphans, type OrphanReads } from '../../scripts/board-orphans';
import type { Gh } from '../../scripts/board-progress';

/**
 * scripts/board-orphans.ts (#580): a ticket is In Progress only while a
 * branch or an open pull request names it (operator 2026-10-13, every
 * project), so the pull-request gate fails, naming each orphan, and fails
 * closed when it cannot look. In-process with `gh` stood in: a unit test
 * starts no process.
 */

const TITLE = 'Yawelo Idle Stories';
const REPO = 'shyden-labs/yawelo-idle';
const ARGS = ['PVT_fixture', TITLE, REPO];
/** The pull request the gate runs on; every fixture holds it open. */
const THIS_PR = 900;
const ENV = {
  PR_AUTHOR: 'ShydenMcM',
  PR_NUMBER: String(THIS_PR),
  BOARD_TOKEN: 'board-token',
};

interface Pull {
  number: number;
  title: string;
  body: string | null;
  head: { ref: string };
}

/** A raw board item node for an open issue with this Status. */
function rawIssue(
  number: number,
  status: string,
  over: Record<string, unknown> = {},
): unknown {
  return {
    status: { name: status },
    priority: { name: 'P3' },
    content: {
      __typename: 'Issue',
      number,
      title: `story ${String(number)}`,
      state: 'OPEN',
      createdAt: '2026-01-10T00:00:00Z',
      repository: { nameWithOwner: REPO },
      blockedBy: { totalCount: 0, nodes: [] },
      subIssuesSummary: { total: 0, completed: 0 },
      ...over,
    },
  };
}

/** This pull request, naming nothing on the board. */
const thisPull: Pull = {
  number: THIS_PR,
  title: 'chore: an unrelated change',
  body: 'Nothing on the board.',
  head: { ref: 'chore/unrelated' },
};

interface Fixture {
  items: unknown[];
  title?: string;
  branches?: string[];
  pulls?: Pull[];
  /** Each branch's closed pull requests, merged or closed without merging. */
  closed?: Readonly<Record<string, ReadonlyArray<'merged' | 'unmerged'>>>;
  /** A read named here throws as `gh` does when it exits non-zero. */
  failing?: 'board' | 'branches' | 'pulls' | 'closed';
}

const BRANCHES_CALL = [
  'api',
  '--paginate',
  '--slurp',
  `repos/${REPO}/branches?per_page=100`,
];
const PULLS_CALL = [
  'api',
  '--paginate',
  '--slurp',
  `repos/${REPO}/pulls?state=open&per_page=100`,
];
const closedCall = (branch: string) => [
  'api',
  '--paginate',
  '--slurp',
  `repos/${REPO}/pulls?state=closed&head=${encodeURIComponent(`shyden-labs:${branch}`)}&per_page=100`,
];

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** Stand-ins for both tokens' `gh`, answering each read the script makes. */
function reads(f: Fixture): OrphanReads {
  const branches = f.branches ?? ['develop', 'main'];
  const pulls = f.pulls ?? [thisPull];
  const closed = f.closed ?? {};
  const board: Gh = (args) => {
    if (args[0] !== 'api' || args[1] !== 'graphql')
      throw new Error(`unexpected board call: ${args.join(' ')}`);
    if (f.failing === 'board') throw new Error('HTTP 401: Bad credentials');
    return JSON.stringify([
      {
        data: { node: { title: f.title ?? TITLE, items: { nodes: f.items } } },
      },
    ]);
  };
  const repo: Gh = (args) => {
    if (same(args, BRANCHES_CALL)) {
      if (f.failing === 'branches') throw new Error('HTTP 502: Bad Gateway');
      return JSON.stringify([branches.map((name) => ({ name }))]);
    }
    if (same(args, PULLS_CALL)) {
      if (f.failing === 'pulls') throw new Error('HTTP 502: Bad Gateway');
      return JSON.stringify([pulls]);
    }
    const branch = branches.find((b) => same(args, closedCall(b)));
    if (branch !== undefined) {
      if (f.failing === 'closed') throw new Error('HTTP 502: Bad Gateway');
      return JSON.stringify([
        (closed[branch] ?? []).map((how, i) => ({
          number: i + 1,
          merged_at: how === 'merged' ? '2026-10-16T00:00:00Z' : null,
        })),
      ]);
    }
    throw new Error(`unexpected repo call: ${args.join(' ')}`);
  };
  return { board, repo };
}

/** A `gh` that fails the test if the script calls it at all. */
const neverCalled: OrphanReads = {
  board: (args) => {
    throw new Error(`the board was read: ${args.join(' ')}`);
  },
  repo: (args) => {
    throw new Error(`the repository was read: ${args.join(' ')}`);
  },
};

describe('boardOrphans passes a ticket something names (#580 AC1, AC3)', () => {
  it('passes a ticket named by a branch with no pull request', () => {
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({
        items: [rawIssue(12, 'In Progress')],
        branches: ['develop', 'board/12-orphan-check'],
      }),
    );
    expect(result).toEqual({
      ok: true,
      lines: [
        'No orphans: 1 ticket In Progress, each named. Read 1 board item, 2 branches, 1 open pull request.',
        '#12: branch board/12-orphan-check',
      ],
    });
  });

  it('passes a ticket named by an open pull request body', () => {
    const named = { ...thisPull, body: 'The gate.\n\nRefs #12' };
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({ items: [rawIssue(12, 'In Progress')], pulls: [named] }),
    );
    expect(result.lines[1]).toBe(`#12: pull request #${String(THIS_PR)}`);
    expect(result.ok).toBe(true);
  });

  it('passes a ticket named by an open pull request title', () => {
    const named = { ...thisPull, title: 'Board: the gate (#12)' };
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({ items: [rawIssue(12, 'In Progress')], pulls: [named] }),
    );
    expect(result.lines[1]).toBe(`#12: pull request #${String(THIS_PR)}`);
  });

  it("passes a ticket named by an open pull request's branch", () => {
    const named = { ...thisPull, head: { ref: 'board/12-orphan-check' } };
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({ items: [rawIssue(12, 'In Progress')], pulls: [named] }),
    );
    expect(result.lines[1]).toBe(`#12: pull request #${String(THIS_PR)}`);
  });

  it('judges only tickets In Progress: a Todo ticket nothing names passes', () => {
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({
        items: [rawIssue(12, 'Todo'), rawIssue(13, 'In Progress')],
        branches: ['develop', 'x/13-y'],
      }),
    );
    expect(result).toEqual({
      ok: true,
      lines: [
        'No orphans: 1 ticket In Progress, each named. Read 2 board items, 2 branches, 1 open pull request.',
        '#13: branch x/13-y',
      ],
    });
  });
});

describe('boardOrphans fails on an orphan, by name (#580 AC1, AC3)', () => {
  it('fails a ticket In Progress that nothing names', () => {
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({ items: [rawIssue(12, 'In Progress')] }),
    );
    expect(result).toEqual({
      ok: false,
      lines: [
        '1 orphan: In Progress, but no branch or open pull request names it. Move each back to Todo, or push its branch. Read 1 board item, 2 branches, 1 open pull request.',
        '#12 story 12',
      ],
    });
  });

  it('fails a ticket whose only branch has a pull request closed without merging', () => {
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({
        items: [rawIssue(12, 'In Progress')],
        branches: ['develop', 'board/12-orphan-check'],
        closed: { 'board/12-orphan-check': ['unmerged'] },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.lines[1]).toBe('#12 story 12');
  });

  it('passes a ticket whose branch was merged, until the ticket closes (operator 2026-10-16)', () => {
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({
        items: [rawIssue(12, 'In Progress')],
        branches: ['develop', 'board/12-orphan-check'],
        closed: { 'board/12-orphan-check': ['merged'] },
      }),
    );
    expect(result).toEqual({
      ok: true,
      lines: [
        'No orphans: 1 ticket In Progress, each named. Read 1 board item, 2 branches, 1 open pull request.',
        '#12: branch board/12-orphan-check (merged, awaiting close)',
      ],
    });
  });

  it('counts a branch with one pull request closed unmerged and a later one merged', () => {
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({
        items: [rawIssue(12, 'In Progress')],
        branches: ['develop', 'board/12-orphan-check'],
        closed: { 'board/12-orphan-check': ['unmerged', 'merged'] },
      }),
    );
    expect(result.lines[1]).toBe(
      '#12: branch board/12-orphan-check (merged, awaiting close)',
    );
  });

  it('does not take #120 or branch /120- as naming #12', () => {
    const near = { ...thisPull, body: 'Refs #120', head: { ref: 'x/120-y' } };
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({
        items: [rawIssue(12, 'In Progress')],
        branches: ['develop', 'board/120-other', 'board/1-12-other'],
        pulls: [near],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("does not take another repository's #12 as naming it", () => {
    const other = { ...thisPull, body: 'Refs shyden-labs/repo-template#12' };
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({ items: [rawIssue(12, 'In Progress')], pulls: [other] }),
    );
    expect(result.ok).toBe(false);
  });

  it('names every orphan, each on its own line', () => {
    const result = boardOrphans(
      ARGS,
      ENV,
      reads({
        items: [rawIssue(12, 'In Progress'), rawIssue(14, 'In Progress')],
      }),
    );
    expect(result.lines).toEqual([
      '2 orphans: In Progress, but no branch or open pull request names it. Move each back to Todo, or push its branch. Read 2 board items, 2 branches, 1 open pull request.',
      '#12 story 12',
      '#14 story 14',
    ]);
  });
});

describe('boardOrphans fails closed when it cannot look (#580 AC2, AC3)', () => {
  it('fails, naming the board, when the board cannot be read', () => {
    expect(() =>
      boardOrphans(ARGS, ENV, reads({ items: [], failing: 'board' })),
    ).toThrow('could not read the board: HTTP 401: Bad credentials');
  });

  it('fails, naming the branches, when they cannot be read', () => {
    expect(() =>
      boardOrphans(
        ARGS,
        ENV,
        reads({ items: [rawIssue(12, 'In Progress')], failing: 'branches' }),
      ),
    ).toThrow('could not read the branches: HTTP 502: Bad Gateway');
  });

  it('fails, naming the open pull requests, when they cannot be read', () => {
    expect(() =>
      boardOrphans(
        ARGS,
        ENV,
        reads({ items: [rawIssue(12, 'In Progress')], failing: 'pulls' }),
      ),
    ).toThrow('could not read the open pull requests: HTTP 502: Bad Gateway');
  });

  it('fails, naming the branch, when its closed pull requests cannot be read', () => {
    expect(() =>
      boardOrphans(
        ARGS,
        ENV,
        reads({
          items: [rawIssue(12, 'In Progress')],
          branches: ['develop', 'board/12-orphan-check'],
          failing: 'closed',
        }),
      ),
    ).toThrow(
      'could not read the closed pull requests of board/12-orphan-check: HTTP 502: Bad Gateway',
    );
  });

  it('refuses a closed pull request entry with no merged_at field', () => {
    const r = reads({
      items: [rawIssue(12, 'In Progress')],
      branches: ['develop', 'board/12-orphan-check'],
    });
    const repo: Gh = (args) =>
      same(args, closedCall('board/12-orphan-check'))
        ? JSON.stringify([[{ number: 1 }]])
        : r.repo(args);
    expect(() => boardOrphans(ARGS, ENV, { board: r.board, repo })).toThrow(
      'could not read the closed pull requests of board/12-orphan-check: an entry has no merged_at',
    );
  });

  it("refuses another board's title", () => {
    expect(() =>
      boardOrphans(
        ARGS,
        ENV,
        reads({
          items: [rawIssue(12, 'In Progress')],
          title: 'ShyTalk Stories',
        }),
      ),
    ).toThrow(
      'could not read the board: the board is "ShyTalk Stories", not "Yawelo Idle Stories": nothing read',
    );
  });

  it('refuses a board read that holds no items', () => {
    expect(() => boardOrphans(ARGS, ENV, reads({ items: [] }))).toThrow(
      'the board read holds no items, so nothing was judged',
    );
  });

  it('refuses a branch list without develop, its known positive', () => {
    expect(() =>
      boardOrphans(
        ARGS,
        ENV,
        reads({ items: [rawIssue(12, 'Todo')], branches: ['main'] }),
      ),
    ).toThrow(
      'the branches read holds no develop, so it is not the whole list',
    );
  });

  it('refuses an open pull request list without this pull request, its known positive', () => {
    expect(() =>
      boardOrphans(
        ARGS,
        ENV,
        reads({ items: [rawIssue(12, 'Todo')], pulls: [] }),
      ),
    ).toThrow(
      `the open pull requests read does not hold this one, #${String(THIS_PR)}, so it is not the whole list`,
    );
  });

  it('refuses a branch entry with no name', () => {
    const r = reads({ items: [rawIssue(12, 'Todo')] });
    const repo: Gh = (args) =>
      same(args, BRANCHES_CALL)
        ? JSON.stringify([[{ name: 'develop' }, { commit: {} }]])
        : r.repo(args);
    expect(() => boardOrphans(ARGS, ENV, { board: r.board, repo })).toThrow(
      'could not read the branches: an entry has no name',
    );
  });

  /** Runs the gate with one more open pull request, `entry`, beside this one. */
  const withPull = (entry: unknown) => {
    const r = reads({ items: [rawIssue(12, 'Todo')] });
    const repo: Gh = (args) =>
      same(args, PULLS_CALL)
        ? JSON.stringify([[thisPull, entry]])
        : r.repo(args);
    return () => boardOrphans(ARGS, ENV, { board: r.board, repo });
  };
  /** Another open pull request, #7, with `key` left out. */
  const without = (key: keyof Pull) =>
    Object.fromEntries(
      Object.entries({ ...thisPull, number: 7 }).filter(([k]) => k !== key),
    );
  const PULL_REFUSED =
    'could not read the open pull requests: an entry has no number, title, body and branch';

  it('refuses a pull request entry with no number', () => {
    expect(withPull(without('number'))).toThrow(PULL_REFUSED);
  });

  it('refuses a pull request entry with no title', () => {
    expect(withPull(without('title'))).toThrow(PULL_REFUSED);
  });

  it('refuses a pull request entry with no body field (null is an empty body)', () => {
    expect(withPull(without('body'))).toThrow(PULL_REFUSED);
  });

  it('refuses a pull request entry with no branch', () => {
    expect(withPull(without('head'))).toThrow(PULL_REFUSED);
  });

  it('reads a pull request whose body is null as naming nothing', () => {
    expect(withPull({ ...thisPull, number: 7, body: null })().ok).toBe(true);
  });

  it('refuses a ticket In Progress from another repository, whose branches it does not read', () => {
    const elsewhere = rawIssue(12, 'In Progress', {
      repository: { nameWithOwner: 'shyden-labs/repo-template' },
    });
    expect(() =>
      boardOrphans(ARGS, ENV, reads({ items: [elsewhere] })),
    ).toThrow(
      'shyden-labs/repo-template#12 is In Progress, and this check reads only shyden-labs/yawelo-idle',
    );
  });

  it('fails, naming the secret, when the board token is empty', () => {
    expect(() =>
      boardOrphans(ARGS, { ...ENV, BOARD_TOKEN: '' }, neverCalled),
    ).toThrow(
      "no board token: BOARD_TOKEN is empty, so the board cannot be read (the board-read environment's ROADMAP_APP_KEY, #580)",
    );
  });

  it('fails, naming it, when the pull request number is not given', () => {
    expect(() =>
      boardOrphans(ARGS, { ...ENV, PR_NUMBER: undefined }, neverCalled),
    ).toThrow('PR_NUMBER is not a pull request number');
  });

  it('refuses before reading when the repository is missing', () => {
    expect(() => boardOrphans(ARGS.slice(0, 2), ENV, neverCalled)).toThrow(
      'usage: node scripts/board-orphans.ts <board-node-id> "<board title>" <owner/repo>',
    );
  });
});

/**
 * A check is green only when it ran (Shyden, 2026-10-18, every project):
 * Dependabot's pull requests are read like anyone else's, with the key from
 * the repository's Dependabot secret, since its runs get no environment
 * secrets (#661).
 */
describe("boardOrphans reads Dependabot's pull requests too (#661)", () => {
  const DEPENDABOT = { ...ENV, PR_AUTHOR: 'dependabot[bot]' };

  it('fails, naming the Dependabot secret, when a Dependabot pull request has no token', () => {
    expect(() =>
      boardOrphans(ARGS, { ...DEPENDABOT, BOARD_TOKEN: '' }, neverCalled),
    ).toThrow(
      "no board token: BOARD_TOKEN is empty, so the board cannot be read (Dependabot's runs read the repository's Dependabot secret ROADMAP_APP_KEY, #661)",
    );
  });

  it('reads the board for a Dependabot pull request as for anyone else', () => {
    expect(
      boardOrphans(
        ARGS,
        DEPENDABOT,
        reads({
          items: [rawIssue(12, 'In Progress')],
          branches: ['develop', 'board/12-orphan-check'],
        }),
      ),
    ).toEqual({
      ok: true,
      lines: [
        'No orphans: 1 ticket In Progress, each named. Read 1 board item, 2 branches, 1 open pull request.',
        '#12: branch board/12-orphan-check',
      ],
    });
  });
});
