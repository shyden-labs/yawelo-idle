import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The pre-push hook checks each pushed commit, never the working tree (#752
 * AC5): each refusal in scripts/pre-push.ts removed in turn, with every
 * prediction written before its first run. Unit-suite mutations, on the
 * stand-ins; 752-pre-push-integration.ts runs the hook itself.
 */

const UNIT = 'tests/unit/pre-push.test.ts';
const READ = `${UNIT} › readUpdates reads the lines git writes to the hook (#752 AC1, AC3) >`;
const LIST = `${UNIT} › commitsToCheck lists the commits no remote has, oldest first (#752 AC1, AC3) >`;
const MIRROR = `${UNIT} › mirrorNodeModules lends the checkout’s packages but keeps ours the commit’s (#752 AC2) >`;
const CHECK = `${UNIT} › checkCommits checks each commit in its own temporary worktree (#752 AC2) >`;
const MESSAGE = `${UNIT} › refusalMessage names the check and the commit (#752 AC2) >`;
const SCRIPT = 'scripts/pre-push.ts';
const NOTHING_THROWN = 'to throw an error';
/** The rev-list stand-in answers only the arguments the test expects. */
const UNASKED = 'no answer for';
const EQUAL = 'to deeply equal';

export default mutationFile({
  targets: [UNIT],
  mutations: [
    {
      // Every unreadable line is read as an update.
      name: 'unreadable-line-read',
      file: SCRIPT,
      anchor:
        '        throw new Error(\n          `git sent the pre-push hook a line it cannot read: ${line}`,\n        );\n',
      replacement: '        void 0;\n',
      red: {
        [`${READ} refuses a line with three fields, naming it`]: NOTHING_THROWN,
        [`${READ} refuses a line whose local name is not a commit name, naming it`]:
          NOTHING_THROWN,
        [`${READ} refuses a line whose remote name is not a commit name, naming it`]:
          NOTHING_THROWN,
      },
    },
    {
      // Four fields of anything pass; the three-field line is still refused.
      name: 'commit-names-unchecked',
      file: SCRIPT,
      anchor:
        '        !OBJECT_NAME.test(localSha) ||\n        !OBJECT_NAME.test(remoteSha)\n',
      replacement: '        false\n',
      red: {
        [`${READ} refuses a line whose local name is not a commit name, naming it`]:
          NOTHING_THROWN,
        [`${READ} refuses a line whose remote name is not a commit name, naming it`]:
          NOTHING_THROWN,
      },
    },
    {
      // A deletion asks rev-list about the all-zero name.
      name: 'deletion-checked',
      file: SCRIPT,
      anchor: '    if (NO_COMMIT.test(update.localSha)) continue;\n',
      replacement: '',
      red: {
        [`${LIST} checks nothing for a deletion, asking git nothing, beside an update it does check`]:
          UNASKED,
      },
    },
    {
      // A new ref's all-zero remote name is passed to rev-list.
      name: 'new-ref-remote-named',
      file: SCRIPT,
      anchor:
        '    const known = NO_COMMIT.test(update.remoteSha) ? [] : [update.remoteSha];\n',
      replacement: '    const known = [update.remoteSha];\n',
      red: {
        [`${LIST} lists a new branch’s commits past every remote branch`]:
          UNASKED,
        [`${LIST} checks nothing when the remote already has every commit, beside an update it does check`]:
          UNASKED,
        [`${LIST} lists a commit two updates share once, where it first appears`]:
          UNASKED,
      },
    },
    {
      // Newest first: rev-list is asked without --reverse.
      name: 'newest-first',
      file: SCRIPT,
      anchor: "      '--reverse',\n",
      replacement: '',
      red: {
        [`${LIST} lists an existing branch’s new commits past what the remote had`]:
          UNASKED,
        [`${LIST} lists a new branch’s commits past every remote branch`]:
          UNASKED,
        [`${LIST} checks nothing for a deletion, asking git nothing, beside an update it does check`]:
          UNASKED,
        [`${LIST} checks nothing when the remote already has every commit, beside an update it does check`]:
          UNASKED,
        [`${LIST} lists a commit two updates share once, where it first appears`]:
          UNASKED,
      },
    },
    {
      // A commit two updates share is checked twice.
      name: 'shared-commit-repeated',
      file: SCRIPT,
      anchor: '      if (!commits.includes(commit)) commits.push(commit);\n',
      replacement: '      commits.push(commit);\n',
      red: {
        [`${LIST} lists a commit two updates share once, where it first appears`]:
          EQUAL,
      },
    },
    {
      // The trap: our packages linked whole, so they resolve to the working tree.
      name: 'workspace-links-shared',
      file: SCRIPT,
      anchor: '    if (name !== WORKSPACE_SCOPE) {\n',
      replacement: '    if (true) {\n',
      red: {
        [`${MIRROR} links every outside package to the checkout’s copy and rebuilds our links inside the worktree`]:
          EQUAL,
        [`${MIRROR} lends no workspace packages to a workspace the commit does not have`]:
          EQUAL,
      },
    },
    {
      // No workspace is lent its installed packages.
      name: 'workspace-modules-unlent',
      file: SCRIPT,
      anchor:
        '    if (effects.exists(installed) && effects.exists(join(worktree, workspace)))\n',
      replacement: '    if (false)\n',
      red: {
        [`${MIRROR} links every outside package to the checkout’s copy and rebuilds our links inside the worktree`]:
          EQUAL,
      },
    },
    {
      // A workspace the commit lacks is lent packages anyway.
      name: 'absent-workspace-lent',
      file: SCRIPT,
      anchor:
        'effects.exists(installed) && effects.exists(join(worktree, workspace))',
      replacement: 'effects.exists(installed)',
      red: {
        [`${MIRROR} lends no workspace packages to a workspace the commit does not have`]:
          EQUAL,
      },
    },
    {
      // No node_modules: the spread of undefined throws, not the named fix.
      name: 'missing-modules-unnamed',
      file: SCRIPT,
      anchor:
        '  if (entries === undefined)\n    throw new Error(`${source} is missing',
      replacement: '  if (false)\n    throw new Error(`${source} is missing',
      red: {
        [`${MIRROR} refuses a checkout with no node_modules, naming the fix`]:
          'to throw error including',
      },
    },
    {
      // A failing gate is passed.
      name: 'gate-failure-passed',
      file: SCRIPT,
      anchor:
        '      if (failed !== undefined) return { check: failed, commit: short };\n',
      replacement: '',
      red: {
        [`${CHECK} refuses at the first failing check, naming it and the commit, and checks nothing after`]:
          EQUAL,
        [`${CHECK} refuses a commit whose generated types fail, naming postinstall`]:
          EQUAL,
      },
    },
    {
      // postinstall runs, but its failure is not a refusal.
      name: 'postinstall-unchecked',
      file: SCRIPT,
      anchor:
        "  if (effects.npm('postinstall', dir, true) !== 0) return 'postinstall';\n",
      replacement: "  effects.npm('postinstall', dir, true);\n",
      red: {
        [`${CHECK} refuses a commit whose generated types fail, naming postinstall`]:
          EQUAL,
      },
    },
    {
      // Every checked worktree is left registered.
      name: 'worktree-kept',
      file: SCRIPT,
      anchor: '      if (added) effects.removeWorktree(dir, root);\n',
      replacement: '',
      red: {
        [`${CHECK} passes a clean pair, each checked in turn and its worktree removed`]:
          EQUAL,
        [`${CHECK} refuses at the first failing check, naming it and the commit, and checks nothing after`]:
          EQUAL,
        [`${CHECK} removes the worktree when a check cannot start, and passes the error on`]:
          EQUAL,
      },
    },
    {
      // A worktree never made is removed anyway.
      name: 'unmade-worktree-removed',
      file: SCRIPT,
      anchor: '      if (added) effects.removeWorktree(',
      replacement: '      if (true) effects.removeWorktree(',
      red: {
        [`${CHECK} removes the temporary directory, and asks git to remove no worktree, when the worktree cannot be made`]:
          EQUAL,
      },
    },
    {
      // The temporary directory is never removed.
      name: 'temp-dir-kept',
      file: SCRIPT,
      anchor: '      effects.removeDir(dir);\n',
      replacement: '',
      red: {
        [`${CHECK} passes a clean pair, each checked in turn and its worktree removed`]:
          EQUAL,
        [`${CHECK} refuses at the first failing check, naming it and the commit, and checks nothing after`]:
          EQUAL,
        [`${CHECK} removes the worktree when a check cannot start, and passes the error on`]:
          EQUAL,
        [`${CHECK} removes the temporary directory, and asks git to remove no worktree, when the worktree cannot be made`]:
          EQUAL,
      },
    },
    {
      // The refusal no longer names the commit.
      name: 'commit-unnamed',
      file: SCRIPT,
      anchor: 'failed on commit ${refusal.commit}, so',
      replacement: 'failed on a commit, so',
      red: {
        [`${MESSAGE} says which check failed on which commit, and that nothing was pushed`]:
          'to be',
      },
    },
  ],
});
