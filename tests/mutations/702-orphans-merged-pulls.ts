import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The orphan check counts a merged pull request whose branch is gone (#702),
 * each row predicted before its first run: the merged pull requests read
 * but never consulted, abandoned ones counted, another repository's branch
 * counted, a title or body mention counted, the known positive dropped,
 * develop's missing SHA let through, each field of a closed entry unchecked,
 * and the sizes line's count dropped. Unit-suite mutations.
 */

const SCRIPT = 'tests/unit/board-orphans.test.ts';
const NAMES = `${SCRIPT} › boardOrphans passes a ticket something names (#580 AC1, AC3) >`;
const ORPHANS = `${SCRIPT} › boardOrphans fails on an orphan, by name (#580 AC1, AC3) >`;
const MERGED = `${SCRIPT} › boardOrphans counts a merged pull request whose branch is gone (#702) >`;
const CLOSED = `${SCRIPT} › boardOrphans fails closed when it cannot look (#580 AC2, AC3) >`;
const DEPENDABOT = `${SCRIPT} › boardOrphans reads Dependabot's pull requests too (#661) >`;

export default mutationFile({
  targets: [SCRIPT],
  mutations: [
    {
      name: 'merged-pulls-name-nothing',
      file: 'scripts/board-orphans.ts',
      anchor: '      (p) => p.headRepo === repo && branchNames(p.branch, n),\n',
      replacement: '      () => false,\n',
      red: {
        [`${MERGED} passes a ticket a merged pull request's branch names, until the ticket closes`]:
          'to deeply equal',
      },
    },
    {
      name: 'abandoned-pulls-count',
      file: 'scripts/board-orphans.ts',
      anchor: '  ).filter((p) => p.merged);\n',
      replacement: '  ).filter(() => true);\n',
      red: {
        [`${MERGED} does not count a pull request closed without merging`]:
          'to be false',
      },
    },
    {
      name: 'other-repositories-count',
      file: 'scripts/board-orphans.ts',
      anchor: '      (p) => p.headRepo === repo && branchNames(p.branch, n),\n',
      replacement: '      (p) => branchNames(p.branch, n),\n',
      red: {
        [`${MERGED} does not count a merged pull request from another repository's branch`]:
          'to be false',
        [`${MERGED} does not count a merged pull request whose head repository is gone`]:
          'to be false',
      },
    },
    {
      name: 'title-and-body-mentions-count',
      file: 'scripts/board-orphans.ts',
      anchor: '      branch: head.ref,\n      headRepo:',
      replacement:
        "      branch: `${head.ref} ${String(e.title)} ${String(e.body)}`.replace(/#(\\d+)/g, '/$1-'),\n      headRepo:",
      red: {
        [`${MERGED} does not take #12 in a merged title or body as naming it: history keeps every mention`]:
          'to be false',
      },
    },
    {
      name: 'known-positive-dropped',
      file: 'scripts/board-orphans.ts',
      anchor: '  if (!merged.some((p) => p.mergeCommit === developSha))\n',
      replacement: '  if (false)\n',
      red: {
        [`${CLOSED} refuses a closed pull request list without develop's head, its known positive (#702)`]:
          'to throw an error',
      },
    },
    {
      name: 'develop-sha-unchecked',
      file: 'scripts/board-orphans.ts',
      anchor: "    throw new Error('develop has no commit SHA');\n",
      replacement: '    return { names, developSha: null };\n',
      red: {
        [`${CLOSED} refuses a develop branch entry with no commit SHA (#702)`]:
          "for develop's head null",
      },
    },
    {
      name: 'closed-number-unchecked',
      file: 'scripts/board-orphans.ts',
      anchor:
        '      !Number.isInteger(e.number) ||\n      !(typeof e.merged_at',
      replacement: '      !(typeof e.merged_at',
      red: {
        [`${CLOSED} refuses a closed pull request entry with no number (#702)`]:
          'to throw an error',
      },
    },
    {
      name: 'closed-merged-at-unchecked',
      file: 'scripts/board-orphans.ts',
      anchor:
        "      !(typeof e.merged_at === 'string' || e.merged_at === null) ||\n",
      replacement: '',
      red: {
        [`${CLOSED} refuses a closed pull request entry with no merged_at field (#702)`]:
          'to throw an error',
      },
    },
    {
      name: 'closed-merge-commit-unchecked',
      file: 'scripts/board-orphans.ts',
      anchor:
        "      !(\n        typeof e.merge_commit_sha === 'string' || e.merge_commit_sha === null\n      ) ||\n",
      replacement: '',
      red: {
        [`${CLOSED} refuses a closed pull request entry with no merge_commit_sha field (#702)`]:
          'to throw an error',
      },
    },
    {
      name: 'closed-head-branch-unchecked',
      file: 'scripts/board-orphans.ts',
      anchor:
        "      typeof head.ref !== 'string' ||\n      !(\n        headRepo",
      replacement: '      !(\n        headRepo',
      red: {
        [`${CLOSED} refuses a closed pull request entry with no head branch (#702)`]:
          'to throw an error',
      },
    },
    {
      name: 'closed-head-repo-unchecked',
      file: 'scripts/board-orphans.ts',
      anchor: '        headRepo === null ||\n',
      replacement: '        headRepo == null ||\n',
      red: {
        [`${CLOSED} refuses a closed pull request entry with no head repository field (#702)`]:
          'to throw an error',
      },
    },
    {
      name: 'sizes-line-drops-merged',
      file: 'scripts/board-orphans.ts',
      anchor:
        ", ${plural(merged.length, 'merged pull request', 'merged pull requests')}.`;",
      replacement: '.`;',
      red: {
        [`${NAMES} passes a ticket named by a branch with no pull request`]:
          'to deeply equal',
        [`${NAMES} judges only tickets In Progress: a Todo ticket nothing names passes`]:
          'to deeply equal',
        [`${ORPHANS} fails a ticket In Progress that nothing names`]:
          'to deeply equal',
        [`${ORPHANS} passes a ticket whose branch was merged, until the ticket closes (operator 2026-10-16)`]:
          'to deeply equal',
        [`${ORPHANS} names every orphan, each on its own line`]:
          'to deeply equal',
        [`${MERGED} passes a ticket a merged pull request's branch names, until the ticket closes`]:
          'to deeply equal',
        [`${MERGED} does not count a pull request closed without merging`]:
          'to contain',
        [`${DEPENDABOT} reads the board for a Dependabot pull request as for anyone else`]:
          'to deeply equal',
      },
    },
  ],
});
