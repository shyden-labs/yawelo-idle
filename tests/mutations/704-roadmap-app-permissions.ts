import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The roadmap Worker accepts the App's installation with Administration:
 * read and mints its token for the three reads only (#704), each row
 * predicted before its first run, through the site's harness suite.
 *
 * Narrow rows only: the installation check dropped, the token check
 * dropped, and the fake's two token rules broken. Reverting the fix (the
 * installation pinned back to the three reads, or the mint naming no
 * rights) turns every roadmap read in the suite red; that is the
 * tests-first head's CI run on PR #707, not a row here.
 */

const GITHUB = 'apps/site/test/roadmap/github.test.ts';
const TOKEN = `${GITHUB} › installationToken >`;
const FAKE = `${GITHUB} › the fake GitHub issues tokens as GitHub does (#704) >`;
const RESOLVED = 'instead of rejecting';

export default mutationFile({
  targets: [GITHUB],
  mutations: [
    {
      name: 'installation-check-dropped',
      file: 'apps/site/worker/github.ts',
      anchor: '  if (canonical(installation.permissions) !== installed)\n',
      replacement: '  if (false)\n',
      red: {
        [`${TOKEN} refuses an installation that may write issues`]: RESOLVED,
        [`${TOKEN} refuses an installation that may write administration (#704)`]:
          RESOLVED,
        [`${TOKEN} refuses an installation without Administration: read, so a change to the App is seen (#704)`]:
          RESOLVED,
        [`${TOKEN} refuses an installation with a right beyond the four`]:
          RESOLVED,
        [`${TOKEN} refuses an installation without the Projects read`]:
          'HTTP 422',
      },
    },
    {
      name: 'token-check-dropped',
      file: 'apps/site/worker/github.ts',
      anchor: '  if (canonical(issued.permissions) !== pinned)\n',
      replacement: '  if (false)\n',
      red: {
        [`${TOKEN} refuses an issued token whose rights differ from the three reads`]:
          RESOLVED,
        [`${TOKEN} refuses an issued token that carries Administration, as one minted without naming its rights would (#704)`]:
          RESOLVED,
      },
    },
    {
      name: 'fake-issues-beyond-the-installation',
      file: 'apps/site/test/github-fake/fake-github.ts',
      anchor: '  return within ? { ...asked } : null;\n',
      replacement: '  return { ...asked };\n',
      red: {
        [`${FAKE} refuses a request for more than the installation holds`]:
          'to be 422',
        [`${FAKE} refuses a request for a right the installation lacks`]:
          'to be 422',
      },
    },
    {
      name: 'fake-names-none-gives-nothing',
      file: 'apps/site/test/github-fake/fake-github.ts',
      anchor: '  if (requested === undefined) return { ...installation };\n',
      replacement: '  if (requested === undefined) return {};\n',
      red: {
        [`${FAKE} gives the token every right of the installation when the request names none`]:
          'to deeply equal',
      },
    },
  ],
});
