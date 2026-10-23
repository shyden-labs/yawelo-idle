import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The roadmap Worker refuses a board listing short of the issues the
 * repository names on it, keeping its last good snapshot and reporting the
 * refusal on health (#751 AC3, AC4), each row predicted before its first
 * run, through the site's harness suite. The Worker shares
 * assertNamedByRepo, so its refusals are proved in the unit suite
 * (751-board-cross-check.ts); here, the Worker without the check, each of
 * readRepoIssuePages's own refusals dropped, and the fake GitHub (#659), the
 * one helper this change touched at run time.
 */

const ROADMAP = 'apps/site/test/roadmap/roadmap.test.ts';
const READING = `${ROADMAP} › reading the board >`;
const FAILED = `${ROADMAP} › a failed read >`;
const GITHUB = 'apps/site/test/roadmap/github.test.ts';
const ISSUES = `${GITHUB} › readRepoIssuePages (#751) >`;
const WORKER_GITHUB = 'apps/site/worker/github.ts';
/** What readRepoIssuePages refuses with once it follows no cursor. */
const NEVER_ENDS = 'has more than 20 pages of issues';

export default mutationFile({
  targets: [ROADMAP, GITHUB],
  mutations: [
    {
      // The short listing is then published, and replaces the good snapshot.
      name: 'roadmap-reads-no-repository',
      file: 'apps/site/worker/roadmap.ts',
      anchor:
        '      assertNamedByRepo(\n        pages,\n        await readRepoIssuePages(token, owner, name),\n        env.ROADMAP_BOARD_ID,\n        env.ROADMAP_REPO,\n      );\n',
      replacement: '',
      red: {
        [`${READING} refuses a listing short of the repository’s issues, its own count agreeing, keeping nothing from it (#751)`]:
          'to be +0',
        [`${FAILED} keeps the last good snapshot and reports the short listing on health (#751)`]:
          'expected 2 to be 1',
      },
    },
    {
      // An answer with errors carries no issues, refused under another name.
      name: 'issues-errors-unnamed',
      file: WORKER_GITHUB,
      anchor:
        '    })) as IssuesPage;\n    const first = page.errors?.[0];\n    if (first !== undefined)\n',
      replacement:
        '    })) as IssuesPage;\n    const first = page.errors?.[0];\n    if (false)\n',
      red: {
        [`${ISSUES} refuses an answer carrying GraphQL errors, naming the first`]:
          'GitHub found no issues',
        [`${ISSUES} refuses a repository GitHub does not know, by GitHub’s own error`]:
          'GitHub found no issues',
      },
    },
    {
      // A page without issues then fails reading its pageInfo.
      name: 'issues-missing-repository-unnamed',
      file: WORKER_GITHUB,
      anchor:
        '    if (pageInfo === undefined)\n      throw new Error(`GitHub found no issues',
      replacement:
        '    if (false)\n      throw new Error(`GitHub found no issues',
      red: {
        [`${ISSUES} refuses an answer without the repository’s issues`]:
          "reading 'hasNextPage'",
      },
    },
    {
      // One page more is asked for before the same refusal.
      name: 'issues-cap-one-late',
      file: WORKER_GITHUB,
      anchor:
        "  for (let read = 0; read < MAX_PAGES; read += 1) {\n    const page = (await call('POST', '/graphql', token, {\n      query: REPO_ISSUES_QUERY,",
      replacement:
        "  for (let read = 0; read < MAX_PAGES + 1; read += 1) {\n    const page = (await call('POST', '/graphql', token, {\n      query: REPO_ISSUES_QUERY,",
      red: {
        [`${ISSUES} stops at 20 pages rather than follow a repository that never ends`]:
          'to have a length of 20',
      },
    },
    {
      // Every request asks for the first page: two-page reads never end.
      // The fake's default for the Worker is one page, so only the tests
      // serving the fixture's two pages see it.
      name: 'issues-follow-no-cursor',
      file: WORKER_GITHUB,
      anchor: '      variables: { owner, name, endCursor },\n',
      replacement: '      variables: { owner, name, endCursor: null },\n',
      red: {
        [`${ISSUES} reads every page of the repository’s issues, following each endCursor`]:
          NEVER_ENDS,
        [`${ISSUES} gives pages the shared cross-check reads as naming the fixture board’s issues`]:
          NEVER_ENDS,
        [`${ISSUES} sends its User-Agent on every page`]: NEVER_ENDS,
        [`${READING} refuses a listing short of the repository’s issues, its own count agreeing, keeping nothing from it (#751)`]:
          NEVER_ENDS,
        [`${FAILED} keeps the last good snapshot and reports the short listing on health (#751)`]:
          NEVER_ENDS,
      },
    },
    {
      // Helper (#659): the fake then derives the issues from the board it
      // serves whatever the test asked for, so a short board agrees with them.
      name: 'fake-ignores-the-repo-pages-asked-for',
      file: 'apps/site/test/github-fake/fake-github.ts',
      anchor:
        '        const issues = config.repoPages ?? [issuesOnBoard(pages)];\n',
      replacement: '        const issues = [issuesOnBoard(pages)];\n',
      red: {
        [`${READING} refuses a listing short of the repository’s issues, its own count agreeing, keeping nothing from it (#751)`]:
          'to be +0',
        [`${FAILED} keeps the last good snapshot and reports the short listing on health (#751)`]:
          'expected 2 to be 1',
        [`${ISSUES} reads every page of the repository’s issues, following each endCursor`]:
          'to have a length of 2',
        [`${ISSUES} sends its User-Agent on every page`]: 'to deeply equal',
        [`${ISSUES} refuses an answer without the repository’s issues`]:
          'instead of rejecting',
      },
    },
  ],
});
