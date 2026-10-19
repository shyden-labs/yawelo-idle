import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The one-test-per-case reader classifies every call on `it` and `test`
 * inside a test's body (#678 AC4). Predicted before the first run, from the
 * fixtures in tests/unit/one-test-per-case.test.ts: the only ones holding a
 * call on `it` or `test` inside a test body are the annotation fixture
 * (three annotations), the mistyped member, the nested test and table, and
 * the generated suite/hook/use and step/info/setTimeout cases.
 */

const OTPC = 'tests/unit/one-test-per-case.test.ts';
const READ = `${OTPC} › what the detector read (Refs #82) >`;
const ANNOTATION = `${READ} reads a Playwright annotation inside a test as no test`;
const MISTYPED = `${READ} refuses a member it does not know inside a test body, by line and name (#678)`;
const NESTED_TEST = `${READ} refuses a test nested inside a test, by line and both titles (#678)`;
const NESTED_TABLE = `${READ} refuses a table form nested inside a test, once, by line and both titles (#678)`;
const notInATest = (what: string) =>
  `${READ} refuses ${what} called inside a test, by line and name (#678)`;
const inATest = (what: string) =>
  `${READ} reads ${what} inside a test as no test and refuses nothing (#678)`;

export default mutationFile({
  targets: [OTPC],
  mutations: [
    {
      name: 'body-calls-unread',
      file: 'tests/unit/one-test-per-case.ts',
      anchor:
        '    if (ts.isCallExpression(node) && !readInTest(title, node)) return;',
      replacement: '    // #678 mutant: calls in a test body unread',
      red: {
        [ANNOTATION]: 'the test and its three annotations (#678)',
        [MISTYPED]:
          'line 2: test.skp is neither a test form nor a known non-test',
        [NESTED_TEST]: "line 2: it('inner') is nested inside test 'outer'",
        [NESTED_TABLE]:
          "line 2: it.each(XS)('inner %s') is nested inside test 'outer'",
        [notInATest('a suite')]:
          "line 2: test.describe is called inside test 'outer'",
        [notInATest('a hook')]:
          "line 2: test.beforeEach is called inside test 'outer'",
        [notInATest('test.use')]:
          "line 2: test.use is called inside test 'outer'",
        [inATest('test.step')]: 'one-test-per-case/body-step-calls: read 1',
        [inATest('test.info')]: 'one-test-per-case/body-info-calls: read 1',
        [inATest('test.setTimeout')]:
          'one-test-per-case/body-set-timeout-calls: read 1',
      },
    },
    {
      name: 'annotations-refused',
      file: 'tests/unit/one-test-per-case.ts',
      anchor: '    if (NOT_TESTS.has(member) && !IN_A_TEST.has(member))',
      replacement: '    if (!IN_A_TEST.has(member))',
      red: {
        [ANNOTATION]: "line 3: test.skip is called inside test 't'",
      },
    },
    {
      name: 'in-a-test-members-refused',
      file: 'tests/unit/one-test-per-case.ts',
      anchor: "const IN_A_TEST = new Set(['step', 'setTimeout', 'info']);",
      replacement: 'const IN_A_TEST = new Set<string>([]);',
      red: {
        [inATest('test.step')]: "line 2: test.step is called inside test 't'",
        [inATest('test.info')]: "line 2: test.info is called inside test 't'",
        [inATest('test.setTimeout')]:
          "line 2: test.setTimeout is called inside test 't'",
      },
    },
    {
      name: 'nested-test-read-on',
      file: 'tests/unit/one-test-per-case.ts',
      anchor:
        "        `${at}: ${callee}('${titleOf(sf, call)}') is nested inside test '${title}'`,\n      );\n      return false;",
      replacement:
        "        `${at}: ${callee}('${titleOf(sf, call)}') is nested inside test '${title}'`,\n      );\n      return true;",
      red: {
        [NESTED_TABLE]: "line 2: it.each is nested inside test 'outer'",
      },
    },
  ],
});
