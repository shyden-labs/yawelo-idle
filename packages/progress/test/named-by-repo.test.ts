import { describe, expect, it } from 'vitest';
import { assertNamedByRepo, REPO_ISSUES_QUERY } from '../src/index.ts';
import {
  boardPages,
  FIXTURE_BOARD_ID,
  FIXTURE_REPO,
  repoPages,
} from './board-fixture.ts';

/**
 * A partial board from GitHub must never pass as the whole board (#751).
 * During GitHub's incident of 2026-10-22 the board's listing and its own
 * items.totalCount shrank together (0 for 0, then 91 for 91), so #703's
 * check agreed with the short read; on 2026-10-23 the listing still left
 * out #752 (463 of 463) while the repository's issues named 464 on the
 * board. The cross-check reads the repository's issues, a different GitHub
 * surface, and compares the two as sets of issue numbers.
 */

const TODAY = '2026-10-23';

type Card = { content: Record<string, unknown> | null };
type BoardPages = {
  data: { node: { items: { totalCount: number; nodes: Card[] } } };
}[];
type Issue = {
  number: number;
  projectItems: { totalCount: number; nodes: { project: { id: string } }[] };
};
type RepoPages = {
  data: { repository: { issues: { totalCount?: unknown; nodes: Issue[] } } };
}[];

const board = (): BoardPages => boardPages(TODAY) as BoardPages;
const repo = (): RepoPages => repoPages() as RepoPages;

/** Cut the board's listing to the issues kept, its count shrinking with it, as GitHub's did. */
function listingOf(keep: (number: number) => boolean): BoardPages {
  const pages = board();
  for (const page of pages)
    page.data.node.items.nodes = page.data.node.items.nodes.filter((card) =>
      keep(Number(card.content?.number)),
    );
  const total = pages.reduce(
    (sum, page) => sum + page.data.node.items.nodes.length,
    0,
  );
  for (const page of pages) page.data.node.items.totalCount = total;
  return pages;
}

/** Add a card to the board's last page, its count growing with it. */
function withCard(pages: BoardPages, content: Card['content']): BoardPages {
  pages.at(-1)?.data.node.items.nodes.push({ content });
  for (const page of pages) page.data.node.items.totalCount += 1;
  return pages;
}

const issueCard = (
  number: number,
  nameWithOwner = FIXTURE_REPO,
): Card['content'] => ({
  __typename: 'Issue',
  number,
  repository: { nameWithOwner },
});

describe('assertNamedByRepo (#751)', () => {
  it('passes a board listing exactly the issues the repository names on it', () => {
    expect(() => {
      assertNamedByRepo(board(), repo(), FIXTURE_BOARD_ID, FIXTURE_REPO);
    }).not.toThrow();
  });

  it('refuses a listing short of the repository, its own count agreeing with it, naming the missing issue', () => {
    expect(() => {
      assertNamedByRepo(
        listingOf((number) => number !== 9),
        repo(),
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).toThrow(
      'the board lists 8 of shyden-labs/fixture’s issues and the repository’s own issues (Repository.issues) name 9 on it; missing from the board’s listing: #9: nothing read',
    );
  });

  it('refuses an empty listing, naming every missing issue', () => {
    expect(() => {
      assertNamedByRepo(
        listingOf(() => false),
        repo(),
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).toThrow(
      'the board lists 0 of shyden-labs/fixture’s issues and the repository’s own issues (Repository.issues) name 9 on it; missing from the board’s listing: #1, #2, #3, #4, #5, #6, #7, #8, #9: nothing read',
    );
  });

  it('names the first ten missing issues and counts the rest', () => {
    const pages = repo();
    const extra = Array.from({ length: 3 }, (_, at) => ({
      number: 20 + at,
      projectItems: {
        totalCount: 1,
        nodes: [{ project: { id: FIXTURE_BOARD_ID } }],
      },
    }));
    pages.at(-1)?.data.repository.issues.nodes.push(...extra);
    for (const page of pages) page.data.repository.issues.totalCount = 14;
    expect(() => {
      assertNamedByRepo(
        listingOf(() => false),
        pages,
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).toThrow(
      'missing from the board’s listing: #1, #2, #3, #4, #5, #6, #7, #8, #9, #20 and 2 more: nothing read',
    );
  });

  // The two reads are not one snapshot: a card added between them shows as
  // one side's extra. It is refused all the same, and the next read is whole.
  it('refuses a card for an issue the repository does not name on the board', () => {
    expect(() => {
      assertNamedByRepo(
        withCard(board(), issueCard(10)),
        repo(),
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).toThrow(
      'the board lists 10 of shyden-labs/fixture’s issues and the repository’s own issues (Repository.issues) name 9 on it; on the board but named by no issue: #10 (a card added or removed between the two reads shows this way too): nothing read',
    );
  });

  it('names both sides when the listing misses one issue and holds another', () => {
    expect(() => {
      assertNamedByRepo(
        withCard(
          listingOf((number) => number !== 4),
          issueCard(11),
        ),
        repo(),
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).toThrow(
      'name 9 on it; missing from the board’s listing: #4; on the board but named by no issue: #11',
    );
  });

  it('compares only this repository’s issues: a card from another repository passes', () => {
    expect(() => {
      assertNamedByRepo(
        withCard(board(), issueCard(10, 'shyden-labs/elsewhere')),
        repo(),
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).not.toThrow();
  });

  it('compares only issues: a draft card passes', () => {
    expect(() => {
      assertNamedByRepo(
        withCard(board(), { __typename: 'DraftIssue', title: 'An idea' }),
        repo(),
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).not.toThrow();
  });

  // A draft has no repository, so only a pull request of this repository
  // shows that the comparison reads the card's type.
  it('compares only issues: a pull request card from this repository passes', () => {
    expect(() => {
      assertNamedByRepo(
        withCard(board(), {
          __typename: 'PullRequest',
          number: 30,
          repository: { nameWithOwner: FIXTURE_REPO },
        }),
        repo(),
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).not.toThrow();
  });

  it('refuses when the repository names no issue on the board at all', () => {
    const pages = repo();
    for (const page of pages)
      for (const issue of page.data.repository.issues.nodes)
        issue.projectItems = { totalCount: 0, nodes: [] };
    expect(() => {
      assertNamedByRepo(
        listingOf(() => false),
        pages,
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).toThrow(
      'the repository’s own issues (Repository.issues) name no issue on board PVT_fixture: nothing read',
    );
  });

  it('refuses a short read of the repository’s issues, giving both numbers', () => {
    const pages = repo();
    pages.at(-1)?.data.repository.issues.nodes.pop();
    expect(() => {
      assertNamedByRepo(board(), pages, FIXTURE_BOARD_ID, FIXTURE_REPO);
    }).toThrow('the repository has 11 issues and 10 were read: nothing read');
  });

  it('refuses a read missing a page of the repository’s issues', () => {
    expect(() => {
      assertNamedByRepo(
        board(),
        repo().slice(0, 1),
        FIXTURE_BOARD_ID,
        FIXTURE_REPO,
      );
    }).toThrow('the repository has 11 issues and 6 were read: nothing read');
  });

  it('refuses no page of the repository’s issues', () => {
    expect(() => {
      assertNamedByRepo(board(), [], FIXTURE_BOARD_ID, FIXTURE_REPO);
    }).toThrow('no page of the repository’s issues came back: nothing read');
  });

  it('refuses a page of the repository’s issues that gives no count', () => {
    const pages = repo();
    const first = pages[0];
    expect(first).toBeDefined();
    if (first !== undefined) delete first.data.repository.issues.totalCount;
    expect(() => {
      assertNamedByRepo(board(), pages, FIXTURE_BOARD_ID, FIXTURE_REPO);
    }).toThrow(
      'a page of the repository’s issues came back without their count (issues.totalCount): nothing read',
    );
  });

  it('names a repository whose issues changed while they were read', () => {
    const pages = repo();
    const second = pages[1];
    expect(second).toBeDefined();
    if (second !== undefined) second.data.repository.issues.totalCount = 12;
    expect(() => {
      assertNamedByRepo(board(), pages, FIXTURE_BOARD_ID, FIXTURE_REPO);
    }).toThrow(
      'the repository’s issues changed while they were read (its pages report 11, then 12): nothing read',
    );
  });

  it('refuses an issue on more boards than were read', () => {
    const pages = repo();
    const third = pages[0]?.data.repository.issues.nodes[2];
    expect(third?.number).toBe(3);
    if (third !== undefined) third.projectItems.totalCount = 11;
    expect(() => {
      assertNamedByRepo(board(), pages, FIXTURE_BOARD_ID, FIXTURE_REPO);
    }).toThrow(
      '#3 is on 11 boards and 2 were read: raise projectItems(first:) in REPO_ISSUES_QUERY: nothing read',
    );
  });
});

describe('REPO_ISSUES_QUERY (#751)', () => {
  it('reads each issue’s boards by id, archived cards left out as the board’s listing leaves them', () => {
    expect(REPO_ISSUES_QUERY).toMatch(
      /projectItems\(first: \d+, includeArchived: false\) \{ totalCount nodes \{ project \{ id \} \} \}/,
    );
  });

  it('pages the repository’s issues with their count', () => {
    expect(REPO_ISSUES_QUERY).toMatch(
      /issues\(first: 100, after: \$endCursor\) \{ totalCount pageInfo \{ hasNextPage endCursor \}/,
    );
  });
});
