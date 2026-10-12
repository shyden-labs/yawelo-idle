import { describe, expect, it } from 'vitest';
import {
  artifactName,
  fetchedFloors,
  fetchRefusal,
  type RecordRun,
} from '../../scripts/fetch-floors';

/**
 * `npm run floors:fetch <run>` (#547): the floors the record-floors
 * workflow recorded in CI, written here only when the run recorded this
 * branch's HEAD, and only when no figure falls or vanishes.
 */

const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

const RUN: RecordRun = {
  workflowName: 'record-floors',
  status: 'completed',
  conclusion: 'success',
  headSha: HEAD,
  headBranch: 'm1/542-golden-slices',
};

describe('fetchRefusal', () => {
  it('accepts a finished, successful record of this branch’s HEAD', () => {
    expect(fetchRefusal(RUN, HEAD, 'm1/542-golden-slices')).toBeUndefined();
  });

  it('refuses another workflow’s run', () => {
    expect(
      fetchRefusal(
        { ...RUN, workflowName: 'build-and-test' },
        HEAD,
        'm1/542-golden-slices',
      ),
    ).toBe('run is build-and-test’s, not record-floors’');
  });

  it('refuses a run still going', () => {
    expect(
      fetchRefusal(
        { ...RUN, status: 'in_progress', conclusion: '' },
        HEAD,
        'm1/542-golden-slices',
      ),
    ).toBe('run is in_progress, not finished');
  });

  it('refuses a run that did not succeed', () => {
    expect(
      fetchRefusal(
        { ...RUN, conclusion: 'failure' },
        HEAD,
        'm1/542-golden-slices',
      ),
    ).toBe('run ended failure: it recorded nothing');
  });

  it('refuses a record of another branch', () => {
    expect(fetchRefusal(RUN, HEAD, 'm1/547-ci-floors')).toBe(
      'run recorded m1/542-golden-slices, not m1/547-ci-floors',
    );
  });

  it('refuses a record of another commit', () => {
    expect(fetchRefusal(RUN, OTHER, 'm1/542-golden-slices')).toBe(
      `run recorded ${HEAD}, but HEAD is ${OTHER}: label the pull request again after the last push`,
    );
  });
});

describe('fetchedFloors', () => {
  it('takes the run’s figures: raised, new and unmoved alike', () => {
    expect(
      fetchedFloors({ 'a/x': 3, 'a/y': 5 }, { 'a/x': 4, 'a/y': 5, 'b/z': 1 }),
    ).toEqual({ next: { 'a/x': 4, 'a/y': 5, 'b/z': 1 }, refusals: [] });
  });

  it('refuses a figure that falls', () => {
    expect(fetchedFloors({ 'a/x': 3 }, { 'a/x': 2 }).refusals).toEqual([
      'a/x would fall from 3 to 2: the recorder refuses a fall, so this run is not its record',
    ]);
  });

  it('refuses a floor the run does not hold', () => {
    expect(
      fetchedFloors({ 'a/x': 3, 'a/y': 1 }, { 'a/x': 3 }).refusals,
    ).toEqual(['a/y is recorded here but not in the run’s floors']);
  });
});

describe('artifactName', () => {
  it('names the record by the commit it ran on', () => {
    expect(artifactName(HEAD)).toBe(`floors-${HEAD}`);
  });
});
