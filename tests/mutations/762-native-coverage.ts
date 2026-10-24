import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The coverage runs load every file natively (#762), in the unit suite.
 * Predicted before the first run (2026-10-24 UTC). The rows break, one at a
 * time: the comparison of each suite step's tests with its coverage run
 * (AC3), its wiring in ci.yml and the coverage measure (AC3), the native
 * loader's reads told from a test's (AC4), and the clock module's spellings
 * and the pinned-path reader's shadow check, refusals that stayed green on
 * the old code (AC2).
 */

const SAME = 'tests/unit/coverage-same-tests.test.ts';
const SCOPE = `${SAME} › the suites compared for each scope (#762 AC3) >`;
const READ = `${SAME} › reading a report (#762 AC3) >`;
const COMPARE = `${SAME} › comparing a suite step with its coverage run (#762 AC3) >`;
const CI = 'tests/unit/coverage-ci.test.ts';
const WRITES = `${CI} › each suite step writes its test report (#762 AC3) >`;
const JOB = `${CI} › the coverage-same-tests job (#762 AC3) >`;
const FAST = 'tests/unit/ci-fast-path.test.ts';
const CLI = 'tests/unit/coverage-cli.test.ts';
const GUARDS_CI = 'tests/unit/guards-ci.test.ts';
const INTEGRATION_CI = 'tests/unit/integration-ci.test.ts';
const LIMITS = 'tests/unit/suite-limits.test.ts';
const WHOLE = 'tests/unit/setup-whole-tree.test.ts';
const LOADS = `${WHOLE} › a module the loader loads is not a read of the checkout (#762) >`;
const TWENTY = `${WHOLE} › twenty of the checkout’s files are a whole-tree read (#530) >`;
const IMPORTS = 'tests/unit/relative-imports.test.ts';
const CALLS = 'tests/unit/collection-calls.test.ts';
const REFUSES = `${CALLS} › the detector refuses a call that reaches workspace code >`;
const READER = `${IMPORTS} › the reader lists each relative specifier a file writes >`;

const MODULE = 'scripts/coverage-same-tests.ts';
const WORKFLOW = '.github/workflows/ci.yml';

export default mutationFile({
  targets: [
    SAME,
    CI,
    FAST,
    CLI,
    GUARDS_CI,
    INTEGRATION_CI,
    LIMITS,
    WHOLE,
    IMPORTS,
    CALLS,
  ],
  mutations: [
    {
      name: 'tests-keyed-by-full-name',
      file: MODULE,
      anchor: 'return JSON.stringify([status, ...ancestorTitles, title]);',
      replacement:
        "return JSON.stringify([status, [...ancestorTitles, title].join(' ')]);",
      red: {
        [`${READ} reads each file, relative to the root, with its status and tests`]:
          'to deeply equal',
        [`${READ} counts two tests of one name as two`]: 'to deeply equal',
        [`${READ} tells titles apart that the full name would join alike`]:
          'to be 2',
        [`${COMPARE} refuses a test the coverage run lost`]: 'to deeply equal',
        [`${COMPARE} refuses one copy of a twice-named test lost`]:
          'to deeply equal',
        [`${COMPARE} refuses a test swapped for another, the count kept`]:
          'to deeply equal',
        [`${COMPARE} refuses a test that failed only under coverage`]:
          'to deeply equal',
      },
    },
    {
      name: 'tests-counted-as-a-set',
      file: MODULE,
      anchor: 'else tests.set(key, (tests.get(key) ?? 0) + 1);',
      replacement: 'else tests.set(key, 1);',
      red: {
        [`${READ} counts two tests of one name as two`]: 'to deeply equal',
        [`${COMPARE} refuses one copy of a twice-named test lost`]:
          'to deeply equal',
      },
    },
    {
      name: 'left-out-file-may-run',
      file: MODULE,
      anchor:
        '    else if (coverage.files.has(file))\n      problems.push(`${file}: left out of the coverage run, yet it ran there`);\n',
      replacement: '',
      red: {
        [`${COMPARE} refuses a left-out file the coverage run ran after all`]:
          'to deeply equal',
      },
    },
    {
      name: 'file-status-unread',
      file: MODULE,
      anchor: '    if (ran.status !== measured.status)\n',
      replacement: '    if (ran.status !== ran.status)\n',
      red: {
        [`${COMPARE} refuses a file that failed only under coverage`]:
          'to deeply equal',
      },
    },
    {
      name: 'file-only-under-coverage-unseen',
      file: MODULE,
      anchor: '    if (compared(file) && !step.files.has(file))\n',
      replacement: '    if (compared(file) && !coverage.files.has(file))\n',
      red: {
        [`${COMPARE} refuses a file coverage ran and the step did not`]:
          'to deeply equal',
      },
    },
    {
      name: 'docs-only-compares-every-suite',
      file: MODULE,
      anchor: "  return scope === 'docs-only' ? DOCS_ONLY_SUITES : undefined;",
      replacement:
        "  return scope === 'docs-only'\n    ? COVERAGE_SUITES.map(({ name }) => name)\n    : undefined;",
      red: {
        [`${SCOPE} compares the two suites a docs-only change runs`]:
          'to deeply equal',
        [`${WRITES} the integration step runs on a docs-only change exactly when its report is compared then`]:
          'to be undefined',
        [`${WRITES} the properties step runs on a docs-only change exactly when its report is compared then`]:
          'to be undefined',
        [`${WRITES} the pacing step runs on a docs-only change exactly when its report is compared then`]:
          'to be undefined',
      },
    },
    {
      name: 'measure-writes-no-report',
      file: 'scripts/coverage.ts',
      anchor: '  ...reporterArgs(coverageReport(name)),\n',
      replacement: '',
      red: {
        [`${CLI} › each suite's coverage run writes its test report (#762 AC3) > runs the suite under its coverage config with the JSON report under coverage/tests`]:
          'to deeply equal',
      },
    },
    {
      name: 'guards-step-drops-annotations',
      file: WORKFLOW,
      anchor:
        'run: npm run test:guards -- --reporter=default --reporter=github-actions --reporter=json',
      replacement:
        'run: npm run test:guards -- --reporter=default --reporter=json',
      red: {
        [`${WRITES} the guards step runs once, writing its report`]:
          'to have a length of 1',
        [`${GUARDS_CI} › the guards suite in CI (#475) > runs as its own step, once, straight after the unit tests, on every change`]:
          'test:guards step',
        [`${INTEGRATION_CI} › the integration suite in CI (#490) > runs as its own step, once, straight after the guards`]:
          'test:guards step',
        [`${LIMITS} › each non-unit suite’s one limit is its CI step’s (#476 AC1) > guards: its step holds it to 1 minute(s)`]:
          'step in build-and-test',
        [`${LIMITS} › each non-unit suite’s one limit is its CI step’s (#476 AC1) > lists every suite step in every CI job, deploy-dev and the logs workflow, and only the unit suite is left to its runner`]:
          'to deeply equal',
      },
    },
    {
      name: 'reports-uploaded-always',
      file: WORKFLOW,
      anchor:
        "      - name: Upload the test reports\n        if: ${{ !cancelled() && (steps.unit.outcome == 'success' || steps.unit.outcome == 'failure') }}\n",
      replacement:
        '      - name: Upload the test reports\n        if: ${{ always() }}\n',
      red: {
        [`${WRITES} uploads the reports once, after every suite step, when the unit step ran`]:
          'to be',
        [`${FAST} › build-and-test’s steps (#360 AC2) > on docs-only, uploads the test reports after a unit step that ran, each condition whole (#762 AC3)`]:
          'to deeply equal',
      },
    },
    {
      name: 'no-scope-output',
      file: WORKFLOW,
      anchor:
        '    outputs:\n      scope: ${{ steps.classify.outputs.scope }}\n',
      replacement: '',
      red: {
        [`${WRITES} tells the comparison which suites ran, from the classify step`]:
          'to deeply equal',
      },
    },
    {
      name: 'comparison-skipped-after-a-failure',
      file: WORKFLOW,
      anchor:
        '    needs: [build-and-test, coverage]\n    if: ${{ !cancelled() }}\n',
      replacement: '    needs: [build-and-test, coverage]\n',
      red: {
        [`${JOB} waits for both jobs and runs after either fails, unless the run is cancelled`]:
          'to be',
      },
    },
    {
      name: 'comparison-ignores-the-scope',
      file: WORKFLOW,
      anchor: '          SCOPE: ${{ needs.build-and-test.outputs.scope }}\n',
      replacement: '          SCOPE: full\n',
      red: {
        [`${JOB} compares the reports for the scope build-and-test ran, after both downloads`]:
          'to deeply equal',
      },
    },
    {
      name: 'any-loader-read-is-a-load',
      file: 'tests/unit/setup-rules.ts',
      anchor: String.raw`  (/(^|\/)node_modules\//.test(path) || CODE_FILE.test(path));`,
      replacement: '  true;',
      red: {
        [`${LOADS} a tree data file the loader reads`]: 'to be false',
        [`${LOADS} a tree text file the loader reads`]: 'to be false',
        [`${LOADS} a file whose name only ends in ts`]: 'to be false',
      },
    },
    {
      name: 'any-code-read-is-a-load',
      file: 'tests/unit/setup-rules.ts',
      anchor: '  stack.includes(LOADER_FRAME) &&\n',
      replacement: '',
      red: {
        [`${LOADS} a tree module a test reads as text`]: 'to be false',
        [`${LOADS} a dependency a test reads as text`]: 'to be false',
        [`${TWENTY} throws at the twentieth, naming the test`]: 'to throw',
        [`${TWENTY} a require of the tree’s own files counts like any other read`]:
          'to throw',
      },
    },
    {
      name: 'clock-module-without-its-folder',
      file: 'tests/unit/collection-calls.ts',
      anchor: String.raw`const CLOCK_MODULE = /\/clock(\.ts)?$/;`,
      replacement: String.raw`const CLOCK_MODULE = /clock(\.ts)?$/;`,
      red: {
        [`${REFUSES} through a clock brand imported from a module whose name only ends in clock (#762)`]:
          'to deeply equal',
      },
    },
    {
      name: 'clock-module-of-any-script-kind',
      file: 'tests/unit/collection-calls.ts',
      anchor: String.raw`const CLOCK_MODULE = /\/clock(\.ts)?$/;`,
      replacement: String.raw`const CLOCK_MODULE = /\/clock(\.tsx?)?$/;`,
      red: {
        [`${REFUSES} through a clock brand imported from a clock file of another kind (#762)`]:
          'to deeply equal',
      },
    },
    {
      name: 'shadowed-const-pinned',
      file: 'tests/unit/helper-modules.ts',
      anchor: '    return all.length === 1 ? all[0] : undefined;\n',
      replacement: '    return all[0];\n',
      red: {
        [`${READER} refuses a const with a second binding of its name`]:
          'to deeply equal',
        [`${READER} refuses a const shadowed by a name after a hole in an array pattern`]:
          'to deeply equal',
        [`${READER} refuses a const shadowed by a destructured parameter`]:
          'to deeply equal',
      },
    },
  ],
});
