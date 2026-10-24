import { describe, expect, it } from 'vitest';
import {
  boardNext,
  NEXT_QUERY,
  nextTicket,
  offBoardBlockers,
  type NextItem,
  parseNextItems,
} from '../../scripts/board-next';
import { REPO_ISSUES_QUERY } from '../../packages/progress/src/index';
import type { Gh } from '../../scripts/board-progress';
import { againstControl } from '../searched';

/**
 * scripts/board-next.ts (#576): the board's Priority, not the handover, names
 * the next ticket (operator 2026-10-12), and a blocker inherits the level of
 * what waits on it (operator 2026-10-13, #578). In-process with `gh` stood
 * in: a unit test starts no process.
 */

const TITLE = 'Yawelo Idle Stories';

/** An open, unblocked Todo issue at P3, created on day `day` of January. */
function item(number: number, over: Partial<NextItem> = {}): NextItem {
  return {
    number,
    title: `story ${String(number)}`,
    state: 'OPEN',
    createdAt: `2026-01-${String(10 + (number % 20)).padStart(2, '0')}T00:00:00Z`,
    status: 'Todo',
    priority: 'P3',
    repository: 'shyden-labs/yawelo-idle',
    blockedBy: [],
    openSubIssues: 0,
    ...over,
  };
}

describe('nextTicket orders by the board (#576)', () => {
  it('takes the highest Priority first', () => {
    const items = [item(1, { priority: 'P3' }), item(2, { priority: 'P2' })];
    expect(nextTicket(items)?.number).toBe(2);
  });

  it('within a level, takes In Progress before Todo', () => {
    const items = [item(1), item(2, { status: 'In Progress' })];
    expect(nextTicket(items)?.number).toBe(2);
  });

  it('within a level and status, takes an unblocked ticket before an older blocked one', () => {
    const items = [
      item(1, {
        createdAt: '2026-01-01T00:00:00Z',
        blockedBy: [{ number: 3, repository: 'shyden-labs/yawelo-idle' }],
      }),
      item(2, { createdAt: '2026-01-20T00:00:00Z' }),
      item(3, { createdAt: '2026-01-21T00:00:00Z' }),
    ];
    expect(nextTicket(items)?.number).toBe(2);
  });

  it('then takes the oldest', () => {
    const items = [
      item(1, { createdAt: '2026-01-20T00:00:00Z' }),
      item(2, { createdAt: '2026-01-05T00:00:00Z' }),
    ];
    expect(nextTicket(items)?.number).toBe(2);
  });

  it('then takes the lowest number when created at the same moment', () => {
    const at = '2026-01-05T00:00:00Z';
    const items = [item(9, { createdAt: at }), item(4, { createdAt: at })];
    expect(nextTicket(items)?.number).toBe(4);
  });

  it('passes over an epic that has open sub-issues', () => {
    const items = [
      item(1, { priority: 'P2', openSubIssues: 3 }),
      item(2, { priority: 'P3' }),
    ];
    expect(nextTicket(items)?.number).toBe(2);
  });

  it('names an epic with no open sub-issues, since it needs breaking down', () => {
    const items = [item(1, { priority: 'P2', openSubIssues: 0 }), item(2)];
    expect(nextTicket(items)?.number).toBe(1);
  });

  it('ignores closed issues', () => {
    const items = [item(1, { priority: 'P0', state: 'CLOSED' }), item(2)];
    expect(nextTicket(items)?.number).toBe(2);
  });

  it('gives null when nothing is open', () => {
    expect(nextTicket([item(1, { state: 'CLOSED' })])).toBeNull();
  });
});

describe('nextTicket refuses a board it cannot order (#576)', () => {
  it('names every open issue with no Priority', () => {
    const items = [
      item(1, { priority: null }),
      item(2),
      item(7, { priority: null }),
    ];
    expect(() => nextTicket(items)).toThrow(
      '2 open tickets have no Priority: #1, #7. Score them on the board first.',
    );
  });

  it('refuses a Priority that is not one of P0 to P5', () => {
    expect(() => nextTicket([item(1, { priority: 'P6' })])).toThrow(
      '#1 has Priority "P6", which is not one of P0, P1, P2, P3, P4, P5',
    );
  });

  it('refuses, naming each pair, while an open blocker sits below a ticket it blocks', () => {
    const blocked = (n: number) => [
      { number: n, repository: 'shyden-labs/yawelo-idle' },
    ];
    const items = [
      item(1, { priority: 'P4' }),
      item(2, { priority: 'P2', blockedBy: blocked(1) }),
      item(3, { priority: 'P3', blockedBy: blocked(1) }),
    ];
    expect(() => nextTicket(items)).toThrow(
      'A blocker takes at least the level of what waits on it (#578): #1 (P4) blocks #2 (P2); #1 (P4) blocks #3 (P3). Raise each blocker first.',
    );
  });

  it('accepts a blocker at the same level as the ticket it blocks', () => {
    const items = [
      item(1, { createdAt: '2026-01-25T00:00:00Z' }),
      item(2, {
        createdAt: '2026-01-01T00:00:00Z',
        blockedBy: [{ number: 1, repository: 'shyden-labs/yawelo-idle' }],
      }),
    ];
    expect(nextTicket(items)?.number).toBe(1);
  });

  it('picks past an open blocker that is not on the board (operator 2026-10-13)', () => {
    const items = [
      item(2, {
        blockedBy: [{ number: 40, repository: 'shyden-labs/yawelo-idle' }],
      }),
    ];
    expect(nextTicket(items)?.number).toBe(2);
  });

  it('does not read another repository’s #1 as this board’s #1 at a lower level', () => {
    const items = [
      item(1, { priority: 'P4' }),
      item(2, {
        priority: 'P3',
        blockedBy: [{ number: 1, repository: 'shyden-labs/repo-template' }],
      }),
    ];
    expect(nextTicket(items)?.number).toBe(2);
  });
});

describe('offBoardBlockers names each blocker the board does not hold (operator 2026-10-13)', () => {
  it('names a blocker of this repository missing from the board, and one from another repository', () => {
    const items = [
      item(1),
      item(2, {
        blockedBy: [
          { number: 40, repository: 'shyden-labs/yawelo-idle' },
          { number: 1, repository: 'shyden-labs/repo-template' },
          { number: 1, repository: 'shyden-labs/yawelo-idle' },
        ],
      }),
    ];
    expect(offBoardBlockers(items)).toEqual([
      'note: #2 is blocked by shyden-labs/yawelo-idle#40, which is not an open issue on this board',
      'note: #2 is blocked by shyden-labs/repo-template#1, which is not an open issue on this board',
    ]);
  });

  it('names nothing when every blocker is on the board', () => {
    const blockedBy = (n: number) => [
      { number: n, repository: 'shyden-labs/yawelo-idle' },
    ];
    expect(
      againstControl(
        (missing: number[]) =>
          offBoardBlockers([
            item(1),
            item(2, {
              blockedBy: [...blockedBy(1), ...missing.flatMap(blockedBy)],
            }),
          ]),
        { input: [], control: [40] },
      ),
    ).toEqual([]);
  });
});

/**
 * One board page as GitHub returns it, holding these item nodes, with the
 * board's item count (#703): by default a board these nodes are all of.
 */
function page(
  nodes: unknown[],
  title = TITLE,
  totalCount = nodes.length,
): unknown {
  return { data: { node: { title, items: { totalCount, nodes } } } };
}

/** A raw item node for an open issue. */
function rawIssue(number: number, over: Record<string, unknown> = {}): unknown {
  return {
    status: { name: 'Todo' },
    priority: { name: 'P3' },
    content: {
      __typename: 'Issue',
      number,
      title: `story ${String(number)}`,
      state: 'OPEN',
      createdAt: '2026-01-10T00:00:00Z',
      repository: { nameWithOwner: 'shyden-labs/yawelo-idle' },
      blockedBy: { totalCount: 0, nodes: [] },
      subIssuesSummary: { total: 0, completed: 0 },
      ...over,
    },
  };
}

describe('parseNextItems reads the board whole (#576)', () => {
  it('reads an issue with its status, Priority, open blockers and open sub-issues', () => {
    const node = rawIssue(5, {
      blockedBy: {
        totalCount: 2,
        nodes: [
          {
            number: 3,
            state: 'OPEN',
            repository: { nameWithOwner: 'shyden-labs/yawelo-idle' },
          },
          {
            number: 4,
            state: 'CLOSED',
            repository: { nameWithOwner: 'shyden-labs/yawelo-idle' },
          },
        ],
      },
      subIssuesSummary: { total: 5, completed: 2 },
    });
    expect(parseNextItems([page([node])], TITLE)).toEqual([
      {
        number: 5,
        title: 'story 5',
        state: 'OPEN',
        createdAt: '2026-01-10T00:00:00Z',
        status: 'Todo',
        priority: 'P3',
        repository: 'shyden-labs/yawelo-idle',
        blockedBy: [{ number: 3, repository: 'shyden-labs/yawelo-idle' }],
        openSubIssues: 3,
      },
    ]);
  });

  it('reads a missing Status or Priority as null', () => {
    const node = { ...(rawIssue(5) as object), status: null, priority: null };
    const [read] = parseNextItems([page([node])], TITLE);
    expect([read?.status, read?.priority]).toEqual([null, null]);
  });

  it('refuses a board item that is not an issue, naming it', () => {
    const draft = {
      status: null,
      priority: null,
      content: { __typename: 'DraftIssue', title: 'an idea' },
    };
    expect(() => parseNextItems([page([draft])], TITLE)).toThrow(
      '"an idea" is not an issue with a number, title, state and creation time: convert it, or remove it from the board',
    );
  });

  it('refuses an issue with more blockers than one read returns', () => {
    const node = rawIssue(5, { blockedBy: { totalCount: 51, nodes: [] } });
    expect(() => parseNextItems([page([node])], TITLE)).toThrow(
      '#5 has 51 blockers, more than the 50 one read returns',
    );
  });

  it('refuses a page whose board title differs', () => {
    expect(() => parseNextItems([page([], 'ShyTalk Stories')], TITLE)).toThrow(
      'ShyTalk Stories',
    );
  });
});

describe('parseNextItems refuses a read that is not the whole board (#703)', () => {
  it('asks GitHub how many items the board holds', () => {
    expect(NEXT_QUERY).toMatch(
      /\bitems\(first: 100, after: \$endCursor\) \{ totalCount pageInfo\b/,
    );
  });

  it('reads a whole board of two pages', () => {
    const read = parseNextItems(
      [
        page([rawIssue(1), rawIssue(2)], TITLE, 3),
        page([rawIssue(3)], TITLE, 3),
      ],
      TITLE,
    );
    expect(read.map((item) => item.number)).toEqual([1, 2, 3]);
  });

  it('refuses a short page, giving both numbers', () => {
    expect(() =>
      parseNextItems(
        [page([rawIssue(1)], TITLE, 3), page([rawIssue(3)], TITLE, 3)],
        TITLE,
      ),
    ).toThrow('the board has 3 items and 2 were read: nothing read');
  });

  it('refuses a read missing a page, giving both numbers', () => {
    expect(() =>
      parseNextItems([page([rawIssue(1), rawIssue(2)], TITLE, 3)], TITLE),
    ).toThrow('the board has 3 items and 2 were read: nothing read');
  });

  it('names a board that changed while it was read', () => {
    expect(() =>
      parseNextItems(
        [
          page([rawIssue(1), rawIssue(2)], TITLE, 3),
          page([rawIssue(3)], TITLE, 4),
        ],
        TITLE,
      ),
    ).toThrow(
      'the board changed while it was read (its pages report 3, then 4 items): nothing read',
    );
  });
});

describe('boardNext (#576)', () => {
  /**
   * The repository's issues as REPO_ISSUES_QUERY returns them, naming on the
   * board `numbers` (#751).
   */
  function issuesNaming(numbers: number[]): unknown[] {
    return [
      {
        data: {
          repository: {
            issues: {
              totalCount: numbers.length,
              nodes: numbers.map((number) => ({
                number,
                projectItems: {
                  totalCount: 1,
                  nodes: [{ project: { id: 'PVT_fixture' } }],
                },
              })),
            },
          },
        },
      },
    ];
  }

  /** The numbers of the issues on board pages built by `page`. */
  function cardedOn(pages: unknown[]): number[] {
    return (
      pages as {
        data: { node: { items: { nodes: { content: { number: number } }[] } } };
      }[]
    ).flatMap((board) =>
      board.data.node.items.nodes.map((node) => node.content.number),
    );
  }

  /**
   * A `gh` that records each call and prints the board's pages, or for
   * REPO_ISSUES_QUERY the repository's issues, by default naming exactly the
   * board's issues (#751).
   */
  function ghPrinting(
    pages: unknown[],
    issues: unknown[] = issuesNaming(cardedOn(pages)),
  ): { gh: Gh; calls: string[][] } {
    const calls: string[][] = [];
    return {
      calls,
      gh: (args) => {
        calls.push([...args]);
        return JSON.stringify(
          args.includes(`query=${REPO_ISSUES_QUERY}`) ? issues : pages,
        );
      },
    };
  }

  it('asks gh for every page of the board, then of the repository’s issues, each slurped into one array', () => {
    const { gh, calls } = ghPrinting([page([rawIssue(1)])]);
    boardNext(['PVT_fixture', TITLE], gh);
    expect(calls).toEqual([
      [
        'api',
        'graphql',
        '--paginate',
        '--slurp',
        '-f',
        `query=${NEXT_QUERY}`,
        '-f',
        'id=PVT_fixture',
      ],
      [
        'api',
        'graphql',
        '--paginate',
        '--slurp',
        '-f',
        `query=${REPO_ISSUES_QUERY}`,
        '-f',
        'owner=shyden-labs',
        '-f',
        'name=yawelo-idle',
      ],
    ]);
  });

  it('names the next ticket with its level, status and open blockers', () => {
    const blocked = rawIssue(2, {
      blockedBy: {
        totalCount: 1,
        nodes: [
          {
            number: 1,
            state: 'OPEN',
            repository: { nameWithOwner: 'shyden-labs/yawelo-idle' },
          },
        ],
      },
      createdAt: '2026-01-01T00:00:00Z',
    });
    const { gh } = ghPrinting([
      page([blocked, rawIssue(1, { createdAt: '2026-01-20T00:00:00Z' })]),
    ]);
    expect(boardNext(['PVT_fixture', TITLE], gh).line).toBe(
      'Next: #1 story 1 (P3, Todo).',
    );
  });

  it('says when the next ticket is itself blocked (its blocker is an epic still open)', () => {
    const blocked = rawIssue(2, {
      blockedBy: {
        totalCount: 1,
        nodes: [
          {
            number: 1,
            state: 'OPEN',
            repository: { nameWithOwner: 'shyden-labs/yawelo-idle' },
          },
        ],
      },
    });
    const epic = rawIssue(1, { subIssuesSummary: { total: 4, completed: 1 } });
    const { gh } = ghPrinting([page([blocked, epic])]);
    expect(boardNext(['PVT_fixture', TITLE], gh).line).toBe(
      'Next: #2 story 2 (P3, Todo, blocked by #1).',
    );
  });

  it('gives a note for each blocker the board does not hold, beside the line', () => {
    const blocked = rawIssue(2, {
      blockedBy: {
        totalCount: 1,
        nodes: [
          {
            number: 1,
            state: 'OPEN',
            repository: { nameWithOwner: 'shyden-labs/repo-template' },
          },
        ],
      },
    });
    const { gh } = ghPrinting([page([blocked])]);
    expect(boardNext(['PVT_fixture', TITLE], gh)).toEqual({
      line: 'Next: #2 story 2 (P3, Todo, blocked by #1).',
      notes: [
        'note: #2 is blocked by shyden-labs/repo-template#1, which is not an open issue on this board',
      ],
    });
  });

  it('says when nothing is open', () => {
    const { gh } = ghPrinting([page([rawIssue(1, { state: 'CLOSED' })])]);
    expect(boardNext(['PVT_fixture', TITLE], gh).line).toBe(
      'Next: nothing is open.',
    );
  });

  // GitHub's incident of 2026-10-22: board-next printed "Next: nothing is
  // open." from a board read of 0 items whose own count said 0.
  it('refuses an empty board read, never saying nothing is open (#751)', () => {
    const { gh } = ghPrinting([page([])], issuesNaming([1]));
    expect(() => boardNext(['PVT_fixture', TITLE], gh)).toThrow(
      'the board lists 0 of shyden-labs/yawelo-idle’s issues and the repository’s own issues (Repository.issues) name 1 on it; missing from the board’s listing: #1: nothing read',
    );
  });

  it('refuses a listing short of the repository’s issues, its own count agreeing, naming no ticket (#751)', () => {
    const p2 = { ...(rawIssue(2) as object), priority: { name: 'P2' } };
    const { gh } = ghPrinting([page([p2])], issuesNaming([1, 2]));
    expect(() => boardNext(['PVT_fixture', TITLE], gh)).toThrow(
      'missing from the board’s listing: #1: nothing read',
    );
  });

  it('reads the repository it is given (#751)', () => {
    const { gh, calls } = ghPrinting([page([])], issuesNaming([]));
    try {
      boardNext(['PVT_fixture', TITLE, 'shyden-labs/elsewhere'], gh);
    } catch {
      // An empty board is refused; this test reads the call made first.
    }
    expect(calls[1]?.slice(-4)).toEqual([
      '-f',
      'owner=shyden-labs',
      '-f',
      'name=elsewhere',
    ]);
  });

  it('refuses a repository not written owner/name, before calling gh (#751)', () => {
    const gh: Gh = () => {
      throw new Error('gh was called');
    };
    expect(() => boardNext(['PVT_fixture', TITLE, 'yawelo-idle'], gh)).toThrow(
      'the repository is "yawelo-idle", not owner/name',
    );
  });

  it('refuses a short read, naming no ticket (#703)', () => {
    // As on 2026-10-20: the board's P0 was not in the read, and a P2 was named.
    const p2 = { ...(rawIssue(2) as object), priority: { name: 'P2' } };
    const { gh } = ghPrinting([page([p2], TITLE, 2)]);
    expect(() => boardNext(['PVT_fixture', TITLE], gh)).toThrow(
      'the board has 2 items and 1 were read: nothing read',
    );
  });

  it('refuses before calling gh when the title is missing', () => {
    const { gh } = ghPrinting([]);
    expect(() => boardNext(['PVT_fixture'], gh)).toThrow(
      'usage: node scripts/board-next.ts <board-node-id> "<board title>" [owner/repo]',
    );
  });

  it('calls gh for nothing when the title is missing, and reads when it is given', () => {
    /** The gh calls made for the node id followed by `rest`, the refusal swallowed. */
    const callsWith = (rest: string[]) => {
      const { gh, calls } = ghPrinting([page([])]);
      try {
        boardNext(['PVT_fixture', ...rest], gh);
      } catch {
        // The refusal is the other test's; this one counts the calls.
      }
      return calls;
    };
    expect(againstControl(callsWith, { input: [], control: [TITLE] })).toEqual(
      [],
    );
  });
});
