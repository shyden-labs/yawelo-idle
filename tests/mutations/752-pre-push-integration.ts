import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The pre-push hook run by a real `git push` from a scratch repository (#752
 * AC4, AC5), predicted before its first run, through the integration suite:
 * the hook back on the working tree, our workspace packages linked whole
 * (so they resolve to the working tree), a refusal that exits 0, and the
 * checked worktree left behind. The refusals' own logic is proven on
 * stand-ins by 752-pre-push-unit.ts.
 */

const RUN = 'tests/integration/pre-push.test.ts';
const PUSH = `${RUN} › the pre-push hook checks each pushed commit, not the working tree (#752 AC4) >`;
const SCRIPT = 'scripts/pre-push.ts';
const SHOWN = 'to contain';
const KEPT = 'to have a length of 1';

export default mutationFile({
  targets: [RUN],
  mutations: [
    {
      // develop's hook before #752: the gates run on the working tree.
      name: 'hook-checks-working-tree',
      file: '.githooks/pre-push',
      anchor:
        'exec node "$(git rev-parse --show-toplevel)/scripts/pre-push.ts"\n',
      replacement:
        'npm run --silent format:check\nnpm run --silent lint\nnpm run --silent typecheck\n',
      red: {
        [`${PUSH} passes a clean first push of a new branch, and the remote has it`]:
          SHOWN,
        [`${PUSH} refuses a committed error under an uncommitted fix, naming lint and the commit`]:
          SHOWN,
        [`${PUSH} refuses an error in the first of two commits, the second fixing it, naming typecheck and the first`]:
          SHOWN,
        [`${PUSH} passes a clean pair, checking both, and the remote has the second`]:
          SHOWN,
        [`${PUSH} passes a deletion-only push, checking nothing`]: SHOWN,
      },
    },
    {
      // Our packages linked whole: the broken first commit loads the working
      // tree's fixed package and passes. The lint case reads src.txt from
      // the worktree, so it is still refused.
      name: 'workspace-links-shared',
      file: SCRIPT,
      anchor: '    if (name !== WORKSPACE_SCOPE) {\n',
      replacement: '    if (true) {\n',
      red: {
        [`${PUSH} refuses an error in the first of two commits, the second fixing it, naming typecheck and the first`]:
          SHOWN,
      },
    },
    {
      // The refusal is printed, but the push goes ahead.
      name: 'refusal-exits-zero',
      file: SCRIPT,
      anchor:
        '      console.error(refusalMessage(refusal));\n      process.exit(1);\n',
      replacement:
        '      console.error(refusalMessage(refusal));\n      process.exit(0);\n',
      red: {
        [`${PUSH} refuses a committed error under an uncommitted fix, naming lint and the commit`]:
          'not to be +0',
        [`${PUSH} refuses an error in the first of two commits, the second fixing it, naming typecheck and the first`]:
          'not to be +0',
      },
    },
    {
      // Every checked worktree stays registered with git. The deletion test
      // pushes main first, which checks a commit.
      name: 'worktree-kept',
      file: SCRIPT,
      anchor: '      if (added) effects.removeWorktree(dir, root);\n',
      replacement: '',
      red: {
        [`${PUSH} passes a clean first push of a new branch, and the remote has it`]:
          KEPT,
        [`${PUSH} refuses a committed error under an uncommitted fix, naming lint and the commit`]:
          KEPT,
        [`${PUSH} refuses an error in the first of two commits, the second fixing it, naming typecheck and the first`]:
          KEPT,
        [`${PUSH} passes a clean pair, checking both, and the remote has the second`]:
          KEPT,
        [`${PUSH} passes a deletion-only push, checking nothing`]: KEPT,
      },
    },
  ],
});
