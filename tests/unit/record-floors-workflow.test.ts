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
 * recorded by a separate CI job"). Labelling a pull request `record-floors`
 * runs it on the pull request's head: it records every suite's floors there
 * and uploads them, named by that commit, for `npm run floors:fetch` to write
 * on the laptop (operator, 2026-10-12: "CI records, laptop commits"). It
 * runs from the pull request's own copy, so a branch that adds it can record
 * its own floors. Only it sets the recorder's switch: a run that checks the
 * figures never records them.
 */

const FILE = 'record-floors.yml';
const ID = 'record-floors';

const job = (): WorkflowJob => onlyJob(FILE, ID);
const step = (name: string): WorkflowStep => stepNamed(FILE, ID, name);
const switchSites = (file: string): string[] => envSites(file, RECORD_JOB_ENV);

describe('the record-floors workflow (#547)', () => {
  it('runs only when a pull request is labelled', () => {
    expect(workflow(FILE).on).toEqual({ pull_request: { types: ['labeled'] } });
  });

  it('runs its job only for the record-floors label', () => {
    expect(job().if).toBe("${{ github.event.label.name == 'record-floors' }}");
  });

  it('reads the repository and writes nothing', () => {
    expect(workflow(FILE).permissions).toEqual({ contents: 'read' });
  });

  it('refuses exactly develop and main, first', () => {
    const refuse = step('Refuse develop and main');
    expect((job().steps ?? [])[0]?.name).toBe('Refuse develop and main');
    expect(refuse.env).toEqual({
      HEAD_REF: '${{ github.event.pull_request.head.ref }}',
      REFUSED: 'develop main',
    });
    expect(runOf(refuse)).toContain('for branch in $REFUSED; do');
    expect(runOf(refuse)).toContain('exit 1');
  });

  it('checks out the pull request’s head, not the merge', () => {
    const checkout = (job().steps ?? []).find((s) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with?.['ref']).toBe(
      '${{ github.event.pull_request.head.sha }}',
    );
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
      name: 'floors-${{ github.event.pull_request.head.sha }}',
      path: 'tests/floors/',
      'if-no-files-found': 'error',
    });
    const names = (job().steps ?? []).map((s) => s.name);
    expect(names.indexOf('Record the floors')).toBeGreaterThan(-1);
    expect(names.indexOf('Upload the recorded floors')).toBeGreaterThan(
      names.indexOf('Record the floors'),
    );
  });

  it('is the only workflow that sets the recorder’s switch: a run that checks figures never records them', () => {
    const files = workflowFiles();
    const sites = files.flatMap(switchSites);
    // The reader finds the switch where the record workflow sets it (liveness).
    expect(sites).toContain(`${FILE}: record-floors.steps[4].env`);
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
