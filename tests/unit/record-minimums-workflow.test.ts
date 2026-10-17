import { describe, expect, it } from 'vitest';
import { artifactPrefix, SHARDS } from '../../scripts/fetch-minimums';
import { MIN_RUNS, MINIMUMS_RECORD_ENV } from '../../scripts/minimums-method';
import { SAMPLE_JOB_ENV } from '../../scripts/sample-minimums';
import { floorBreach } from '../floors';
import { SEED_ENV } from '../properties-seed';
import { searched } from '../searched';
import {
  envSites,
  onlyJob,
  stepNamed,
  workflow,
  workflowFiles,
} from './workflow-file';
import { runOf } from './workflow-steps';

/**
 * The record-minimums workflow (#84, spec §5.6). Labelling a pull request
 * `record-minimums` runs the properties suite at least 200 times on its
 * head, over 4 shards, recording every reach count, and uploads each shard
 * named by that commit for `npm run minimums:fetch` to read back (operator,
 * 2026-10-12: "CI records, laptop commits"). Only it sets the sampler's
 * switch, and no workflow sets the checker's record switch (the sampler sets
 * it per run) or a properties seed (only a person replaying a run does).
 */

const FILE = 'record-minimums.yml';
const ID = 'record-minimums';
const job = () => onlyJob(FILE, ID);
const step = (name: string) => stepNamed(FILE, ID, name);

const SAMPLE = 'npm run minimums:sample -- --runs 50 --out minimums-runs';

describe('the record-minimums workflow (#84)', () => {
  it('runs only when a pull request is labelled', () => {
    expect(workflow(FILE).on).toEqual({ pull_request: { types: ['labeled'] } });
  });

  it('runs its job only for the record-minimums label', () => {
    expect(job().if).toBe(
      "${{ github.event.label.name == 'record-minimums' }}",
    );
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

  it('runs on the plain runner: the properties suite needs no browser', () => {
    expect(job()['runs-on']).toBe('ubuntu-24.04');
    expect(job().container).toBeUndefined();
  });

  it('runs as many shards as the fetch reads, and stops them all at the first red one', () => {
    expect(job().strategy).toEqual({
      'fail-fast': true,
      matrix: { shard: [1, 2, 3, 4] },
    });
    expect(SHARDS).toBe(4);
  });

  it('samples with the switch set to the workflow’s name', () => {
    const sample = step('Sample the minimums');
    expect(runOf(sample)).toBe(SAMPLE);
    expect(sample.env).toEqual({ [SAMPLE_JOB_ENV]: 'record-minimums' });
  });

  it('samples at least the 200 runs the method needs, across its shards', () => {
    const runs = Number(
      /--runs (\d+)/.exec(runOf(step('Sample the minimums')))?.[1],
    );
    const shards = (job().strategy?.matrix?.['shard'] as unknown[]).length;
    expect(runs * shards).toBeGreaterThanOrEqual(MIN_RUNS);
  });

  it('uploads each shard’s runs named by the commit and the shard, after sampling', () => {
    const upload = step('Upload the sampled runs');
    expect(upload.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
    expect(upload.with).toEqual({
      name: `${artifactPrefix('${{ github.event.pull_request.head.sha }}')}\${{ matrix.shard }}`,
      path: 'minimums-runs/',
      'if-no-files-found': 'error',
    });
    const names = (job().steps ?? []).map((s) => s.name);
    expect(names.indexOf('Upload the sampled runs')).toBe(
      names.indexOf('Sample the minimums') + 1,
    );
  });

  it('is the only workflow that sets the sampler’s switch, and none sets the record switch or a seed', () => {
    const files = workflowFiles();
    const sites = files.flatMap((file) => [
      ...envSites(file, SAMPLE_JOB_ENV).filter(
        (site) => !site.startsWith(`${FILE}: `),
      ),
      ...envSites(file, MINIMUMS_RECORD_ENV),
      ...envSites(file, SEED_ENV),
    ]);
    // The reader finds the sampler's switch where this workflow sets it (liveness).
    expect(envSites(FILE, SAMPLE_JOB_ENV)).toEqual([
      `${FILE}: record-minimums.steps[4].env`,
    ]);
    expect(searched(sites, { of: files, what: 'workflow files' })).toEqual([]);
    expect(
      floorBreach('record-minimums-workflow/files', files.length),
    ).toBeUndefined();
  });
});
