import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * Every board reader checks the board's listing against the issues the
 * repository names on it (#751 AC4), each row predicted before its first
 * run: each of assertNamedByRepo's refusals dropped in turn, each script
 * reading without it, and a row for each test helper the change touched
 * (#659). Unit-suite mutations; the roadmap Worker's own case is
 * 751-roadmap-cross-check.ts. contract.ts changed only by types
 * (FakeConfig.repoPages, Seen.query), which no mutation can reach at run
 * time; its runtime row is 703-roadmap-reads-whole.ts's.
 */

const NAMED = 'packages/progress/test/named-by-repo.test.ts';
const CHECK = `${NAMED} › assertNamedByRepo (#751) >`;
const QUERY = `${NAMED} › REPO_ISSUES_QUERY (#751) >`;
const NEXT = 'tests/unit/board-next.test.ts';
const NEXT_SCRIPT = `${NEXT} › boardNext (#576) >`;
const ORPHANS = 'tests/unit/board-orphans.test.ts';
const ORPHANS_CLOSED = `${ORPHANS} › boardOrphans fails closed when it cannot look (#580 AC2, AC3) >`;
const PROGRESS_SCRIPT = 'tests/unit/board-progress.test.ts';
const PROGRESS_RUN = `${PROGRESS_SCRIPT} › boardProgress (#340, in-process since #490) >`;
const NOTHING_THROWN = 'to throw an error';
const THROWN_ANYWAY = 'to not throw an error';
/** The fixture's repository then counts 12 issues and serves 11. */
const COUNTED_HIGH = 'the repository has 12';
const PROGRESS_FILE = 'packages/progress/src/index.ts';

export default mutationFile({
  targets: [NAMED, NEXT, ORPHANS, PROGRESS_SCRIPT],
  mutations: [
    {
      // No pages: no count, so the short-read check compares 0 with NaN.
      name: 'no-repo-pages-pass',
      file: PROGRESS_FILE,
      anchor: '  if (repoPages.length === 0)\n',
      replacement: '  if (false)\n',
      red: {
        [`${CHECK} refuses no page of the repository’s issues`]:
          'the repository has undefined',
      },
    },
    {
      // An uncounted page then reaches the change check, naming its count.
      name: 'repo-count-unchecked',
      file: PROGRESS_FILE,
      anchor:
        "  if (!counts.every((count) => Number.isInteger(count)))\n    throw new Error(\n      'a page of the repository’s",
      replacement:
        "  if (false)\n    throw new Error(\n      'a page of the repository’s",
      red: {
        [`${CHECK} refuses a page of the repository’s issues that gives no count`]:
          'the repository’s issues changed',
      },
    },
    {
      // The first page's count matches the 11 read, so nothing is refused.
      name: 'repo-change-unnamed',
      file: PROGRESS_FILE,
      anchor:
        '  if (seen.length > 1)\n    throw new Error(\n      `the repository’s issues changed',
      replacement:
        '  if (false)\n    throw new Error(\n      `the repository’s issues changed',
      red: {
        [`${CHECK} names a repository whose issues changed while they were read`]:
          NOTHING_THROWN,
      },
    },
    {
      // #11, the issue dropped from the short read, names no board, so the
      // comparison passes; a missing page leaves #7 to #9 named by no issue.
      name: 'repo-short-read-passes',
      file: PROGRESS_FILE,
      anchor: '  if (issues.length !== Number(counts[0]))\n',
      replacement: '  if (false)\n',
      red: {
        [`${CHECK} refuses a short read of the repository’s issues, giving both numbers`]:
          NOTHING_THROWN,
        [`${CHECK} refuses a read missing a page of the repository’s issues`]:
          'the board lists 9 of',
        [`${PROGRESS_RUN} refuses a short read of the repository’s issues, giving no line (#751)`]:
          'the board lists 9 of',
      },
    },
    {
      // #3's boards are read only in part, but the fixture board is among them.
      name: 'boards-per-issue-unchecked',
      file: PROGRESS_FILE,
      anchor: '    if (items.totalCount > items.nodes.length)\n',
      replacement: '    if (false)\n',
      red: {
        [`${CHECK} refuses an issue on more boards than were read`]:
          NOTHING_THROWN,
      },
    },
    {
      // An empty listing then agrees with a repository naming nothing.
      name: 'named-none-passes',
      file: PROGRESS_FILE,
      anchor: '  if (named.size === 0)\n',
      replacement: '  if (false)\n',
      red: {
        [`${CHECK} refuses when the repository names no issue on the board at all`]:
          NOTHING_THROWN,
      },
    },
    {
      name: 'listing-mismatch-passes',
      file: PROGRESS_FILE,
      anchor: '  if (missing.length === 0 && extra.length === 0) return;\n',
      replacement: '  return;\n',
      red: {
        [`${CHECK} refuses a listing short of the repository, its own count agreeing with it, naming the missing issue`]:
          NOTHING_THROWN,
        [`${CHECK} refuses an empty listing, naming every missing issue`]:
          NOTHING_THROWN,
        [`${CHECK} names the first ten missing issues and counts the rest`]:
          NOTHING_THROWN,
        [`${CHECK} refuses a card for an issue the repository does not name on the board`]:
          NOTHING_THROWN,
        [`${CHECK} names both sides when the listing misses one issue and holds another`]:
          NOTHING_THROWN,
        [`${NEXT_SCRIPT} refuses an empty board read, never saying nothing is open (#751)`]:
          NOTHING_THROWN,
        [`${NEXT_SCRIPT} refuses a listing short of the repository’s issues, its own count agreeing, naming no ticket (#751)`]:
          NOTHING_THROWN,
        [`${PROGRESS_RUN} refuses a board listing short of the issues the repository names on it, giving no line (#751)`]:
          NOTHING_THROWN,
        [`${ORPHANS_CLOSED} refuses a listing short of the repository’s issues, its own count agreeing, judging no orphan (#751)`]:
          NOTHING_THROWN,
      },
    },
    {
      // Nine missing are all shown; ten of twelve are cut at nine.
      name: 'refusal-names-nine',
      file: PROGRESS_FILE,
      anchor: 'const NAMED_IN_A_REFUSAL = 10;\n',
      replacement: 'const NAMED_IN_A_REFUSAL = 9;\n',
      red: {
        [`${CHECK} names the first ten missing issues and counts the rest`]:
          'the board lists 0 of',
      },
    },
    {
      // Another repository's card is then counted as one no issue names.
      name: 'cross-check-reads-every-repository',
      file: PROGRESS_FILE,
      anchor:
        '        content.repository?.nameWithOwner === repo &&\n        content.number !== undefined\n          ? [content.number]',
      replacement:
        '        content.number !== undefined\n          ? [content.number]',
      red: {
        [`${CHECK} compares only this repository’s issues: a card from another repository passes`]:
          THROWN_ANYWAY,
        [`${ORPHANS_CLOSED} refuses a ticket In Progress from another repository, whose branches it does not read`]:
          'could not read the board',
      },
    },
    {
      // This repository's pull request is then counted as one no issue names.
      name: 'cross-check-counts-pull-requests',
      file: PROGRESS_FILE,
      anchor:
        "        content?.__typename === 'Issue' &&\n        content.repository?.nameWithOwner === repo &&\n        content.number !== undefined\n          ? [content.number]",
      replacement:
        '        content?.repository?.nameWithOwner === repo &&\n        content.number !== undefined\n          ? [content.number]',
      red: {
        [`${CHECK} compares only issues: a pull request card from this repository passes`]:
          THROWN_ANYWAY,
      },
    },
    {
      name: 'issues-query-uncounted',
      file: PROGRESS_FILE,
      anchor: 'issues(first: 100, after: $endCursor) { totalCount pageInfo {',
      replacement: 'issues(first: 100, after: $endCursor) { pageInfo {',
      red: {
        [`${QUERY} pages the repository’s issues with their count`]: 'to match',
      },
    },
    {
      // Archived cards would then name a board whose listing leaves them out.
      name: 'issues-query-reads-archived-cards',
      file: PROGRESS_FILE,
      anchor: ', includeArchived: false)',
      replacement: ')',
      red: {
        [`${QUERY} reads each issue’s boards by id, archived cards left out as the board’s listing leaves them`]:
          'to match',
      },
    },
    {
      // board-next then reads no repository: one gh call, nothing refused.
      name: 'next-unchecked',
      file: 'scripts/board-next.ts',
      anchor:
        '  assertNamedByRepo(pages, repoIssuePages(gh, repo), id, repo);\n',
      replacement: '',
      red: {
        [`${NEXT_SCRIPT} asks gh for every page of the board, then of the repository’s issues, each slurped into one array`]:
          'to deeply equal',
        [`${NEXT_SCRIPT} refuses an empty board read, never saying nothing is open (#751)`]:
          NOTHING_THROWN,
        [`${NEXT_SCRIPT} refuses a listing short of the repository’s issues, its own count agreeing, naming no ticket (#751)`]:
          NOTHING_THROWN,
        [`${NEXT_SCRIPT} reads the repository it is given (#751)`]:
          'expected undefined to deeply equal',
      },
    },
    {
      // board-progress still checks owner/name first, then reads no repository.
      name: 'progress-unchecked',
      file: 'scripts/board-progress.ts',
      anchor:
        '  assertNamedByRepo(pages, repoIssuePages(gh, repo), id, repo);\n',
      replacement: '',
      red: {
        [`${PROGRESS_RUN} asks gh for every page of the board it was given, then of the repository’s issues, each slurped into one array`]:
          'to deeply equal',
        [`${PROGRESS_RUN} refuses a board listing short of the issues the repository names on it, giving no line (#751)`]:
          NOTHING_THROWN,
        [`${PROGRESS_RUN} refuses a short read of the repository’s issues, giving no line (#751)`]:
          NOTHING_THROWN,
      },
    },
    {
      // The issues are still read, so only the short listing passes.
      name: 'orphans-unchecked',
      file: 'scripts/board-orphans.ts',
      anchor: '    assertNamedByRepo(board.pages, issuePages, id, repo);\n',
      replacement: '',
      red: {
        [`${ORPHANS_CLOSED} refuses a listing short of the repository’s issues, its own count agreeing, judging no orphan (#751)`]:
          NOTHING_THROWN,
      },
    },
    {
      // Helper (#659): every full read of the fixture's issues is then short
      // by its own count. Tests that set their own count, give none, or pass
      // no page are untouched, as are refusals made before the repository.
      name: 'fixture-repo-counts-one-high',
      file: 'packages/progress/test/board-fixture.ts',
      anchor:
        '  const totalCount = pages.flat().length;\n  return pages.map((issues) =>',
      replacement:
        '  const totalCount = pages.flat().length + 1;\n  return pages.map((issues) =>',
      red: {
        [`${CHECK} passes a board listing exactly the issues the repository names on it`]:
          THROWN_ANYWAY,
        [`${CHECK} refuses a listing short of the repository, its own count agreeing with it, naming the missing issue`]:
          COUNTED_HIGH,
        [`${CHECK} refuses an empty listing, naming every missing issue`]:
          COUNTED_HIGH,
        [`${CHECK} refuses a card for an issue the repository does not name on the board`]:
          COUNTED_HIGH,
        [`${CHECK} names both sides when the listing misses one issue and holds another`]:
          COUNTED_HIGH,
        [`${CHECK} compares only this repository’s issues: a card from another repository passes`]:
          THROWN_ANYWAY,
        [`${CHECK} compares only issues: a draft card passes`]: THROWN_ANYWAY,
        [`${CHECK} compares only issues: a pull request card from this repository passes`]:
          THROWN_ANYWAY,
        [`${CHECK} refuses when the repository names no issue on the board at all`]:
          COUNTED_HIGH,
        [`${CHECK} refuses a short read of the repository’s issues, giving both numbers`]:
          COUNTED_HIGH,
        [`${CHECK} refuses a read missing a page of the repository’s issues`]:
          COUNTED_HIGH,
        [`${CHECK} names a repository whose issues changed while they were read`]:
          COUNTED_HIGH,
        [`${CHECK} refuses an issue on more boards than were read`]:
          COUNTED_HIGH,
        [`${PROGRESS_RUN} gives the same two lines as a direct module call on the shared fixture`]:
          COUNTED_HIGH,
        [`${PROGRESS_RUN} asks gh for every page of the board it was given, then of the repository’s issues, each slurped into one array`]:
          COUNTED_HIGH,
        [`${PROGRESS_RUN} refuses a board listing short of the issues the repository names on it, giving no line (#751)`]:
          COUNTED_HIGH,
        [`${PROGRESS_RUN} refuses a short read of the repository’s issues, giving no line (#751)`]:
          COUNTED_HIGH,
      },
    },
    {
      // Helper (#659): the default issues then name nothing, so every
      // boardNext call left to them is refused before naming a ticket.
      name: 'next-helper-names-nothing',
      file: NEXT,
      anchor:
        '      board.data.node.items.nodes.map((node) => node.content.number),\n',
      replacement: '      [],\n',
      red: {
        [`${NEXT_SCRIPT} asks gh for every page of the board, then of the repository’s issues, each slurped into one array`]:
          'the repository’s own issues',
        [`${NEXT_SCRIPT} names the next ticket with its level, status and open blockers`]:
          'the repository’s own issues',
        [`${NEXT_SCRIPT} says when the next ticket is itself blocked (its blocker is an epic still open)`]:
          'the repository’s own issues',
        [`${NEXT_SCRIPT} gives a note for each blocker the board does not hold, beside the line`]:
          'the repository’s own issues',
        [`${NEXT_SCRIPT} says when nothing is open`]:
          'the repository’s own issues',
      },
    },
    {
      // Helper (#659): another repository's card is then named by the
      // repository too, so the board's listing is refused as short of it.
      name: 'orphans-helper-names-every-repository',
      file: ORPHANS,
      anchor:
        '    content.repository?.nameWithOwner === REPO &&\n    content.number !== undefined\n',
      replacement: '    content.number !== undefined\n',
      red: {
        [`${ORPHANS_CLOSED} refuses a ticket In Progress from another repository, whose branches it does not read`]:
          'could not read the board',
      },
    },
    {
      // Helper (#659): board pages are then served as the repository's
      // issues, which hold none.
      name: 'progress-helper-serves-the-board-twice',
      file: PROGRESS_SCRIPT,
      anchor:
        '        args.includes(`query=${REPO_ISSUES_QUERY}`) ? issues : pages,\n',
      replacement: '        pages,\n',
      red: {
        [`${PROGRESS_RUN} gives the same two lines as a direct module call on the shared fixture`]:
          'a page came back without',
        [`${PROGRESS_RUN} asks gh for every page of the board it was given, then of the repository’s issues, each slurped into one array`]:
          'a page came back without',
        [`${PROGRESS_RUN} refuses a board listing short of the issues the repository names on it, giving no line (#751)`]:
          'a page came back without',
        [`${PROGRESS_RUN} refuses a short read of the repository’s issues, giving no line (#751)`]:
          'a page came back without',
      },
    },
  ],
});
