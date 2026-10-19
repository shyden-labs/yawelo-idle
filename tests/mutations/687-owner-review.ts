import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The daily owner-review check (#687), predicted before the first run. Each
 * row puts back one way it could pass while develop no longer asks Shyden:
 * a setting read loosely, a reply of the wrong shape read as fine, a
 * CODEOWNERS rule counted by the wrong words, a failed read or a missing
 * token passed over (AC3), and a report that lands on the wrong issue or is
 * not assigned to him (AC1). The last three take part of each judge's
 * population away, or add to it, so the floors on what each read go red.
 */

const CHECK = 'tests/unit/owner-review.test.ts';
const PINS = 'tests/unit/codeowners.test.ts';
const SETTING = `${CHECK} › protectionJudgement >`;
const FILE = `${CHECK} › codeownersJudgement >`;
const REPORT = `${CHECK} › ownerReview >`;
const SCRIPT = 'scripts/owner-review.ts';

export default mutationFile({
  targets: [CHECK, PINS],
  mutations: [
    {
      name: 'truthy-setting-reads-on',
      file: SCRIPT,
      anchor: '  if (value === true) return { checked, problems: [] };\n',
      replacement: '  if (value) return { checked, problems: [] };\n',
      red: {
        [`${SETTING} reads a truthy value that is not true as off`]:
          'to deeply equal',
      },
    },
    {
      name: 'missing-setting-reads-on',
      file: SCRIPT,
      anchor: '  if (value === true) return { checked, problems: [] };\n',
      replacement:
        '  if (value === true || value === undefined) return { checked, problems: [] };\n',
      red: {
        [`${SETTING} reads a missing setting as off, never as on`]:
          'to deeply equal',
      },
    },
    {
      name: 'array-reply-read-as-object',
      file: SCRIPT,
      anchor: '  if (!isRecord(reply) || Array.isArray(reply))\n',
      replacement: '  if (!isRecord(reply))\n',
      red: {
        [`${SETTING} fails closed on JSON that is not an object`]:
          'to deeply equal',
      },
    },
    {
      name: 'comments-read-as-rules',
      file: SCRIPT,
      anchor: "    .map((line) => line.replace(/#.*/, '').trim())\n",
      replacement: '    .map((line) => line.trim())\n',
      red: {
        [`${PINS} › .github/CODEOWNERS > names Shyden as the one owner of exactly the twin list and itself`]:
          'to deeply equal',
        [`${FILE} finds nothing in develop's file`]: 'to be undefined',
        [`${FILE} names the twin-list rule when its line is gone`]:
          'to deeply equal',
        [`${FILE} names the rule when its owner changed`]: 'to deeply equal',
        [`${FILE} reads a commented-out rule as gone`]: 'to deeply equal',
      },
    },
    {
      name: 'owner-ignored',
      file: SCRIPT,
      anchor: '  const held = new Set(rules);\n',
      replacement:
        "  const held = new Set(\n    codeownersRules(text).map((words) => `${words[0] ?? ''} @ShydenMcM`),\n  );\n",
      red: {
        [`${FILE} names the rule when its owner changed`]: 'to deeply equal',
      },
    },
    {
      name: 'setting-read-failure-passed',
      file: SCRIPT,
      anchor:
        "      problems.push(\n        `could not read develop's review settings: ${message(error)}`,\n      );\n",
      replacement: '      void error;\n',
      red: {
        [`${REPORT} opens the issue when the setting cannot be read (AC3)`]:
          'to deeply equal',
      },
    },
    {
      name: 'file-read-failure-passed',
      file: SCRIPT,
      anchor:
        '    problems.push(\n      `could not read .github/CODEOWNERS on develop: ${message(error)}`,\n    );\n',
      replacement: '    void error;\n',
      red: {
        [`${REPORT} opens the issue when the file cannot be read (AC3)`]:
          'to deeply equal',
      },
    },
    {
      name: 'empty-token-reads-anyway',
      file: SCRIPT,
      anchor: "  if (adminToken === '') {\n",
      replacement: "  if (adminToken === 'never') {\n",
      red: {
        [`${REPORT} opens the issue, reading nothing as admin, when there is no admin token (AC3)`]:
          'to deeply equal',
      },
    },
    {
      name: 'search-failure-unsaid',
      file: SCRIPT,
      anchor:
        '    notes.push(\n      `could not search the open issues for an earlier report: ${message(error)}`,\n    );\n',
      replacement: '    void error;\n',
      red: {
        [`${REPORT} still opens an issue when the open issues cannot be searched, saying so`]:
          'to contain',
      },
    },
    {
      name: 'any-title-reused',
      file: SCRIPT,
      anchor: '      item.title === ISSUE_TITLE &&\n',
      replacement: '      true &&\n',
      red: {
        [`${REPORT} comments on the issue already open rather than opening another`]:
          'to deeply equal',
      },
    },
    {
      name: 'pull-request-reused',
      file: SCRIPT,
      anchor:
        '      item.title === ISSUE_TITLE &&\n      item.pull_request === undefined,\n',
      replacement: '      item.title === ISSUE_TITLE,\n',
      red: {
        [`${REPORT} never reuses a pull request that carries the title`]:
          'to deeply equal',
      },
    },
    {
      name: 'always-a-new-issue',
      file: SCRIPT,
      anchor: '  if (open === undefined) {\n',
      replacement: '  if (true) {\n',
      red: {
        [`${REPORT} comments on the issue already open rather than opening another`]:
          'to deeply equal',
      },
    },
    {
      name: 'not-assigned',
      file: SCRIPT,
      anchor: "      '-f',\n      `assignees[]=${ASSIGNEE}`,\n",
      replacement: '',
      red: {
        [`${REPORT} opens one issue assigned to Shyden when the setting is off and none is open`]:
          'to include',
      },
    },
    {
      name: 'settings-population-lost',
      file: SCRIPT,
      anchor:
        "  const checked = value === undefined ? [] : ['require_code_owner_reviews'];\n",
      replacement: '  const checked: string[] = [];\n',
      red: {
        [`${SETTING} finds nothing when develop requires code-owner review`]:
          'searched no review settings judged',
        [`${SETTING} names the setting and where it is set when it is off`]:
          'to deeply equal',
        [`${SETTING} reads a truthy value that is not true as off`]:
          'to deeply equal',
      },
    },
    {
      name: 'settings-population-grown',
      file: SCRIPT,
      anchor:
        "  const checked = value === undefined ? [] : ['require_code_owner_reviews'];\n",
      replacement:
        "  const checked =\n    value === undefined\n      ? []\n      : ['require_code_owner_reviews', 'required_approving_review_count'];\n",
      red: {
        [`${SETTING} finds nothing when develop requires code-owner review`]:
          'to be undefined',
        [`${SETTING} names the setting and where it is set when it is off`]:
          'to deeply equal',
        [`${SETTING} reads a truthy value that is not true as off`]:
          'to deeply equal',
      },
    },
    {
      name: 'rules-partly-unread',
      file: SCRIPT,
      anchor: '    checked: rules,\n',
      replacement: '    checked: rules.slice(1),\n',
      red: {
        [`${FILE} finds nothing in develop's file`]: 'to be undefined',
        [`${FILE} names the twin-list rule when its line is gone`]:
          'to deeply equal',
        [`${FILE} names the rule when its owner changed`]: 'to deeply equal',
        [`${FILE} reads a commented-out rule as gone`]: 'to deeply equal',
      },
    },
  ],
});
