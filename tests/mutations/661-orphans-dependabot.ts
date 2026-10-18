import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The orphan check reads Dependabot's pull requests too (#661), each row
 * predicted before its first run: the script's skip planted back, a
 * Dependabot run told the environment's secret instead of its own, and each
 * workflow step's Dependabot condition put back. Unit-suite mutations.
 */

const SCRIPT = 'tests/unit/board-orphans.test.ts';
const WORKFLOW = 'tests/unit/board-orphans-workflow.test.ts';
const DEPENDABOT = `${SCRIPT} › boardOrphans reads Dependabot's pull requests too (#661) >`;
const STEPS = `${WORKFLOW} › board-orphans.yml (#580) >`;
const NOT_DEPENDABOT =
  "        if: ${{ github.event.pull_request.user.login != 'dependabot[bot]' }}\n";

export default mutationFile({
  targets: [SCRIPT, WORKFLOW],
  mutations: [
    {
      name: 'script-skips-dependabot',
      file: 'scripts/board-orphans.ts',
      anchor: '  const prNumber = Number(env.PR_NUMBER);\n',
      replacement:
        "  if (env.PR_AUTHOR === DEPENDABOT) return { ok: true, lines: ['Skipped'] };\n  const prNumber = Number(env.PR_NUMBER);\n",
      red: {
        [`${DEPENDABOT} fails, naming the Dependabot secret, when a Dependabot pull request has no token`]:
          'to throw an error',
        [`${DEPENDABOT} reads the board for a Dependabot pull request as for anyone else`]:
          'Skipped',
      },
    },
    {
      name: 'dependabot-told-the-environment-secret',
      file: 'scripts/board-orphans.ts',
      anchor: '      env.PR_AUTHOR === DEPENDABOT\n',
      replacement: '      false\n',
      red: {
        [`${DEPENDABOT} fails, naming the Dependabot secret, when a Dependabot pull request has no token`]:
          'Dependabot secret ROADMAP_APP_KEY',
      },
    },
    {
      name: 'key-check-skips-dependabot',
      file: '.github/workflows/board-orphans.yml',
      anchor: '      - name: The board key is set\n',
      replacement: `      - name: The board key is set\n${NOT_DEPENDABOT}`,
      red: {
        [`${STEPS} fails by name when the key is missing, for every author, naming both places it is set`]:
          'to be undefined',
      },
    },
    {
      name: 'mint-skips-dependabot',
      file: '.github/workflows/board-orphans.yml',
      anchor: '        id: board-token\n',
      replacement: `        id: board-token\n${NOT_DEPENDABOT}`,
      red: {
        [`${STEPS} mints a token for the roadmap App's org installation, reading issues and projects only`]:
          'dependabot[bot]',
      },
    },
  ],
});
