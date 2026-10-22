import { describe, expect, it } from 'vitest';
import { RECORD_JOB_ENV } from '../../scripts/record-floors';
import { floorBreach } from '../floors';
import { searched } from '../searched';
import {
  envSites,
  onlyJob,
  stepNamed,
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
const REFUSE = "Refuse anything but the tip of a ticket branch's scratch ref";

const job = (): WorkflowJob => onlyJob(FILE, ID);
const step = (name: string): WorkflowStep => stepNamed(FILE, ID, name);
const names = (): (string | undefined)[] =>
  (job().steps ?? []).map((s) => s.name ?? s.uses);
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

  it('checks out exactly the SHA it was given', () => {
    const checkout = (job().steps ?? []).find((s) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with?.['ref']).toBe('${{ inputs.sha }}');
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

  it('pushes nothing: no step runs git push or holds a token', () => {
    const steps = job().steps ?? [];
    // The reader sees each step's command where the recorder runs (liveness).
    expect(steps.map(runOf)).toContain('npm run floors:record');
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

  it('measures coverage without the switch, after the floors are recorded, then records it with the switch (#728, #748)', () => {
    const measure = step('Measure coverage');
    const record = step('Record coverage');
    expect([runOf(measure), measure.env]).toEqual([
      'npm run test:coverage',
      undefined,
    ]);
    expect([runOf(record), record.env]).toEqual([
      'node scripts/coverage.ts record',
      { [RECORD_JOB_ENV]: 'record-floors' },
    ]);
    // Measured after the floors (#748): the measure runs the guards suite,
    // which checks the committed floors, so measured first it fails on every
    // branch whose floors moved (record-floors 39711319254).
    const order = (job().steps ?? []).map((s) => s.name);
    const at = (name: string): number => order.indexOf(name);
    expect([
      at('Install (a warning fails it)') < at('Record the floors'),
      at('Measure coverage') < at('Record coverage'),
      at('Upload the recorded floors') < at('Measure coverage'),
    ]).toEqual([true, true, true]);
  });

  it('uploads the coverage record as its own artifact named by the commit, after recording it (#728)', () => {
    const upload = step('Upload the coverage record');
    expect(upload.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
    expect(upload.with).toEqual({
      name: 'coverage-${{ inputs.sha }}',
      path: 'tests/coverage/record.json',
      'if-no-files-found': 'error',
    });
    const order = (job().steps ?? []).map((s) => s.name);
    expect(order.indexOf('Upload the coverage record')).toBeGreaterThan(
      order.indexOf('Record coverage'),
    );
  });

  it('is the only workflow that sets the recorder’s switch: a run that checks figures never records them', () => {
    const files = workflowFiles();
    const sites = files.flatMap(switchSites);
    // The reader finds the switch where the record workflow sets it, on
    // both record steps, found by name (liveness).
    const index = (name: string): number =>
      (job().steps ?? []).findIndex((s) => s.name === name);
    expect(sites).toEqual(
      expect.arrayContaining([
        `${FILE}: record-floors.steps[${String(index('Record the floors'))}].env`,
        `${FILE}: record-floors.steps[${String(index('Record coverage'))}].env`,
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
