import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The squash-only check's controls (#679 AC3), predicted before their first
 * run. Each mutation disables one control in scripts/develop-squash-only.ts,
 * and each that would let a loosened develop pass, or a reply it cannot read
 * be judged, goes red through the test that owns it. A test expecting a
 * rejection that gets a verdict fails "instead of rejecting"; one that gets
 * another rejection fails naming it. Unit-suite mutations: they run on the
 * laptop too.
 */

const TEST = 'tests/unit/develop-squash-only.test.ts';
const CASE = `${TEST} › develop allows squash merges only (#679) > `;
const SCRIPT = 'scripts/develop-squash-only.ts';
const RESOLVED = 'instead of rejecting';

/** Every case that reads develop's reply, so a read of main breaks it. */
const READS_DEVELOP = [
  'passes when its one pull-request rule allows squash alone',
  'passes when two rules together allow squash alone',
  'fails when no pull-request rule applies to develop',
  'fails when develop has no rules at all',
  'fails, naming the extra method, when the rule also allows merge commits',
  'fails, naming the extra method, when the rule also allows rebase',
  'fails when the rules together allow no merge method',
  'fails closed, naming the status, when GitHub answers other than 200',
  'fails closed when the rules run past one page',
  'reads a reply whose links name no next page',
  'fails closed when the reply is not JSON',
  'fails closed when the reply is not a list of rules',
  'fails closed when a rule has no type',
  'fails closed when a pull-request rule has no ruleset id',
  'fails closed when a pull-request rule names no merge methods',
  'fails closed when a pull-request rule has no parameters',
  'fails closed when the merge methods are not a list',
  'fails closed on a merge method it does not know',
];

export default mutationFile({
  targets: [TEST],
  mutations: [
    {
      // No pull-request rule on develop would pass the gate.
      name: 'missing-rule-passes',
      file: SCRIPT,
      anchor: '      ok: false,\n      lines: [\n        `No pull-request rule',
      replacement:
        '      ok: true,\n      lines: [\n        `No pull-request rule',
      red: {
        [`${CASE}fails when no pull-request rule applies to develop`]:
          'to deeply equal',
        [`${CASE}fails when develop has no rules at all`]: 'to deeply equal',
        [`${CASE}reads the rules on develop, not on another branch`]:
          'expected true to be false',
      },
    },
    {
      // Any set holding squash would pass, merge commits and rebase included.
      name: 'extra-method-passes',
      file: SCRIPT,
      anchor: "  if (allowed.length === 1 && allowed[0] === 'squash') {",
      replacement: "  if (allowed.includes('squash')) {",
      red: {
        [`${CASE}fails, naming the extra method, when the rule also allows merge commits`]:
          'to deeply equal',
        [`${CASE}fails, naming the extra method, when the rule also allows rebase`]:
          'to deeply equal',
      },
    },
    {
      // A method one rule allows would count, though every rule is enforced.
      name: 'union-not-intersection',
      file: SCRIPT,
      anchor: '    pulls.every((p) => p.methods.includes(m)),',
      replacement: '    pulls.some((p) => p.methods.includes(m)),',
      red: {
        [`${CASE}passes when two rules together allow squash alone`]:
          'to deeply equal',
        [`${CASE}fails when the rules together allow no merge method`]:
          'to deeply equal',
      },
    },
    {
      // The rules of another branch would be judged as develop's.
      name: 'wrong-branch',
      file: SCRIPT,
      anchor: '/rules/branches/${BRANCH}?per_page=',
      replacement: '/rules/branches/main?per_page=',
      red: {
        ...Object.fromEntries(
          READS_DEVELOP.map((title) => [
            `${CASE}${title}`,
            'rules/branches/main',
          ]),
        ),
        [`${CASE}reads the rules on develop, not on another branch`]:
          'expected true to be false',
      },
    },
    {
      // With no token the read would go out unauthenticated.
      name: 'token-unchecked',
      file: SCRIPT,
      anchor: "  if (token === undefined || token === '')\n",
      replacement: '  if (false)\n',
      red: {
        [`${CASE}refuses without a token, reading nothing`]:
          'sent token undefined',
      },
    },
    {
      // An error page would be judged as the rules.
      name: 'status-unchecked',
      file: SCRIPT,
      anchor:
        '      if (reply.status !== 200)\n        throw new Error(`GitHub answered ${String(reply.status)}`);\n',
      replacement: '',
      red: {
        [`${CASE}fails closed, naming the status, when GitHub answers other than 200`]:
          'the reply is not a list of rules',
      },
    },
    {
      // A first page would be judged as every rule.
      name: 'next-page-ignored',
      file: SCRIPT,
      anchor:
        '      if (reply.link?.includes(\'rel="next"\'))\n        throw new Error(`they run past one page of ${String(PAGE)}`);\n',
      replacement: '',
      red: {
        [`${CASE}fails closed when the rules run past one page`]: RESOLVED,
      },
    },
    {
      // Any link at all would read as a next page.
      name: 'any-link-is-next',
      file: SCRIPT,
      anchor: '      if (reply.link?.includes(\'rel="next"\'))',
      replacement: "      if (reply.link?.includes('rel='))",
      red: {
        [`${CASE}reads a reply whose links name no next page`]:
          'they run past one page of 100',
      },
    },
    {
      // A rule it cannot type would be skipped, not refused.
      name: 'untyped-rule-skipped',
      file: SCRIPT,
      anchor:
        "    if (!isRecord(r) || typeof r.type !== 'string')\n      throw new Error('a rule has no type');",
      replacement:
        "    if (!isRecord(r) || typeof r.type !== 'string') continue;",
      red: {
        [`${CASE}fails closed when a rule has no type`]: RESOLVED,
      },
    },
    {
      // A pull-request rule with no ruleset id would be read on.
      name: 'ruleset-id-unchecked',
      file: SCRIPT,
      anchor:
        "    if (!Number.isInteger(r.ruleset_id))\n      throw new Error('a pull-request rule has no ruleset id');\n",
      replacement: '',
      red: {
        [`${CASE}fails closed when a pull-request rule has no ruleset id`]:
          'ruleset undefined',
      },
    },
    {
      // A pull-request rule naming no methods would be ignored, so a second
      // rule allowing squash alone would pass the gate.
      name: 'methodless-rule-skipped',
      file: SCRIPT,
      anchor:
        '    if (!Array.isArray(methods))\n      throw new Error(\n        `ruleset ${String(ruleset)}’s pull-request rule names no merge methods`,\n      );',
      replacement: '    if (!Array.isArray(methods)) continue;',
      red: {
        [`${CASE}fails closed when a pull-request rule names no merge methods`]:
          RESOLVED,
        [`${CASE}fails closed when a pull-request rule has no parameters`]:
          RESOLVED,
        [`${CASE}fails closed when the merge methods are not a list`]: RESOLVED,
      },
    },
    {
      // A method it does not know would be read as allowing nothing.
      name: 'unknown-method-allowed',
      file: SCRIPT,
      anchor: '    if (unknown !== undefined)\n',
      replacement: '    if (false)\n',
      red: {
        [`${CASE}fails closed on a merge method it does not know`]: RESOLVED,
      },
    },
  ],
});
