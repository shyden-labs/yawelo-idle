import { describe, expect, it } from 'vitest';
import { RECORD_JOB_ENV } from '../../scripts/record-floors';
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
const REFUSE = "Refuse anything but the tip of a ticket branch's scratch ref";
const LAY = 'Lay the recorded floors over the tree';

const job = (): WorkflowJob => jobIn(FILE, ID);
const step = (name: string): WorkflowStep => stepIn(FILE, ID, name);
const names = (): (string | undefined)[] =>
  (job().steps ?? []).map((s) => s.name ?? s.uses);
const coverageJob = (): WorkflowJob => jobIn(FILE, COVERAGE);
const coverageStep = (name: string): WorkflowStep =>
  stepIn(FILE, COVERAGE, name);
const coverageNames = (): (string | undefined)[] =>
  (coverageJob().steps ?? []).map((s) => s.name ?? s.uses);
const ciCoverage = (): WorkflowJob => jobIn('ci.yml', 'coverage');
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
      coverageJob().needs,
      coverageJob().if,
    ]).toEqual([[ID, COVERAGE], ID, undefined]);
  });

  it('refuses, naming what the file holds, a job or a step it does not hold (#748)', () => {
    expect(() => jobIn(FILE, 'missing')).toThrow(
      `${FILE} holds jobs ${ID}, ${COVERAGE}, not missing`,
    );
    expect(() => stepIn(FILE, COVERAGE, 'missing')).toThrow(
      `${FILE} holds 0 steps named "missing" in ${COVERAGE}`,
    );
  });

  it('reads the repository and writes nothing', () => {
    expect(workflow(FILE).permissions).toEqual({ contents: 'read' });
  });

  it('refuses develop, main, a malformed branch and a short SHA, first', () => {
    const refuse = step(REFUSE);
    expect(names()[0]).toBe(REFUSE);
    expect(refuse.env).toEqual({
      BRANCH: '${{ inputs.branch }}',
      SHA: '${{ inputs.sha }}',
      REFUSED: 'develop main',
      REPOSITORY: '${{ github.server_url }}/${{ github.repository }}',
    });
    expect(runOf(refuse)).toContain('for branch in $REFUSED; do');
    expect(runOf(refuse)).toContain(
      `printf '%s' "$SHA" | grep -Eqx '[0-9a-f]{40}'`,
    );
    expect(runOf(refuse)).toContain(
      `printf '%s' "$BRANCH" | grep -Eqx '[A-Za-z0-9._/-]+'`,
    );
    expect(runOf(refuse)).toContain('exit 1');
  });

  it('checks out exactly the SHA it was given, in each job', () => {
    const checkouts = [job(), coverageJob()].flatMap((j) =>
      (j.steps ?? []).filter((s) => s.uses?.startsWith('actions/checkout@')),
    );
    expect(checkouts.map((s) => s.with)).toEqual([
      { ref: '${{ inputs.sha }}', 'fetch-depth': 2 },
      { ref: '${{ inputs.sha }}', 'fetch-depth': 2 },
    ]);
  });

  it('refuses, before the checkout, a SHA that is not the scratch ref’s tip', () => {
    const refuse = runOf(step(REFUSE));
    const tip =
      'tip="$(git ls-remote "$REPOSITORY" "refs/floors/$BRANCH" | cut -f1)"';
    expect(refuse).toContain(tip);
    expect(refuse.indexOf('[ "$tip" = "$SHA" ]')).toBeGreaterThan(
      refuse.indexOf(tip),
    );
    expect(refuse.lastIndexOf('exit 1')).toBeGreaterThan(refuse.indexOf(tip));
    expect(
      names().findIndex((n) => n?.startsWith('actions/checkout@')),
    ).toBeGreaterThan(names().indexOf(REFUSE));
  });

  it('pushes nothing: no step of either job runs git push or holds a token', () => {
    const steps = [...(job().steps ?? []), ...(coverageJob().steps ?? [])];
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
    expect([runOf(measure), measure.env]).toEqual([
      'npm run test:coverage',
      undefined,
    ]);
    expect([runOf(record), record.env]).toEqual([
      'node scripts/coverage.ts record',
      { [RECORD_JOB_ENV]: 'record-floors' },
    ]);
    // The tree the pull request will hold: its install, and the floors the
    // first job recorded. Measured in that job instead, it ran on the old
    // floors (the guards fail on every branch whose floors moved) or after
    // the floors recorder ran every suite (one file's total moved, #745).
    const at = (name: string): number => coverageNames().indexOf(name);
    expect([
      at('Install (a warning fails it)') < at(LAY),
      at(LAY) < at('Measure coverage'),
      at('Measure coverage') < at('Record coverage'),
    ]).toEqual([true, true, true]);
    // The floors job measures nothing; the coverage job measures once.
    expect(
      [job(), coverageJob()].map(
        (j) =>
          (j.steps ?? []).filter((s) => runOf(s) === 'npm run test:coverage')
            .length,
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
