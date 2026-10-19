import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #374's unit mutations, each predicted before it first ran (2026-10-19):
 * the new floors lose part of their population (B1-B3, C1; a population of
 * one takes a loss and a growth), each control of the bad twin's shape rule
 * is taken out (R1-R10), the helper's dead-twin refusal (H3), and the lint
 * test's clean-sample twin made clean (L1).
 */
export default mutationFile({
  targets: [
    'tests/unit/burn-down.test.ts',
    'tests/unit/ci-scope.test.ts',
    'tests/unit/core-determinism-lint.test.ts',
    'tests/unit/floorless-searches.test.ts',
    'tests/unit/searched.test.ts',
  ],
  mutations: [
    {
      name: 'B1-all-matched-loss',
      file: 'tests/unit/burn-down.test.ts',
      anchor: "    const items = ['a', 'b', 'a'];",
      replacement: "    const items = ['a', 'b'];",
      red: {
        'tests/unit/burn-down.test.ts › minus > leaves nothing when every item is matched':
          'burn-down/every item matched',
      },
    },
    {
      name: 'B2-left-over-loss',
      file: 'tests/unit/burn-down.test.ts',
      anchor: "    const items = ['a'];",
      replacement: '    const items: string[] = [];',
      red: {
        'tests/unit/burn-down.test.ts › minus > ignores entries left over once their items are taken':
          'searched no items',
      },
    },
    {
      name: 'B3-left-over-growth',
      file: 'tests/unit/burn-down.test.ts',
      anchor: "    const items = ['a'];",
      replacement: "    const items = ['a', 'a'];",
      red: {
        'tests/unit/burn-down.test.ts › minus > ignores entries left over once their items are taken':
          'burn-down/entries left over',
      },
    },
    {
      name: 'C1-outside-judged-blind-to-last',
      file: 'scripts/ci-scope.ts',
      anchor:
        "      reason: `outside the docs-only allowlist: ${outside.join(', ')}`,\n      judged,\n",
      replacement:
        "      reason: `outside the docs-only allowlist: ${outside.join(', ')}`,\n      judged: judged.slice(0, -1),\n",
      red: {
        'tests/unit/ci-scope.test.ts › the classification (AC1, AC4) > is full for one code path, and names it':
          'scripts/ci-scope.ts',
        'tests/unit/ci-scope.test.ts › the classification (AC1, AC4) > is full for a mix with the code path first, judging both':
          'ci-scope/code-first judged paths',
        'tests/unit/ci-scope.test.ts › the classification (AC1, AC4) > is full for a mix with the code path last, judging both':
          'TRADEMARKS.md',
        'tests/unit/ci-scope.test.ts › the printed report (AC1) > states the scope and reason, then every judged path and its side':
          'judged 2 paths:',
      },
    },
    {
      name: 'R1-twin-name-not-followed',
      file: 'tests/unit/floorless-searches.ts',
      anchor:
        '    (ts.isIdentifier(input) && !filledByCall(sf, input.text, new Set()));',
      replacement: '    ts.isIdentifier(input);',
      red: {
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a name filled by a call as unproved':
          'proved',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a name filled by a call in a second declaration as unproved':
          'proved',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over an imported name as unproved':
          'proved',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a loop binding over a table built by calls as unproved':
          'proved',
      },
    },
    {
      name: 'R3-await-not-read-through',
      file: 'tests/unit/floorless-searches.ts',
      anchor:
        '    if (ts.isAwaitExpression(at)) at = at.expression;\n    else if (ts.isCallExpression(at)) {',
      replacement: '    if (ts.isCallExpression(at)) {',
      red: {
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a function name as proved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a sample written in place as proved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a sample in a plain template as proved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over an arrow reading its sample as proved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a name declared from text as proved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a loop binding over a table of text as proved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a sample read by a call in place as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a sample awaited in place as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a sample in a template with a substitution as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a sample read from a property as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a name filled by a call as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a name filled by a call in a second declaration as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a loop binding over a table built by calls as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over an imported name as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over no twin as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a run that ignores its sample as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a run of two arguments as unproved':
          'empty',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over samples held in a name as unproved':
          'empty',
      },
    },
    {
      name: 'R4-rejects-not-a-refusal',
      file: 'tests/unit/floorless-searches.ts',
      anchor: '  if (onlyProvesItRejects(call)) return true;\n',
      replacement: '',
      red: {
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > counts a twin that only proves it rejects as a refusal check, not a site':
          'refusalChecks',
      },
    },
    {
      name: 'R5-text-misses-twin',
      file: 'tests/unit/absence-text.ts',
      anchor:
        '      /(?<![\\w$])(?<!(?<!\\.\\.)\\.)(?:searched|againstControl|againstTwin)(?![\\w$])/g,',
      replacement:
        '      /(?<![\\w$])(?<!(?<!\\.\\.)\\.)(?:searched|againstControl)(?![\\w$])/g,',
      red: {
        'tests/unit/floorless-searches.test.ts › the text counts > counts a twin (#374) as written':
          'to be 1',
        'tests/unit/floorless-searches.test.ts › the text counts > counts an awaited twin inside a bare form (#374) as written':
          'to be 2',
        'tests/unit/floorless-searches.test.ts › the text counts > counts an awaited twin read from inside a bare form (#374) as written':
          'to be 2',
      },
    },
    {
      name: 'R6-twin-list-says-only-shrinks',
      file: 'tests/unit/floorless-searches.ts',
      anchor:
        '      stale: `Lower or remove the entry in ${TWIN_LIST}: it names the twins in use.`,\n',
      replacement: '',
      red: {
        'tests/unit/floorless-searches.test.ts › twinListFindings (#374) > finds fewer twins than listed':
          'the list only shrinks',
        'tests/unit/floorless-searches.test.ts › twinListFindings (#374) > finds a listed scope whose search is no twin':
          'the list only shrinks',
      },
    },
    {
      name: 'R7-twin-run-not-read',
      file: 'tests/unit/floorless-searches.ts',
      anchor: '  return text && readsItsArgument(run);',
      replacement: '  return text;',
      red: {
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a run that ignores its sample as unproved':
          'proved',
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a run of two arguments as unproved':
          'proved',
      },
    },
    {
      name: 'R8-twin-not-required',
      file: 'tests/unit/floorless-searches.ts',
      anchor:
        "  if (!run || !input || !propertyOf(options, 'twin')) return false;",
      replacement: '  if (!run || !input) return false;',
      red: {
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over no twin as unproved':
          'proved',
      },
    },
    {
      name: 'R9-loop-source-unread',
      file: 'tests/unit/floorless-searches.ts',
      anchor: '      return loop.expression;\n',
      replacement: '      return undefined;\n',
      red: {
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a loop binding over a table of text as proved':
          'proved',
      },
    },
    {
      name: 'R10-names-not-followed',
      file: 'tests/unit/floorless-searches.ts',
      anchor: '        filledByCall(sf, child.text, seen)\n',
      replacement: '        false\n',
      red: {
        'tests/unit/floorless-searches.test.ts › searchSitesIn: againstTwin (#374) > reads a twin over a loop binding over a table built by calls as unproved':
          'proved',
      },
    },
    {
      name: 'H3-dead-twin-passes',
      file: 'tests/searched.ts',
      anchor:
        "    if (!isSubstantive(await run(twin)))\n      throw new Error(\n        'the twin found nothing, so this cannot tell a clean sample from a ' +\n          'dead function',\n      );\n",
      replacement: '    await run(twin);\n',
      red: {
        'tests/unit/searched.test.ts › againstTwin > refuses a twin that finds nothing: a dead run passes otherwise':
          'instead of rejecting',
      },
    },
    {
      name: 'L1-clean-twin',
      file: 'tests/unit/core-determinism-lint.test.ts',
      anchor: "const TWIN_BAN = 'export const twin = Math.random();';",
      replacement: "const TWIN_BAN = 'export const twin = Math.sqrt(2);';",
      red: {
        'tests/unit/core-determinism-lint.test.ts › the ban leaves deterministic code alone > new Date(wallMs) from an explicit argument':
          'the twin found nothing',
        'tests/unit/core-determinism-lint.test.ts › the ban leaves deterministic code alone > Math.sqrt, correctly rounded everywhere':
          'the twin found nothing',
        'tests/unit/core-determinism-lint.test.ts › the ban leaves deterministic code alone > Math.floor and Math.max':
          'the twin found nothing',
        'tests/unit/core-determinism-lint.test.ts › the ban leaves deterministic code alone > Num.pow, built on det-math':
          'the twin found nothing',
        'tests/unit/core-determinism-lint.test.ts › the ban leaves deterministic code alone > a det-math import':
          'the twin found nothing',
      },
    },
  ],
});
