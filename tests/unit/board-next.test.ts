import { describe, expect, it } from 'vitest';
import {
  boardNext,
  NEXT_QUERY,
  nextTicket,
  offBoardBlockers,
  type NextItem,
  parseNextItems,
} from '../../scripts/board-next';
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

/** One board page as GitHub returns it, holding these item nodes. */
function page(nodes: unknown[], title = TITLE): unknown {
  return { data: { node: { title, items: { nodes } } } };
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

describe('boardNext (#576)', () => {
  /** A `gh` that records each call and prints the given pages. */
  function ghPrinting(pages: unknown[]): { gh: Gh; calls: string[][] } {
    const calls: string[][] = [];
    return {
      calls,
      gh: (args) => {
        calls.push([...args]);
        return JSON.stringify(pages);
      },
    };
  }

  it('asks gh once for every page of the board, slurped into one array', () => {
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
    const { gh } = ghPrinting([page([])]);
    expect(boardNext(['PVT_fixture', TITLE], gh).line).toBe(
      'Next: nothing is open.',
    );
  });

  it('refuses before calling gh when the title is missing', () => {
    const { gh } = ghPrinting([]);
    expect(() => boardNext(['PVT_fixture'], gh)).toThrow(
      'usage: node scripts/board-next.ts <board-node-id> "<board title>"',
    );
  });

  it('calls gh for nothing when the title is missing, and once when it is given', () => {
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
