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

/** develop's head commit in every fixture's branch list. */
const DEVELOP_SHA = 'd'.repeat(40);

/** A closed pull request in the whole-repository read (#702). */
interface ClosedPull {
  number: number;
  merged_at: string | null;
  merge_commit_sha: string | null;
  head: { ref: string; repo: { full_name: string } | null };
}

/** A merged pull request whose branch was in this repository. */
const mergedPull = (
  number: number,
  ref: string,
  over: Partial<ClosedPull> = {},
): ClosedPull => ({
  number,
  merged_at: '2026-10-19T00:00:00Z',
  merge_commit_sha: 'e'.repeat(40),
  head: { ref, repo: { full_name: REPO } },
  ...over,
});

/** The merged pull request develop's head came from, naming nothing: the read's known positive. */
const developPull = mergedPull(899, 'chore/earlier', {
  merge_commit_sha: DEVELOP_SHA,
});

interface Fixture {
  items: unknown[];
  /** The board's item count GitHub reports (#703); by default, `items` is all of it. */
  totalCount?: number;
  title?: string;
  branches?: string[];
  pulls?: Pull[];
  /** Each branch's closed pull requests, merged or closed without merging. */
  closed?: Readonly<Record<string, ReadonlyArray<'merged' | 'unmerged'>>>;
  /** Every closed pull request of the repository, branches deleted or not (#702). */
  allClosed?: unknown[];
  /** A read named here throws as `gh` does when it exits non-zero. */
  failing?: 'board' | 'branches' | 'pulls' | 'closed' | 'allClosed';
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
const ALL_CLOSED_CALL = [
  'api',
  '--paginate',
  '--slurp',
  `repos/${REPO}/pulls?state=closed&per_page=100`,
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
        data: {
          node: {
            title: f.title ?? TITLE,
            items: {
              totalCount: f.totalCount ?? f.items.length,
              nodes: f.items,
            },
          },
        },
      },
    ]);
  };
  const repo: Gh = (args) => {
    if (same(args, BRANCHES_CALL)) {
      if (f.failing === 'branches') throw new Error('HTTP 502: Bad Gateway');
      return JSON.stringify([
        branches.map((name) => ({
          name,
          commit: { sha: name === 'develop' ? DEVELOP_SHA : 'f'.repeat(40) },
        })),
      ]);
    }
    if (same(args, PULLS_CALL)) {
      if (f.failing === 'pulls') throw new Error('HTTP 502: Bad Gateway');
      return JSON.stringify([pulls]);
    }
    if (same(args, ALL_CLOSED_CALL)) {
      if (f.failing === 'allClosed') throw new Error('HTTP 502: Bad Gateway');
      return JSON.stringify([f.allClosed ?? [developPull]]);
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
        'No orphans: 1 ticket In Progress, each named. Read 1 board item, 2 branches, 1 open pull request, 1 merged pull request.',
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
        'No orphans: 1 ticket In Progress, each named. Read 2 board items, 2 branches, 1 open pull request, 1 merged pull request.',
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
        '1 orphan: In Progress, but no branch or open pull request names it. Move each back to Todo, or push its branch. Read 1 board item, 2 branches, 1 open pull request, 1 merged pull request.',
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
        'No orphans: 1 ticket In Progress, each named. Read 1 board item, 2 branches, 1 open pull request, 1 merged pull request.',
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
      '2 orphans: In Progress, but no branch or open pull request names it. Move each back to Todo, or push its branch. Read 2 board items, 2 branches, 1 open pull request, 1 merged pull request.',
      '#12 story 12',
      '#14 story 14',
    ]);
  });
});

describe('boardOrphans counts a merged pull request whose branch is gone (#702)', () => {
  /** #12 In Progress, its branch deleted at merge, so only `allClosed` can name it. */
  const judge = (allClosed: unknown[]) =>
    boardOrphans(
      ARGS,
      ENV,
      reads({ items: [rawIssue(12, 'In Progress')], allClosed }),
    );

  it("passes a ticket a merged pull request's branch names, until the ticket closes", () => {
    expect(judge([developPull, mergedPull(850, 'ci/12-orphan-check')])).toEqual(
      {
        ok: true,
        lines: [
          'No orphans: 1 ticket In Progress, each named. Read 1 board item, 2 branches, 1 open pull request, 2 merged pull requests.',
          '#12: pull request #850 (merged, awaiting close)',
        ],
      },
    );
  });

  it('does not count a pull request closed without merging', () => {
    const abandoned = mergedPull(850, 'ci/12-orphan-check', {
      merged_at: null,
      merge_commit_sha: null,
    });
    const result = judge([developPull, abandoned]);
    expect(result.ok).toBe(false);
    expect(result.lines[0]).toContain('1 merged pull request.');
  });

  it('does not take a merged branch /120- as naming #12', () => {
    expect(judge([developPull, mergedPull(850, 'ci/120-other')]).ok).toBe(
      false,
    );
  });

  it('does not take #12 in a merged title or body as naming it: history keeps every mention', () => {
    const mention = {
      ...mergedPull(850, 'docs/unrelated'),
      title: 'docs: unrelated (Refs #12)',
      body: 'Refs #12',
    };
    expect(judge([developPull, mention]).ok).toBe(false);
  });

  it("does not count a merged pull request from another repository's branch", () => {
    const fork = mergedPull(850, 'ci/12-orphan-check', {
      head: { ref: 'ci/12-orphan-check', repo: { full_name: 'someone/fork' } },
    });
    expect(judge([developPull, fork]).ok).toBe(false);
  });

  it('does not count a merged pull request whose head repository is gone', () => {
    const gone = mergedPull(850, 'ci/12-orphan-check', {
      head: { ref: 'ci/12-orphan-check', repo: null },
    });
    expect(judge([developPull, gone]).ok).toBe(false);
  });
});

describe('boardOrphans fails closed when it cannot look (#580 AC2, AC3)', () => {
  it('fails, naming the board, when the board cannot be read', () => {
    expect(() =>
      boardOrphans(ARGS, ENV, reads({ items: [], failing: 'board' })),
    ).toThrow('could not read the board: HTTP 401: Bad credentials');
  });

  // The board holds an orphan the read lost: passing would let it through.
  it('fails, naming the board, when the read is short of the board (#703)', () => {
    expect(() =>
      boardOrphans(
        ARGS,
        ENV,
        reads({ items: [rawIssue(12, 'Todo')], totalCount: 2 }),
      ),
    ).toThrow(
      'could not read the board: the board has 2 items and 1 were read: nothing read',
    );
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

  it('fails, naming the read, when the closed pull requests cannot be read (#702)', () => {
    expect(() =>
      boardOrphans(
        ARGS,
        ENV,
        reads({ items: [rawIssue(12, 'Todo')], failing: 'allClosed' }),
      ),
    ).toThrow('could not read the closed pull requests: HTTP 502: Bad Gateway');
  });

  it("refuses a closed pull request list without develop's head, its known positive (#702)", () => {
    expect(() =>
      boardOrphans(
        ARGS,
        ENV,
        reads({ items: [rawIssue(12, 'Todo')], allClosed: [] }),
      ),
    ).toThrow(
      `the closed pull requests read holds no merged pull request for develop's head ${DEVELOP_SHA}, so it is not the whole list`,
    );
  });

  it('refuses a develop branch entry with no commit SHA (#702)', () => {
    const r = reads({ items: [rawIssue(12, 'Todo')] });
    const repo: Gh = (args) =>
      same(args, BRANCHES_CALL)
        ? JSON.stringify([[{ name: 'develop', commit: {} }]])
        : r.repo(args);
    expect(() => boardOrphans(ARGS, ENV, { ...r, repo })).toThrow(
      'could not read the branches: develop has no commit SHA',
    );
  });

  const withClosed = (entry: unknown) => () =>
    boardOrphans(
      ARGS,
      ENV,
      reads({ items: [rawIssue(12, 'Todo')], allClosed: [developPull, entry] }),
    );
  const CLOSED_SHAPE =
    'could not read the closed pull requests: an entry has no number, merged_at, merge_commit_sha, head branch and head repository';
  const closedWithout = (key: keyof ClosedPull) =>
    Object.fromEntries(
      Object.entries(mergedPull(850, 'x/1-y')).filter(([k]) => k !== key),
    );

  it('refuses a closed pull request entry with no number (#702)', () => {
    expect(withClosed(closedWithout('number'))).toThrow(CLOSED_SHAPE);
  });

  it('refuses a closed pull request entry with no merged_at field (#702)', () => {
    expect(withClosed(closedWithout('merged_at'))).toThrow(CLOSED_SHAPE);
  });

  it('refuses a closed pull request entry with no merge_commit_sha field (#702)', () => {
    expect(withClosed(closedWithout('merge_commit_sha'))).toThrow(CLOSED_SHAPE);
  });

  it('refuses a closed pull request entry with no head branch (#702)', () => {
    const entry = { ...mergedPull(850, 'x/1-y'), head: { repo: null } };
    expect(withClosed(entry)).toThrow(CLOSED_SHAPE);
  });

  it('refuses a closed pull request entry with no head repository field (#702)', () => {
    const entry = { ...mergedPull(850, 'x/1-y'), head: { ref: 'x/1-y' } };
    expect(withClosed(entry)).toThrow(CLOSED_SHAPE);
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
        'No orphans: 1 ticket In Progress, each named. Read 1 board item, 2 branches, 1 open pull request, 1 merged pull request.',
        '#12: branch board/12-orphan-check',
      ],
    });
  });
});
