import { describe, expect, it } from 'vitest';
import { RECORD_JOB_ENV } from '../../scripts/record-floors';
import { OUTPUT_DIR } from '../../scripts/rehearse.ts';
import { floorBreach } from '../floors';
import { searched } from '../searched';
import {
  envSites,
  jobIn,
  stepIn,
  workflow,
  workflowFiles,
  type WorkflowJob,
  type WorkflowStep,
} from './workflow-file';
import { runOf } from './workflow-steps';

/**
 * The record-floors workflow (#547; global rule 2026-10-09: "Floors are
 * recorded by a separate CI job"). It measures a commit the session has not
 * pushed to its branch (global rule 2026-10-21: "a CI bot never pushes to a
 * branch"): the session pushes it to the scratch ref `refs/floors/<branch>`
 * and dispatches this workflow on develop with the branch and SHA, because a
 * scratch ref starts no run and `workflow_dispatch` refuses one (#718 AC1,
 * run 39521577298). It records every suite's floors at that SHA and uploads
 * them, named by it, for `npm run floors:fetch` to fold into the unpushed
 * commit. Only it sets the recorder's switch: a run that checks the figures
 * never records them.
 */

const FILE = 'record-floors.yml';
const ID = 'record-floors';
const COVERAGE = 'record-coverage';
const REHEARSE = 'rehearse';
const REHEARSAL = 'rehearsal-${{ inputs.sha }}';
const MEASURE_RUN = `npm run test:coverage -- ${OUTPUT_DIR}/`;
/**
 * Each script starts from one inline line, not a start file (Shyden,
 * 2026-10-28: "Start line in the workflow"): an entry file is either an
 * untested new file or a call at collection.
 */
const GATE_RUN = `node --input-type=module -e "const { gate, nodeIo } = await import('./scripts/record-gate.ts'); process.exitCode = gate(nodeIo);"`;
const REHEARSE_RUN = `node --input-type=module -e "const { rehearse, nodeRehearseIo } = await import('./scripts/rehearse.ts'); process.exitCode = await rehearse(nodeRehearseIo);"`;
const REFUSE = "Refuse anything but the tip of a ticket branch's scratch ref";
const LAY = 'Lay the recorded floors over the tree';

const job = (): WorkflowJob => jobIn(FILE, ID);
const step = (name: string): WorkflowStep => stepIn(FILE, ID, name);
const coverageJob = (): WorkflowJob => jobIn(FILE, COVERAGE);
const coverageStep = (name: string): WorkflowStep =>
  stepIn(FILE, COVERAGE, name);
const coverageNames = (): (string | undefined)[] =>
  (coverageJob().steps ?? []).map((s) => s.name ?? s.uses);
const ciCoverage = (): WorkflowJob => jobIn('ci.yml', 'coverage');
const rehearseJob = (): WorkflowJob => jobIn(FILE, REHEARSE);
// The file holds this job's steps; a test reading none fails, never passes.
const rehearseSteps = (): readonly WorkflowStep[] =>
  rehearseJob().steps as readonly WorkflowStep[];
/** A step's label for ordering: its name, else a checkout's ref, else its action. */
const label = (s: WorkflowStep): string | undefined =>
  s.name ?? (s.with?.ref as string | undefined) ?? s.uses;

/**
 * Every way a job could reach a credential (#771 AC6): an environment, its
 * own permissions or env, a reusable workflow's call or inherited secrets,
 * or a secret or the run's token named anywhere in it.
 */
const credentialRoutes = (j: Readonly<Record<string, unknown>>): string[] => [
  ...['environment', 'permissions', 'env', 'secrets', 'uses']
    .filter((key) => key in j)
    .map((key) => `job ${key}`),
  ...['secrets.', 'github.token'].filter((name) =>
    JSON.stringify(j).includes(name),
  ),
];
const switchSites = (file: string): string[] => envSites(file, RECORD_JOB_ENV);

describe('the record-floors workflow (#547, #718)', () => {
  it('runs only when dispatched, with the branch and the SHA to measure', () => {
    expect(workflow(FILE).on).toEqual({
      workflow_dispatch: {
        inputs: {
          branch: {
            description: 'The ticket branch whose scratch ref holds the commit',
            required: true,
            type: 'string',
          },
          sha: {
            description: 'The full SHA at refs/floors/<branch>',
            required: true,
            type: 'string',
          },
        },
      },
    });
  });

  it('names each run by the branch and SHA it measured, for floors:fetch to read', () => {
    expect(workflow(FILE)['run-name']).toBe(
      'record-floors ${{ inputs.branch }} at ${{ inputs.sha }}',
    );
  });

  it('runs its job unconditionally: no label decides it', () => {
    expect(job().if).toBeUndefined();
  });

  it('holds the floors job, then a coverage job that waits for it, unconditionally (#748)', () => {
    expect([
      Object.keys(workflow(FILE).jobs ?? {}),
      job().needs,
      coverageJob().needs,
      coverageJob().if,
    ]).toEqual([[REHEARSE, ID, COVERAGE], REHEARSE, ID, undefined]);
  });

  it('refuses, naming what the file holds, a job or a step it does not hold (#748)', () => {
    expect(() => jobIn(FILE, 'missing')).toThrow(
      `${FILE} holds jobs ${REHEARSE}, ${ID}, ${COVERAGE}, not missing`,
    );
    expect(() => stepIn(FILE, COVERAGE, 'missing')).toThrow(
      `${FILE} holds 0 steps named "missing" in ${COVERAGE}`,
    );
  });

  it('reads the repository and writes nothing', () => {
    expect(workflow(FILE).permissions).toEqual({ contents: 'read' });
  });

  it('gates the commit first, from the workflow’s own checkout, through the tested gate (#771)', () => {
    const steps = rehearseSteps();
    const gate = stepIn(FILE, REHEARSE, REFUSE);
    expect([
      steps.findIndex((s) => s.name === REFUSE),
      steps[0]?.uses?.startsWith('actions/checkout@'),
      steps[0]?.with,
      steps[1]?.uses?.startsWith('actions/setup-node@'),
      steps[1]?.with,
      runOf(gate),
      gate.env,
    ]).toEqual([
      2,
      true,
      undefined,
      true,
      { 'node-version-file': '.nvmrc' },
      GATE_RUN,
      undefined,
    ]);
    // Nothing before the gate reads the dispatch's inputs; after it, the
    // checkout does (liveness).
    expect([
      JSON.stringify(steps.slice(0, 3)).includes('inputs.'),
      JSON.stringify(steps.slice(3)).includes('inputs.sha'),
    ]).toEqual([false, true]);
  });

  it('checks out exactly the SHA it was given, in each job', () => {
    const checkouts = [rehearseJob(), job(), coverageJob()].flatMap((j) =>
      (j.steps ?? []).filter((s) => s.uses?.startsWith('actions/checkout@')),
    );
    expect(checkouts.map((s) => s.with)).toEqual([
      undefined,
      { ref: '${{ inputs.sha }}', 'persist-credentials': false },
      { ref: '${{ inputs.sha }}', 'fetch-depth': 2 },
      { ref: '${{ inputs.sha }}', 'fetch-depth': 2 },
    ]);
  });

  it('refuses, before the checkout, a SHA that is not the scratch ref’s tip', () => {
    // The refusals themselves are record-gate.ts's (tests/unit/record-gate.test.ts).
    const jobs = workflow(FILE).jobs as Readonly<Record<string, WorkflowJob>>;
    const reaches = (id: string, seen: readonly string[] = []): boolean =>
      id === REHEARSE ||
      [(jobs[id] as WorkflowJob).needs]
        .flat()
        .some(
          (need) =>
            typeof need === 'string' &&
            !seen.includes(need) &&
            reaches(need, [...seen, id]),
        );
    const checkingOut = Object.keys(jobs).filter((id) =>
      ((jobs[id] as WorkflowJob).steps as readonly WorkflowStep[]).some(
        (s) => s.with?.ref === '${{ inputs.sha }}',
      ),
    );
    // Every job checks the commit out (liveness).
    expect(checkingOut).toEqual([REHEARSE, ID, COVERAGE]);
    expect(
      searched(
        checkingOut.filter((id) => !reaches(id)),
        { of: checkingOut, what: 'jobs that check out the given SHA' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('record-floors-workflow/sha-checkouts', checkingOut.length),
    ).toBeUndefined();
    const labels = rehearseSteps().map(label);
    // A missing gate's index is -1, which sorts before any step.
    expect(labels).toContain(REFUSE);
    expect(labels.indexOf(REFUSE)).toBeLessThan(
      labels.indexOf('${{ inputs.sha }}'),
    );
  });

  it('holds no credential in the rehearse job (#771 AC6)', () => {
    expect([
      workflow(FILE).permissions,
      credentialRoutes(rehearseJob() as Record<string, unknown>),
    ]).toEqual([{ contents: 'read' }, []]);
  });

  it.each([
    ['an environment', { environment: 'dev' }, ['job environment']],
    ['its own permissions', { permissions: 'write-all' }, ['job permissions']],
    ['its own env', { env: { A: '1' } }, ['job env']],
    [
      'a reusable workflow with inherited secrets',
      { uses: './.github/workflows/ci.yml', secrets: 'inherit' },
      ['job secrets', 'job uses'],
    ],
    [
      'a secret in a step',
      { steps: [{ env: { T: '${{ secrets.CLOUDFLARE_API_TOKEN }}' } }] },
      ['secrets.'],
    ],
    [
      'the run’s token in a step',
      { steps: [{ with: { token: '${{ github.token }}' } }] },
      ['github.token'],
    ],
  ])('sees a rehearse job given %s', (_case, plant, routes) => {
    expect(
      credentialRoutes({
        ...(rehearseJob() as Record<string, unknown>),
        ...plant,
      }),
    ).toEqual(routes);
  });

  it('rehearses on the runner host, uploading the manifest named by the commit, failing when it is missing (#771)', () => {
    const rehearse = stepIn(FILE, REHEARSE, 'Rehearse the workflows');
    const upload = rehearseSteps().find((s) =>
      s.uses?.startsWith('actions/upload-artifact@'),
    );
    expect([
      rehearseJob()['runs-on'],
      rehearseJob().container,
      rehearseJob()['timeout-minutes'],
      runOf(rehearse),
      rehearse.env,
      upload?.with,
    ]).toEqual([
      'ubuntu-24.04',
      undefined,
      10,
      REHEARSE_RUN,
      undefined,
      {
        name: REHEARSAL,
        path: `${OUTPUT_DIR}/`,
        'if-no-files-found': 'error',
      },
    ]);
    const labels = rehearseSteps().map(label);
    // A missing checkout's index is -1, which sorts before any step: its
    // presence is asserted first.
    expect([
      labels.includes('${{ inputs.sha }}'),
      labels.indexOf('${{ inputs.sha }}') <
        labels.indexOf('Rehearse the workflows'),
      labels.indexOf('Rehearse the workflows') <
        labels.findIndex((l) => l?.startsWith('actions/upload-artifact@')),
    ]).toEqual([true, true, true]);
  });

  it('lays the rehearsal over the tree after the install and before Measure judges it (#771)', () => {
    const steps = coverageJob().steps as readonly WorkflowStep[];
    const at = steps.findIndex(
      (s) =>
        s.uses?.startsWith('actions/download-artifact@') &&
        s.with?.name === REHEARSAL,
    );
    // A missing install's index is -1, which sorts before any step.
    const install = steps.findIndex(
      (s) => s.name === 'Install (a warning fails it)',
    );
    expect([
      steps[at]?.with,
      install !== -1,
      install < at,
      at < steps.findIndex((s) => s.name === 'Measure coverage'),
    ]).toEqual([{ name: REHEARSAL, path: `${OUTPUT_DIR}/` }, true, true, true]);
  });

  it('pushes nothing: no step of either job runs git push or holds a token', () => {
    const steps = [
      ...rehearseSteps(),
      ...(job().steps ?? []),
      ...(coverageJob().steps ?? []),
    ];
    // The reader sees each step's command where each recorder runs (liveness).
    expect(steps.map(runOf)).toEqual(
      expect.arrayContaining([
        'npm run floors:record',
        'node scripts/coverage.ts record',
      ]),
    );
    expect(
      searched(
        steps.filter(
          (s) =>
            /\bgit\s+push\b/.test(runOf(s)) ||
            JSON.stringify(s).includes('secrets.'),
        ),
        { of: steps, what: 'record-floors steps' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('record-floors-workflow/steps', steps.length),
    ).toBeUndefined();
  });

  it('runs in the same pinned image as the CI job, where the browser suites run', () => {
    const ci = workflow('ci.yml').jobs?.['build-and-test']?.container?.image;
    expect(ci).toMatch(/^mcr\.microsoft\.com\/playwright:.+@sha256:/);
    expect(job().container?.image).toBe(ci);
  });

  it("measures coverage in the pull request's coverage job's image, user and limits (#748)", () => {
    const measure = coverageStep('Measure coverage');
    const ciMeasure = (ciCoverage().steps ?? []).find(
      (s) => runOf(s) === 'npm run test:coverage',
    );
    expect(ciCoverage().container?.image).toMatch(/@sha256:/);
    expect([
      coverageJob().container,
      coverageJob()['timeout-minutes'],
      measure['timeout-minutes'],
    ]).toEqual([
      ciCoverage().container,
      ciCoverage()['timeout-minutes'],
      ciMeasure?.['timeout-minutes'],
    ]);
    expect(typeof measure['timeout-minutes']).toBe('number');
  });

  it('records every suite with the switch set to the workflow’s name', () => {
    const record = step('Record the floors');
    expect(runOf(record)).toBe('npm run floors:record');
    expect(record.env).toEqual({ [RECORD_JOB_ENV]: 'record-floors' });
  });

  it('uploads the floors directory named by the commit, after recording', () => {
    const upload = step('Upload the recorded floors');
    expect(upload.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
    expect(upload.with).toEqual({
      name: 'floors-${{ inputs.sha }}',
      path: 'tests/floors/',
      'if-no-files-found': 'error',
    });
    const names = (job().steps ?? []).map((s) => s.name);
    expect(names.indexOf('Record the floors')).toBeGreaterThan(-1);
    expect(names.indexOf('Upload the recorded floors')).toBeGreaterThan(
      names.indexOf('Record the floors'),
    );
  });

  it('measures coverage without the switch on a fresh install of the commit, the recorded floors laid over it, then records it with the switch (#728, #748)', () => {
    const lay = coverageStep(LAY);
    expect(lay.uses).toMatch(/^actions\/download-artifact@[0-9a-f]{40}$/);
    expect(lay.with).toEqual({
      name: 'floors-${{ inputs.sha }}',
      path: 'tests/floors/',
    });
    const measure = coverageStep('Measure coverage');
    const record = coverageStep('Record coverage');
    expect([runOf(measure), measure.env]).toEqual([MEASURE_RUN, undefined]);
    expect([runOf(record), record.env]).toEqual([
      'node scripts/coverage.ts record',
      { [RECORD_JOB_ENV]: 'record-floors' },
    ]);
    // The tree the pull request will hold: its install, and the floors the
    // first job recorded. Measured in that job instead, it ran on the old
    // floors (the guards fail on every branch whose floors moved) or after
    // the floors recorder ran every suite (one file's total moved, #745).
    const at = (name: string): number => coverageNames().indexOf(name);
    // A missing install's index is -1, which sorts before any step; the
    // other three are found by name above.
    expect([
      coverageNames().includes('Install (a warning fails it)'),
      at('Install (a warning fails it)') < at(LAY),
      at(LAY) < at('Measure coverage'),
      at('Measure coverage') < at('Record coverage'),
    ]).toEqual([true, true, true, true]);
    // The floors job measures nothing; the coverage job measures once.
    expect(
      [job(), coverageJob()].map(
        (j) =>
          (j.steps ?? []).filter((s) =>
            runOf(s).startsWith('npm run test:coverage'),
          ).length,
      ),
    ).toEqual([0, 1]);
  });

  it('uploads the coverage record as its own artifact named by the commit, after recording it (#728)', () => {
    const upload = coverageStep('Upload the coverage record');
    expect(upload.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
    expect(upload.with).toEqual({
      name: 'coverage-${{ inputs.sha }}',
      path: 'tests/coverage/record.json',
      'if-no-files-found': 'error',
    });
    // A missing record step's index is -1, which sorts before any step.
    expect(coverageNames()).toContain('Record coverage');
    expect(
      coverageNames().indexOf('Upload the coverage record'),
    ).toBeGreaterThan(coverageNames().indexOf('Record coverage'));
  });

  it('is the only workflow that sets the recorder’s switch: a run that checks figures never records them', () => {
    const files = workflowFiles();
    const sites = files.flatMap(switchSites);
    // The reader finds the switch where the record workflow sets it, on
    // both record steps, found by name (liveness).
    const index = (j: WorkflowJob, name: string): number =>
      (j.steps ?? []).findIndex((s) => s.name === name);
    expect(sites).toEqual(
      expect.arrayContaining([
        `${FILE}: ${ID}.steps[${String(index(job(), 'Record the floors'))}].env`,
        `${FILE}: ${COVERAGE}.steps[${String(index(coverageJob(), 'Record coverage'))}].env`,
      ]),
    );
    expect(
      searched(
        sites.filter((site) => !site.startsWith(`${FILE}: `)),
        { of: files, what: 'workflow files' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('record-floors-workflow/files', files.length),
    ).toBeUndefined();
  });
});
