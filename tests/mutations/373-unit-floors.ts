import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The workflow guards' and the one-test-per-case reader's absence searches
 * check floors on what each search read (#373 AC4). Predicted before the
 * first run, from the population measured on the branch: 10 workflows, 22
 * jobs (19 that run steps and 3 reusable-workflow calls, one each in
 * deploy-dev, deploy-prod and every-commit, since retired by #679), 4
 * workflows naming a stored
 * secret, and one job or call in each fixture.
 *
 * Each mutation blinds a reader to part of what it reads (one job, one call,
 * one workflow file, one kind of call), and goes red through that
 * population's floor while the verdicts stay clean. A fixture's population
 * of one takes a loss mutant, refused by `searched` as an empty population,
 * and a growth mutant, seen by the floor alone. The fixture tests check
 * their floor before their older exact counts, so the floor is what fails.
 */

const SECRETS = 'tests/unit/workflow-secrets.test.ts';
const SCAN_WORKFLOW = `${SECRETS} › scanWorkflow >`;
const REPO_SECRETS = `${SECRETS} › this repo’s workflows keep every secret inside an environment >`;
const DEV = `${SCAN_WORKFLOW} accepts a secret in a job that declares the dev environment`;
const LONG = `${SCAN_WORKFLOW} accepts the long form, environment: { name: production, url }`;
const SECRET_JOBS = `${REPO_SECRETS} no secret is read outside a protected environment`;

const TIMEOUTS = 'tests/unit/workflow-timeouts.test.ts';
const SCAN_TIMEOUTS = `${TIMEOUTS} › scanTimeouts >`;
const REPO_TIMEOUTS = `${TIMEOUTS} › this repo’s workflows stop every job within minutes >`;
const INSIDE = `${SCAN_TIMEOUTS} accepts a job with a timeout inside the bound`;
const AT_BOUND = `${SCAN_TIMEOUTS} accepts the bound itself, 30 minutes`;
const LOCAL_CALL = `${SCAN_TIMEOUTS} accepts a call to a local reusable workflow, whose own jobs carry the timeouts`;
const TIMEOUT_JOBS = `${REPO_TIMEOUTS} every job has a timeout of at most 30 minutes`;
const REPO_CALLS = `${REPO_TIMEOUTS} every reusable-workflow call names a workflow that is scanned here`;
const LIVENESS = `${REPO_TIMEOUTS} checks every job it finds (liveness)`;

const OTPC = 'tests/unit/one-test-per-case.test.ts';
const DETECTOR = `${OTPC} › the detector >`;
const READ = `${OTPC} › what the detector read (Refs #82) >`;
const ALLOWED: readonly (readonly [string, string])[] = [
  ['a loop that generates one test per case', 'generated'],
  ['a loop with no assertion or page change in it', 'no-assertion'],
  ['a loop in a describe body', 'describe-body'],
  ['a loop in test.describe', 'test-describe'],
  ['a loop in a hook', 'hook'],
  ['a runtime population, declared above the loop', 'runtime-population'],
  ['one scenario, declared above the loop', 'one-scenario'],
  [
    'a runtime population, declared above the statement holding the loop',
    'runtime-population-statement',
  ],
];

/** Every allowed-loop test, each failing with `text(id)`. */
const allowed = (text: (id: string) => string) =>
  Object.fromEntries(
    ALLOWED.map(([what, id]) => [`${DETECTOR} leaves alone ${what}`, text(id)]),
  );

/** The four tests outside the allowed table that read the count of tests. */
const testCounts = (all: number, one: number) => ({
  [`${READ} counts every test call it read: bare, modified, table, nested in a describe`]: `${String(all)} to be 4`,
  [`${READ} reads a test body written as a function expression, and judges it`]: `${String(one)} to be 1`,
  [`${READ} reads a chained modifier and its table form as one test, and judges its body`]: `${String(one)} to be 1`,
  [`${READ} reads a Playwright annotation inside a test as no test`]: `${String(one)} to be 1`,
});

const EMPTY = 'an absence assertion over an empty population';

const JOB_REFERENCES =
  '    references.push(...refs.map((ref) => `${file}: jobs.${id}: ${ref}`));';
const JOB_LOOP = '  for (const [id, job] of jobs) {\n    read += 1;';
const LOCAL_PUSH = '        calls.push(job.uses);';
const CHECKED = '    checked += 1;';
const TEST_CALL_PUSH =
  "          testCalls.push(\n            `line ${String(lineOf(sf, node))}: ${callee}('${titleOf(sf, node)}')`,\n          );";

export default mutationFile({
  targets: [SECRETS, TIMEOUTS, OTPC],
  mutations: [
    {
      name: 'secrets-references-twice',
      file: 'tests/unit/workflow-secrets.ts',
      anchor: JOB_REFERENCES,
      replacement: `${JOB_REFERENCES}\n${JOB_REFERENCES}`,
      red: {
        [DEV]: 'workflow-secrets/dev-environment-references: read 2',
        [LONG]: 'workflow-secrets/long-form-references: read 2',
      },
    },
    {
      name: 'secrets-references-dropped',
      file: 'tests/unit/workflow-secrets.ts',
      anchor: JOB_REFERENCES,
      replacement: '    // job references not recorded',
      red: {
        [DEV]: `searched no secret references: ${EMPTY}`,
        [LONG]: `searched no secret references: ${EMPTY}`,
        [`${REPO_SECRETS} reads a reference in every workflow whose text names a stored secret (Refs #82)`]:
          'board-orphans.yml',
        [`${REPO_SECRETS} finds the deploy secrets it is guarding (liveness)`]:
          'deploy-dev.yml reads two Cloudflare secrets and the dev password',
      },
    },
    {
      name: 'secrets-list-job-unread',
      file: 'tests/unit/workflow-secrets.ts',
      anchor: JOB_LOOP,
      replacement:
        "  for (const [id, job] of jobs) {\n    if (id === 'list') continue;\n    read += 1;",
      red: { [SECRET_JOBS]: 'workflow-secrets/repo-jobs: read 21' },
    },
    {
      name: 'secrets-logs-workflow-unlisted',
      file: SECRETS,
      anchor: '      .filter((f) => /\\.ya?ml$/.test(f))',
      replacement:
        "      .filter((f) => /\\.ya?ml$/.test(f) && f !== 'logs.yml')",
      red: {
        [`${REPO_SECRETS} scans every workflow, and every one has jobs`]:
          'workflow-secrets/workflows: read 9',
        [SECRET_JOBS]: 'workflow-secrets/repo-jobs: read 21',
      },
    },
    {
      name: 'secrets-rollback-unnamed',
      file: SECRETS,
      anchor: '    const naming = scanAll().filter(({ file }) =>',
      replacement:
        "    const naming = scanAll().filter(({ file }) => file !== 'rollback-prod.yml' &&",
      red: {
        [`${REPO_SECRETS} reads a reference in every workflow whose text names a stored secret (Refs #82)`]:
          'workflow-secrets/secret-naming-workflows: read 3',
      },
    },
    {
      name: 'timeouts-checked-twice',
      file: 'tests/unit/workflow-timeouts.ts',
      anchor: CHECKED,
      replacement: '    checked += 2;',
      red: {
        [INSIDE]: 'workflow-timeouts/inside-bound-jobs: read 2',
        [AT_BOUND]: 'workflow-timeouts/at-bound-jobs: read 2',
        [TIMEOUT_JOBS]: 'workflow-timeouts/repo-jobs: read 41',
      },
    },
    {
      name: 'timeouts-checked-none',
      file: 'tests/unit/workflow-timeouts.ts',
      anchor: CHECKED,
      replacement: '    checked += 0;',
      red: {
        [INSIDE]: `searched no jobs checked: ${EMPTY}`,
        [AT_BOUND]: `searched no jobs checked: ${EMPTY}`,
        [LIVENESS]: 'jobs judged, counted as jobs, not files',
        [TIMEOUT_JOBS]: 'workflow-timeouts/repo-jobs: read 3',
      },
    },
    {
      name: 'timeouts-calls-twice',
      file: 'tests/unit/workflow-timeouts.ts',
      anchor: LOCAL_PUSH,
      replacement: '        calls.push(job.uses, job.uses);',
      red: {
        [LOCAL_CALL]: 'workflow-timeouts/local-call-calls: read 2',
        [REPO_CALLS]: 'workflow-timeouts/repo-calls: read 6',
        [TIMEOUT_JOBS]: 'workflow-timeouts/repo-jobs: read 25',
      },
    },
    {
      name: 'timeouts-calls-none',
      file: 'tests/unit/workflow-timeouts.ts',
      anchor: LOCAL_PUSH,
      replacement: '        // call not recorded',
      red: {
        [LOCAL_CALL]: `searched no reusable-workflow calls: ${EMPTY}`,
        [REPO_CALLS]: `searched no reusable-workflow calls: ${EMPTY}`,
        [TIMEOUT_JOBS]: 'workflow-timeouts/repo-jobs: read 19',
      },
    },
    {
      name: 'timeouts-prod-call-unread',
      file: 'tests/unit/workflow-timeouts.ts',
      anchor: LOCAL_PUSH,
      replacement:
        "        if (file !== 'deploy-prod.yml') calls.push(job.uses);",
      red: {
        [REPO_CALLS]: 'workflow-timeouts/repo-calls: read 2',
        [TIMEOUT_JOBS]: 'workflow-timeouts/repo-jobs: read 21',
      },
    },
    {
      name: 'timeouts-changed-job-unread',
      file: 'tests/unit/workflow-timeouts.ts',
      anchor: CHECKED,
      replacement: "    if (id === 'changed') continue;\n    checked += 1;",
      red: { [TIMEOUT_JOBS]: 'workflow-timeouts/repo-jobs: read 21' },
    },
    {
      name: 'timeouts-logs-workflow-unlisted',
      file: TIMEOUTS,
      anchor:
        '  const files = () => readdirSync(dir).filter((f) => /\\.ya?ml$/.test(f));',
      replacement:
        "  const files = () =>\n    readdirSync(dir).filter((f) => /\\.ya?ml$/.test(f) && f !== 'logs.yml');",
      red: {
        [LIVENESS]: 'workflow-timeouts/workflows: read 9',
        [TIMEOUT_JOBS]: 'workflow-timeouts/repo-jobs: read 21',
      },
    },
    {
      name: 'tests-read-twice',
      file: 'tests/unit/one-test-per-case.ts',
      anchor: '          inTest(titleOf(sf, node), callback.body);',
      replacement:
        "          testCalls.push('a second reading');\n          inTest(titleOf(sf, node), callback.body);",
      red: {
        ...allowed((id) => `one-test-per-case/allowed-${id}: read 2`),
        ...testCounts(8, 2),
      },
    },
    {
      name: 'tests-unrecorded',
      file: 'tests/unit/one-test-per-case.ts',
      anchor: TEST_CALL_PUSH,
      replacement: '          // test call not recorded',
      red: {
        ...allowed(() => `searched no test calls: ${EMPTY}`),
        ...testCounts(0, 0),
      },
    },
    {
      name: 'other-calls-uncounted',
      file: 'tests/unit/one-test-per-case.ts',
      anchor: "      if (kind !== 'none') examined += 1;",
      replacement:
        "      if (kind !== 'none' && kind !== 'other') examined += 1;",
      red: {
        [`${READ} reads a describe modifier as no test and refuses nothing`]: `searched no calls on test: ${EMPTY}`,
      },
    },
    {
      // The annotation fixture examines its one test call: the reader stops at
      // a test's body, so the annotations inside it are never examined.
      name: 'test-calls-examined-twice',
      file: 'tests/unit/one-test-per-case.ts',
      anchor: "      if (kind !== 'none') examined += 1;",
      replacement:
        "      if (kind !== 'none') examined += kind === 'test' ? 2 : 1;",
      red: {
        [`${READ} reads a Playwright annotation inside a test as no test`]:
          'one-test-per-case/annotation-calls: read 2',
      },
    },
  ],
});
