import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The squash-only check's controls (#679 AC3), predicted before their first
 * run. Each mutation disables one control in scripts/develop-squash-only.ts,
 * and each that would let a loosened develop pass, or a reply it cannot read
 * be judged, goes red through the test that owns it. Unit-suite mutations:
 * they run on the laptop too.
 */

const TEST = 'tests/unit/develop-squash-only.test.ts';
const CASE = `${TEST} › develop allows squash merges only (#679) > `;
const SCRIPT = 'scripts/develop-squash-only.ts';

/** The cases a wrong-branch read breaks, each through the call it makes. */
const READS_MAIN = [
  'passes when its one pull-request rule allows squash alone',
  'passes when two rules together allow squash alone',
  'fails when no pull-request rule applies to develop',
  'fails when develop has no rules at all',
  'fails, naming the extra method, when the rule also allows merge commits',
  'fails, naming the extra method, when the rule also allows rebase',
  'fails when the rules together allow no merge method',
  'fails closed when the reply is not JSON',
  'fails closed when the reply is not a list of pages',
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
      anchor: '        `repos/${repo}/rules/branches/${BRANCH}?per_page=100`,',
      replacement: '        `repos/${repo}/rules/branches/main?per_page=100`,',
      red: {
        ...Object.fromEntries(
          READS_MAIN.map((title) => [`${CASE}${title}`, 'rules/branches/main']),
        ),
        [`${CASE}reads the rules on develop, not on another branch`]:
          'expected true to be false',
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
        [`${CASE}fails closed when a rule has no type`]: 'to throw an error',
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
          'to throw an error',
        [`${CASE}fails closed when a pull-request rule has no parameters`]:
          'to throw an error',
        [`${CASE}fails closed when the merge methods are not a list`]:
          'to throw an error',
      },
    },
    {
      // A method it does not know would be read as not allowing anything.
      name: 'unknown-method-allowed',
      file: SCRIPT,
      anchor: '    if (unknown !== undefined)\n',
      replacement: '    if (false)\n',
      red: {
        [`${CASE}fails closed on a merge method it does not know`]:
          'to throw an error',
      },
    },
  ],
});
