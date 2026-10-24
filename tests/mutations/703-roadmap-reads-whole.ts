import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The roadmap Worker refuses a read short of the board (#703), each row
 * predicted before its first run, through the site's harness suite. The
 * Worker shares assertBoard, so its other refusals are proved in the unit
 * suite (703-board-reads-whole.ts).
 *
 * The three helpers this change touched each carry a row (#659): the fake
 * ignoring the test's count, and the fixture's count one high. contract.ts
 * changed only by a type (FakeConfig.totalCount), which no mutation can
 * reach at run time; its row is #704's measured one (READ_ONLY gains a
 * right), so the tests loading the contract are proved to read it.
 */

const ROADMAP = 'apps/site/test/roadmap/roadmap.test.ts';
const READING = `${ROADMAP} › reading the board >`;
const GITHUB = 'apps/site/test/roadmap/github.test.ts';
const TOKEN = `${GITHUB} › installationToken >`;
const FAKE = `${GITHUB} › the fake GitHub issues tokens as GitHub does (#704) >`;

export default mutationFile({
  targets: [ROADMAP, GITHUB],
  mutations: [
    {
      // The fake counts 10 items and serves 9: published from 9 as version 1.
      name: 'roadmap-short-read-passes',
      file: 'packages/progress/src/index.ts',
      anchor: '  if (read !== total)\n',
      replacement: '  if (false)\n',
      red: {
        [`${READING} refuses a read short of the board, keeping nothing from it`]:
          'to be +0',
      },
    },
    {
      // The test's count is ignored, so the board read is whole.
      name: 'fake-ignores-the-count-asked-for',
      file: 'apps/site/test/github-fake/fake-github.ts',
      anchor: '          config.totalCount ?? itemCount(pages),\n',
      replacement: '          itemCount(pages),\n',
      red: {
        [`${READING} refuses a read short of the board, keeping nothing from it`]:
          'to be +0',
      },
    },
    {
      // Worker reads take the fake's own count; only the close-out lines,
      // read from the fixture itself, see the fixture's count.
      name: 'fixture-counts-one-high',
      file: 'packages/progress/test/board-fixture.ts',
      // Anchored on the board's return too: #751's repoPages has the same count.
      anchor:
        '  const totalCount = pages.flat().length;\n  return pages.map((stories) =>',
      replacement:
        '  const totalCount = pages.flat().length + 1;\n  return pages.map((stories) =>',
      red: {
        [`${READING} gives the same two lines as the close-out script, from one fixture`]:
          'the board has 10 items and 9 were read',
      },
    },
    {
      // #704's row, matched in CI on PR #707 (mutations run 39351911861).
      name: 'contract-read-only-gains-contents',
      file: 'apps/site/test/github-fake/contract.ts',
      anchor: 'export const READ_ONLY: Permissions = {\n',
      replacement:
        "export const READ_ONLY: Permissions = {\n  contents: 'read',\n",
      red: {
        [`${FAKE} narrows the token to the permissions the request names`]:
          'to be 201',
        [`${TOKEN} refuses an installation without Administration: read, so a change to the App is seen (#704)`]:
          '{"contents":"read","issues":"read"',
      },
    },
  ],
});
