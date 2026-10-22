import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The coverage tool and record (#728), in the unit suite. Predicted before
 * the first run. Each row breaks one behaviour in the code (the kinds table,
 * the line count, the join, the table, the ratchet, the CLI, the fetch, the
 * configs, the workflows), never in a test, and names every unit test that
 * goes red.
 */

const KINDS = 'tests/unit/coverage-kinds.test.ts';
const KIND = `${KINDS} › every tracked file has one kind (#728) >`;
const LINE = `${KINDS} › a file counted by lines is counted at full size (#728) >`;
const TABLE = 'tests/unit/coverage-table.test.ts';
const JOIN = `${TABLE} › suites are joined into one map (#728) >`;
const BUILD = `${TABLE} › the table holds every tracked code file (#728) >`;
const RISE = `${TABLE} › no file grows its untested code (#728) >`;
const CLI = 'tests/unit/coverage-cli.test.ts';
const ENV = `${CLI} › a suite's coverage run never carries the record switch (#728) >`;
const META = `${CLI} › a report is judged only on the commit it measured (#728) >`;
const PLAN = `${CLI} › floors:fetch brings the coverage record back (#728) >`;
const FETCHED = `${CLI} › a fetched coverage record is ratcheted before it is written (#728) >`;
const CONFIG = 'tests/unit/coverage-config.test.ts';
const SKIP = 'tests/unit/coverage-skip.test.ts';
const SUPPLY = 'tests/unit/supply-chain.test.ts';
const PIN = `${SUPPLY} › the coverage tool is pinned to the test runner (#728) >`;
const JOB = 'tests/unit/coverage-ci.test.ts';
const RECORD = 'tests/unit/record-floors-workflow.test.ts';
const LIMITS = 'tests/unit/suite-limits.test.ts';
const FETCH = 'tests/unit/fetch-floors.test.ts';
const WIRING = 'tests/unit/unit-setup-wiring.test.ts';

export default mutationFile({
  targets: [
    KINDS,
    TABLE,
    CLI,
    CONFIG,
    SKIP,
    SUPPLY,
    JOB,
    RECORD,
    LIMITS,
    FETCH,
    WIRING,
  ],
  mutations: [
    {
      name: 'css-of-no-kind',
      file: 'scripts/coverage-kinds.ts',
      anchor: "  '.css',\n",
      replacement: '',
      red: {
        [`${KIND} apps/site/src/styles/holding.css is not-code`]: 'to be',
      },
    },
    {
      name: 'workflows-not-counted',
      file: 'scripts/coverage-kinds.ts',
      anchor: "path.startsWith('.github/workflows/')",
      replacement: "path.startsWith('.github/flows/')",
      red: {
        [`${KIND} .github/workflows/ci.yml is lines`]: 'to be',
        [`${KIND} .github/workflows/x.yaml is lines`]: 'to be',
        [`${LINE} a YAML comment is not code (2)`]: 'not counted by lines',
        [`${LINE} a comment after code is code (1)`]: 'not counted by lines',
        [`${BUILD} a file counted by lines enters at full size, measured by lines`]:
          'to deeply equal',
        [`${BUILD} reads only the files it counts by lines, never a file V8 measured`]:
          'to deeply equal',
      },
    },
    {
      name: 'comment-lines-counted',
      file: 'scripts/coverage-kinds.ts',
      anchor:
        "    .filter((line) => line !== '' && !isComment(path, line)).length;\n",
      replacement: "    .filter((line) => line !== '').length;\n",
      red: {
        [`${LINE} a shell comment is not code (2)`]: 'to be',
        [`${LINE} a YAML comment is not code (2)`]: 'to be',
        [`${LINE} an HTML comment line is not code (1)`]: 'to be',
        [`${BUILD} a file counted by lines enters at full size, measured by lines`]:
          'to deeply equal',
      },
    },
    {
      name: 'refusal-names-v8-for-every-kind',
      file: 'scripts/coverage-kinds.ts',
      anchor:
        "${kind === 'v8' ? 'measured by v8' : (kind ?? 'of no listed kind')}",
      replacement: "${'measured by v8'}",
      red: {
        [`${LINE} refuses to count a file that is not code`]:
          'to throw error including',
        [`${LINE} refuses to count a file of no listed kind`]:
          'to throw error including',
      },
    },
    {
      name: 'every-file-read',
      file: 'scripts/coverage-table.ts',
      anchor: '    const kind = kindOf(path, firstLine);\n',
      replacement:
        '    read(path);\n    const kind = kindOf(path, firstLine);\n',
      red: {
        [`${BUILD} reads only the files it counts by lines, never a file V8 measured`]:
          'to deeply equal',
      },
    },
    {
      name: 'join-keeps-the-first-suite',
      file: 'scripts/coverage-table.ts',
      anchor: '  for (const map of maps) joined.merge(map);\n',
      replacement: '  for (const map of maps.slice(0, 1)) joined.merge(map);\n',
      red: {
        [`${JOIN} a statement one suite ran counts as run in the join`]:
          'to deeply equal',
        [`${JOIN} a branch arm one suite took counts as taken in the join`]:
          'to deeply equal',
        [`${JOIN} keeps every file any suite reported`]: 'to deeply equal',
      },
    },
    {
      name: 'missing-file-recorded-as-zero',
      file: 'scripts/coverage-table.ts',
      anchor:
        '      if (data === undefined)\n        problems.push(`${path} is tracked code but no suite reported it`);\n',
      replacement:
        "      if (data === undefined)\n        table[path] = { measure: 'v8', statements: { untested: 0, total: 0 }, branches: { untested: 0, total: 0 } };\n",
      red: {
        [`${BUILD} a tracked V8 file missing from the report is a problem, never zero`]:
          'to deeply equal',
      },
    },
    {
      name: 'branch-arms-not-ratcheted',
      file: 'scripts/coverage-table.ts',
      anchor: "  ['branches', 'branch arms'],\n",
      replacement: '',
      red: {
        [`${RISE} a rise in untested branch arms is judged on its own`]:
          'to deeply equal',
      },
    },
    {
      name: 'new-file-enters-untested',
      file: 'scripts/coverage-table.ts',
      anchor: '      const was = before?.[key].untested ?? 0;\n',
      replacement: '      const was = before?.[key].untested ?? Infinity;\n',
      red: {
        [`${RISE} a file new to the record with untested code is refused`]:
          'to deeply equal',
        [`${RISE} a file new to the record with nothing untested passes, beside one that has some`]:
          'to deeply equal',
        [`${RISE} a renamed file is judged against its old path, not as new`]:
          'to deeply equal',
      },
    },
    {
      name: 'rename-judged-as-new',
      file: 'scripts/coverage-table.ts',
      anchor: '    const old = renamed.get(path) ?? path;\n',
      replacement: '    const old = path;\n',
      red: {
        [`${RISE} a renamed file is judged against its old path, not as new`]:
          'to deeply equal',
        [`${RISE} a renamed file that grew is named with its old path`]:
          'to deeply equal',
      },
    },
    {
      name: 'thousands-ungrouped',
      file: 'scripts/coverage.ts',
      anchor: "${untested.toLocaleString('en')} of",
      replacement: '${String(untested)} of',
      red: {
        [`${CLI} › a count reads as the share of code run (#728) > groups thousands, as the probe figures were written`]:
          'to be',
      },
    },
    {
      name: 'record-switch-kept',
      file: 'scripts/coverage.ts',
      anchor:
        '        entry[0] !== RECORD_JOB_ENV && entry[1] !== undefined,\n',
      replacement: '        entry[1] !== undefined,\n',
      red: {
        [`${ENV} drops FLOORS_RECORD_JOB, so the measured code runs as it does on a pull request`]:
          'to deeply equal',
      },
    },
    {
      name: 'report-of-another-commit-judged',
      file: 'scripts/coverage.ts',
      anchor: '  return commit === head\n',
      replacement: '  return true\n',
      red: {
        [`${META} another commit is refused, naming both`]: 'to be',
      },
    },
    {
      name: 'tree-record-left-stale',
      file: 'scripts/coverage.ts',
      anchor: '  return local\n',
      replacement: '  return false\n',
      red: {
        [`${PLAN} refuses when the tree has a record and the run uploaded none`]:
          'to be',
      },
    },
    {
      name: 'unreadable-base-record-trusted',
      file: 'scripts/coverage.ts',
      anchor:
        "    return ['the coverage record at the merge base is not a record'];\n",
      replacement: '    return [];\n',
      red: {
        [`${FETCHED} refuses a base record it cannot read`]: 'to deeply equal',
      },
    },
    {
      name: 'coverage-keeps-the-cpu-check',
      file: 'vitest.coverage.unit.config.ts',
      anchor: "    setupFiles: ['tests/unit/setup-refusals.ts'],\n",
      replacement: "    setupFiles: ['tests/unit/setup.ts'],\n",
      red: {
        [`${CONFIG} › the unit suite under coverage (#728) > keeps every refusal (process, socket, checkout reads) but not the CPU check`]:
          'to deeply equal',
      },
    },
    {
      name: 'coverage-keeps-a-test-limit',
      file: 'vitest.coverage.unit.config.ts',
      anchor: '    testTimeout: 0,\n',
      replacement: '    testTimeout: 1_000,\n',
      red: {
        [`${CONFIG} › the unit suite under coverage (#728) > carries no per-test limit`]:
          'to deeply equal',
        [`${LIMITS} › no non-unit suite’s config sets a limit of its own (#476 AC2) > vitest.coverage.unit.config.ts turns off Vitest’s per-test and per-hook defaults`]:
          'to be',
      },
    },
    {
      name: 'unit-step-measures-coverage',
      file: 'vitest.config.ts',
      anchor: '    testTimeout: 1_000,\n',
      replacement:
        '    coverage: { enabled: false },\n    testTimeout: 1_000,\n',
      red: {
        [`${CONFIG} › the plain unit step keeps coverage off and its limits (#728) > names no coverage block`]:
          'to be undefined',
        [`${LIMITS} › the unit suite’s limit is its runner’s: 1 s, judged with coverage off (#477 AC1, AC5) > runs in its own CI step, with no coverage to slow it`]:
          'to not have property',
      },
    },
    {
      name: 'exclude-drops-the-tests',
      file: 'scripts/coverage-config.ts',
      anchor: "  'coverage/**',\n];\n",
      replacement: "  'coverage/**',\n  '**/*.test.ts',\n];\n",
      red: {
        [`${CONFIG} › the provider excludes only what is not ours (#728) > dependencies, build output and the coverage reports themselves`]:
          'to deeply equal',
      },
    },
    {
      name: 'catch-all-takes-vitest',
      file: '.github/dependabot.yml',
      anchor:
        "        exclude-patterns:\n          - 'vitest'\n          - '@vitest/*'\n",
      replacement: '',
      red: {
        [`${PIN} the patch catch-all excludes the vitest group's patterns, since Dependabot scores groups and order decides nothing`]:
          'to deeply equal',
      },
    },
    {
      name: 'coverage-tool-unpinned',
      file: 'package.json',
      anchor: '    "@vitest/coverage-v8": "5.0.3",\n',
      replacement: '    "@vitest/coverage-v8": "^5.0.3",\n',
      red: {
        [`${PIN} package.json names @vitest/coverage-v8 at the installed Vitest version, exactly`]:
          'to be',
        [`${SUPPLY} › the install is reproducible > a lock file is committed and agrees with package.json`]:
          'to deeply equal',
      },
    },
    {
      name: 'report-uploaded-after-a-skipped-measure',
      file: '.github/workflows/ci.yml',
      anchor:
        "        if: ${{ !cancelled() && (steps.measure.outcome == 'success' || steps.measure.outcome == 'failure') }}\n",
      replacement: '',
      red: {
        [`${JOB} › the coverage job (#728) > keeps the report after a measure that ran, and fails when it is missing`]:
          'to be',
      },
    },
    {
      name: 'measure-step-unlimited',
      file: '.github/workflows/ci.yml',
      anchor:
        '        timeout-minutes: 12\n        run: npm run test:coverage\n',
      replacement: '        run: npm run test:coverage\n',
      red: {
        [`${LIMITS} › each non-unit suite’s one limit is its CI step’s (#476 AC1) > coverage: its step holds it to 12 minute(s)`]:
          'to be',
      },
    },
    {
      name: 'measure-runs-with-the-record-switch',
      file: '.github/workflows/record-floors.yml',
      anchor:
        '      - name: Measure coverage\n        timeout-minutes: 12\n        run: npm run test:coverage\n',
      replacement:
        '      - name: Measure coverage\n        timeout-minutes: 12\n        env:\n          FLOORS_RECORD_JOB: record-floors\n        run: npm run test:coverage\n',
      red: {
        [`${RECORD} › the record-floors workflow (#547, #718) > measures coverage without the switch on a fresh install of the commit, the recorded floors laid over it, then records it with the switch (#728, #748)`]:
          'to deeply equal',
      },
    },
    {
      name: 'coverage-artifact-named-as-the-floors',
      file: 'scripts/fetch-floors.ts',
      anchor:
        'export const coverageArtifactName = (sha: string): string => `coverage-${sha}`;\n',
      replacement:
        'export const coverageArtifactName = (sha: string): string => `floors-${sha}`;\n',
      red: {
        [`${FETCH} › coverageArtifactName (#728) > names the coverage record by the commit it ran on, apart from the floors`]:
          'to be',
      },
    },
    {
      name: 'any-url-read-as-a-run',
      file: 'scripts/fetch-floors.ts',
      anchor:
        '  if (match === null) throw new Error(`not a run URL: ${url}`);\n',
      replacement: '  if (match === null) return url;\n',
      red: {
        [`${FETCH} › repoOfRunUrl (#728) > refuses a URL that is not a run of a repository`]:
          'to throw',
      },
    },
    {
      name: 'c8-skips-unseen',
      file: 'tests/unit/coverage-skip.ts',
      anchor: 'const SKIP = /\\b(?:v8|c8|istanbul)\\s+ignore\\b/i;\n',
      replacement: 'const SKIP = /\\b(?:v8|istanbul)\\s+ignore\\b/i;\n',
      red: {
        [`${SKIP} › every form of a skip comment is found (#728) > c8, next (1)`]:
          'to have a length',
        [`${SKIP} › every form of a skip comment is found (#728) > c8, a line comment (1)`]:
          'to have a length',
        [`${SKIP} › the same words outside a comment are not a skip (#728) > a string`]:
          'to deeply equal',
        [`${SKIP} › the same words outside a comment are not a skip (#728) > a template`]:
          'to deeply equal',
        [`${SKIP} › the same words outside a comment are not a skip (#728) > a regex`]:
          'to deeply equal',
        [`${SKIP} › the same words outside a comment are not a skip (#728) > prose naming the tool`]:
          'to deeply equal',
        [`${SKIP} › a finding names the file and the comment (#728) > reads like a reason`]:
          'to deeply equal',
      },
    },
    {
      name: 'literals-read-as-comments',
      file: 'tests/unit/source-text.ts',
      anchor: '  blankLiterals(sf).match(',
      replacement: '  sf.getFullText().match(',
      red: {
        [`${SKIP} › the same words outside a comment are not a skip (#728) > a string`]:
          'to deeply equal',
        [`${SKIP} › the same words outside a comment are not a skip (#728) > a template`]:
          'to deeply equal',
      },
    },
    {
      name: 'cpu-check-unwired',
      file: 'tests/unit/setup.ts',
      anchor:
        'afterEach((context) => {\n  const used = process.threadCpuUsage(started);\n',
      replacement:
        'void ((context: { task: { file: { name: string }; name: string } }) => {\n  const used = process.threadCpuUsage(started);\n',
      red: {
        [`${WIRING} › the unit step holds each test to its CPU (#728) > its setup fails a test over its CPU limit, after the test`]:
          'to have a length',
      },
    },
    {
      name: 'refusals-import-respelled',
      file: 'tests/unit/setup.ts',
      anchor: "import './setup-refusals.ts';\n",
      replacement: "import './setup-refusals';\n",
      red: {
        [`${WIRING} › the unit step holds each test to its CPU (#728) > its setup loads every refusal`]:
          'to include',
      },
    },
  ],
});
