import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * scripts/board-progress.ts run as a process refuses a board listing short
 * of the issues the repository names on it (#751), predicted before its first
 * run, through the integration suite. The unit suite proves the script's own
 * refusals in process (751-board-cross-check.ts); here, the script without
 * the cross-check, read through the gh stand-in on PATH.
 */

const RUN = 'tests/integration/board-progress.test.ts';
const SCRIPT = `${RUN} › scripts/board-progress.ts (#340) >`;

export default mutationFile({
  targets: [RUN],
  mutations: [
    {
      // One gh call, and the short board's figures printed with exit 0.
      name: 'progress-process-unchecked',
      file: 'scripts/board-progress.ts',
      anchor:
        '  assertNamedByRepo(pages, repoIssuePages(gh, repo), id, repo);\n',
      replacement: '',
      red: {
        [`${SCRIPT} asks gh for every page of the board it was given, then of the repository’s issues, each slurped into one array`]:
          'to deeply equal',
        [`${SCRIPT} refuses a board listing short of the issues the repository names on it and prints no line (#751)`]:
          // Vitest prints a zero as +0, as in 'to be +0' elsewhere.
          'not to be +0',
      },
    },
  ],
});
