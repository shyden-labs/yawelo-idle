import { describe, expect, it } from 'vitest';
import { artifactPrefix, SHARDS } from '../../scripts/fetch-minimums.ts';
import {
  MIN_RUNS,
  MINIMUMS_RECORD_ENV,
} from '../../scripts/minimums-method.ts';
import { SAMPLE_JOB_ENV } from '../../scripts/sample-minimums.ts';
import { floorBreach } from '../floors.ts';
import { SEED_ENV } from '../properties-seed.ts';
import { searched } from '../searched.ts';
import {
  envSites,
  onlyJob,
  stepNamed,
  workflow,
  workflowFiles,
} from './workflow-file.ts';
import { runOf } from './workflow-steps.ts';

/**
 * The record-minimums workflow (#84, spec §5.6). It samples a commit the
 * session has not pushed to its branch (#718; global rule 2026-10-21: "a CI
 * bot never pushes to a branch"): the session pushes it to the scratch ref
 * `refs/minimums/<branch>` and dispatches this workflow on develop with the
 * branch and SHA (#718 AC1, run 39521577298). It runs the properties suite
 * at least 200 times at that SHA, over 4 shards, recording every reach
 * count, and uploads each shard named by it for `npm run minimums:fetch` to
 * fold into the unpushed commit. Only it sets the sampler's switch, and no
 * workflow sets the checker's record switch (the sampler sets it per run) or
 * a properties seed (only a person replaying a run does).
 */

const FILE = 'record-minimums.yml';
const ID = 'record-minimums';
const REFUSE = "Refuse anything but the tip of a ticket branch's scratch ref";
const job = () => onlyJob(FILE, ID);
const step = (name: string) => stepNamed(FILE, ID, name);
const names = () => (job().steps ?? []).map((s) => s.name ?? s.uses);

const SAMPLE = 'npm run minimums:sample -- --runs 50 --out minimums-runs';

describe('the record-minimums workflow (#84, #718)', () => {
  it('runs only when dispatched, with the branch and the SHA to sample', () => {
    expect(workflow(FILE).on).toEqual({
      workflow_dispatch: {
        inputs: {
          branch: {
            description: 'The ticket branch whose scratch ref holds the commit',
            required: true,
            type: 'string',
          },
          sha: {
            description: 'The full SHA at refs/minimums/<branch>',
            required: true,
            type: 'string',
          },
        },
      },
    });
  });

  it('names each run by the branch and SHA it sampled, for minimums:fetch to read', () => {
    expect(workflow(FILE)['run-name']).toBe(
      'record-minimums ${{ inputs.branch }} at ${{ inputs.sha }}',
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

  it('refuses, before the checkout, a SHA that is not the scratch ref’s tip', () => {
    const refuse = runOf(step(REFUSE));
    const tip =
      'tip="$(git ls-remote "$REPOSITORY" "refs/minimums/$BRANCH" | cut -f1)"';
    expect(refuse).toContain(tip);
    expect(refuse.indexOf('[ "$tip" = "$SHA" ]')).toBeGreaterThan(
      refuse.indexOf(tip),
    );
    expect(refuse.lastIndexOf('exit 1')).toBeGreaterThan(refuse.indexOf(tip));
    expect(
      names().findIndex((n) => n?.startsWith('actions/checkout@')),
    ).toBeGreaterThan(names().indexOf(REFUSE));
  });

  it('checks out exactly the SHA it was given', () => {
    const checkout = (job().steps ?? []).find((s) =>
      s.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with?.['ref']).toBe('${{ inputs.sha }}');
  });

  it('pushes nothing: no step runs git push or holds a token', () => {
    const steps = job().steps ?? [];
    // The reader sees each step's command where the sampler runs (liveness).
    expect(steps.map(runOf)).toContain(SAMPLE);
    expect(
      searched(
        steps.filter(
          (s) =>
            /\bgit\s+push\b/.test(runOf(s)) ||
            JSON.stringify(s).includes('secrets.'),
        ),
        { of: steps, what: 'record-minimums steps' },
      ),
    ).toEqual([]);
    expect(
      floorBreach('record-minimums-workflow/steps', steps.length),
    ).toBeUndefined();
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
      name: `${artifactPrefix('${{ inputs.sha }}')}\${{ matrix.shard }}`,
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
