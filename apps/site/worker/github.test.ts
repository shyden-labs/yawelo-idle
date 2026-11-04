import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBoardAndIssues } from './github';

/**
 * The roadmap's read asks GitHub for the board's pages and the repository's
 * issue pages at the same time (#850): read one after the other they took
 * about 11 s of the 13-15 s from an edit to the open page. GitHub's answers
 * are held here, so the test sees which requests are out at once.
 */

interface Held {
  query: string;
  answer: (body: unknown) => void;
}

let held: Held[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  held = [];
});

function holdEveryRequest(): void {
  vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
    const { query } = JSON.parse(init.body) as { query: string };
    return new Promise<Response>((resolve) => {
      held.push({
        query,
        answer: (body) => {
          resolve(Response.json(body));
        },
      });
    });
  });
}

const LAST = { hasNextPage: false, endCursor: null };
const boardPage = { data: { node: { items: { pageInfo: LAST } } } };
const issuesPage = { data: { repository: { issues: { pageInfo: LAST } } } };
const isIssues = (h: Held) => h.query.includes('issues(');

/** Lets every request the read can send before an answer go out. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('readBoardAndIssues (#850)', () => {
  it('asks for the first board page and the first issue page at once', async () => {
    holdEveryRequest();
    const reading = readBoardAndIssues('token', 'PVT_board', 'owner', 'repo');
    await settle();
    expect(held.map(isIssues).sort()).toEqual([false, true]);
    held.forEach((h) => {
      h.answer(isIssues(h) ? issuesPage : boardPage);
    });
    await reading;
  });

  it('returns the board’s pages and the issue pages, each as GitHub sent them', async () => {
    holdEveryRequest();
    const reading = readBoardAndIssues('token', 'PVT_board', 'owner', 'repo');
    await settle();
    held.forEach((h) => {
      h.answer(isIssues(h) ? issuesPage : boardPage);
    });
    expect(await reading).toEqual({ board: [boardPage], issues: [issuesPage] });
  });

  it('fails the read when the issue pages fail, naming why', async () => {
    holdEveryRequest();
    const reading = readBoardAndIssues('token', 'PVT_board', 'owner', 'repo');
    await settle();
    held.forEach((h) => {
      h.answer(
        isIssues(h) ? { errors: [{ message: 'issues broke' }] } : boardPage,
      );
    });
    await expect(reading).rejects.toThrow(
      'GitHub’s GraphQL answered with errors: issues broke',
    );
  });

  it('fails the read when the board pages fail, naming why', async () => {
    holdEveryRequest();
    const reading = readBoardAndIssues('token', 'PVT_board', 'owner', 'repo');
    await settle();
    held.forEach((h) => {
      h.answer(isIssues(h) ? issuesPage : { data: { node: null } });
    });
    await expect(reading).rejects.toThrow('GitHub found no board PVT_board');
  });
});
