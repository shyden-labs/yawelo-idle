import { describe, expect, it } from 'vitest';
import {
  BOARD_QUERY,
  formatLines,
  parseItems,
  progress,
  REPO_ISSUES_QUERY,
} from '../../packages/progress/src/index';
import {
  boardPages,
  FIXTURE_BOARD_ID,
  FIXTURE_REPO,
  FIXTURE_TITLE,
  repoPages,
} from '../../packages/progress/test/board-fixture';
import { boardProgress, type Gh } from '../../scripts/board-progress';

/**
 * scripts/board-progress.ts (#340), its work in-process with `gh` stood in:
 * a unit test starts no process (global rule, 2026-10-08; #490). The script
 * run under Node with a stand-in `gh` on PATH is in
 * tests/integration/board-progress.test.ts.
 */

const NODE_ID = FIXTURE_BOARD_ID;
// Not the clock's day: a function that read the clock would give other lines.
const TODAY = '2026-01-15';

/**
 * A `gh` that records each call's arguments and prints the board's pages,
 * or the repository's issues for REPO_ISSUES_QUERY (#751).
 */
function ghPrinting(
  pages: unknown[],
  issues: unknown[] = repoPages(),
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

describe('boardProgress (#340, in-process since #490)', () => {
  it('gives the same two lines as a direct module call on the shared fixture', () => {
    const pages = boardPages(TODAY);
    const { gh } = ghPrinting(pages);
    expect(
      boardProgress([NODE_ID, FIXTURE_TITLE, FIXTURE_REPO], gh, TODAY),
    ).toEqual(
      formatLines(progress(parseItems(pages, FIXTURE_REPO), TODAY), TODAY),
    );
  });

  it('asks gh for every page of the board it was given, then of the repository’s issues, each slurped into one array', () => {
    const { gh, calls } = ghPrinting(boardPages(TODAY));
    boardProgress([NODE_ID, FIXTURE_TITLE, FIXTURE_REPO], gh, TODAY);
    expect(calls).toEqual([
      [
        'api',
        'graphql',
        '--paginate',
        '--slurp',
        '-f',
        `query=${BOARD_QUERY}`,
        '-f',
        `id=${NODE_ID}`,
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
        'name=fixture',
      ],
    ]);
  });

  // GitHub's incident of 2026-10-22: the board's listing and its own count
  // shrank together, so the whole-board check (#703) agreed with them.
  it('refuses a board listing short of the issues the repository names on it, giving no line (#751)', () => {
    const pages = boardPages(TODAY) as {
      data: { node: { items: { totalCount: number; nodes: unknown[] } } };
    }[];
    const last = pages.at(-1);
    last?.data.node.items.nodes.pop();
    for (const page of pages) page.data.node.items.totalCount = 8;
    const { gh } = ghPrinting(pages);
    expect(() =>
      boardProgress([NODE_ID, FIXTURE_TITLE, FIXTURE_REPO], gh, TODAY),
    ).toThrow(
      'the board lists 8 of shyden-labs/fixture’s issues and the repository’s own issues (Repository.issues) name 9 on it; missing from the board’s listing: #9: nothing read',
    );
  });

  it('refuses a short read of the repository’s issues, giving no line (#751)', () => {
    const { gh } = ghPrinting(boardPages(TODAY), repoPages().slice(0, 1));
    expect(() =>
      boardProgress([NODE_ID, FIXTURE_TITLE, FIXTURE_REPO], gh, TODAY),
    ).toThrow('the repository has 11 issues and 6 were read: nothing read');
  });

  it('refuses a repository not written owner/name, before calling gh (#751)', () => {
    const gh: Gh = () => {
      throw new Error('gh was called');
    };
    expect(() =>
      boardProgress([NODE_ID, FIXTURE_TITLE, 'fixture'], gh, TODAY),
    ).toThrow('the repository is "fixture", not owner/name');
  });

  it('refuses a board with another title, giving no line', () => {
    const { gh } = ghPrinting(boardPages(TODAY));
    expect(() =>
      boardProgress([NODE_ID, 'ShyTalk Stories', FIXTURE_REPO], gh, TODAY),
    ).toThrow(
      'the board is "Fixture Stories", not "ShyTalk Stories": nothing read',
    );
  });

  it('reads shyden-labs/yawelo-idle when no repository is given (#341)', () => {
    const { gh } = ghPrinting(boardPages(TODAY));
    expect(() => boardProgress([NODE_ID, FIXTURE_TITLE], gh, TODAY)).toThrow(
      '#1 is an issue of shyden-labs/fixture, not shyden-labs/yawelo-idle: remove it from the board',
    );
  });

  it('refuses to run without a node id and a title, before calling gh', () => {
    // A gh called first would throw its own error, not the usage line.
    const gh: Gh = () => {
      throw new Error('gh was called');
    };
    expect(() => boardProgress([NODE_ID], gh, TODAY)).toThrow(
      'usage: node scripts/board-progress.ts <board-node-id> "<board title>" [owner/repo]',
    );
  });

  it('refuses a read missing a page, giving no line (#703)', () => {
    const { gh } = ghPrinting(boardPages(TODAY).slice(0, 1));
    expect(() =>
      boardProgress([NODE_ID, FIXTURE_TITLE, FIXTURE_REPO], gh, TODAY),
    ).toThrow('the board has 9 items and 5 were read: nothing read');
  });

  it('fails, giving no line, when gh fails', () => {
    const gh: Gh = () => {
      throw new Error('gh: HTTP 502');
    };
    expect(() =>
      boardProgress([NODE_ID, FIXTURE_TITLE, FIXTURE_REPO], gh, TODAY),
    ).toThrow('gh: HTTP 502');
  });
});
