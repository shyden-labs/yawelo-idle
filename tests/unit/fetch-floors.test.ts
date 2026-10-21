import { describe, expect, it } from 'vitest';
import {
  artifactName,
  deleteScratchRef,
  fetchedFloors,
  fetchRefusal,
  pushedHead,
  scratchRef,
  type RecordRun,
} from '../../scripts/fetch-floors';

/**
 * `npm run floors:fetch <run>` (#547, #718): the floors the record-floors
 * workflow recorded in CI at a commit pushed only to its scratch ref,
 * written here only when the run measured this branch's HEAD and that HEAD
 * is not yet on the remote, and only when no figure falls or vanishes.
 */

const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const BRANCH = 'm1/542-golden-slices';
const UNPUSHED = false;

const RUN: RecordRun = {
  workflowName: 'record-floors',
  status: 'completed',
  conclusion: 'success',
  displayTitle: `record-floors ${BRANCH} at ${HEAD}`,
};

describe('fetchRefusal', () => {
  it('accepts a finished, successful record of this branch’s unpushed HEAD', () => {
    expect(fetchRefusal(RUN, HEAD, BRANCH, UNPUSHED)).toBeUndefined();
  });

  it('refuses another workflow’s run', () => {
    expect(
      fetchRefusal(
        { ...RUN, workflowName: 'build-and-test' },
        HEAD,
        BRANCH,
        UNPUSHED,
      ),
    ).toBe('run is build-and-test’s, not record-floors’');
  });

  it('refuses a run still going', () => {
    expect(
      fetchRefusal(
        { ...RUN, status: 'in_progress', conclusion: '' },
        HEAD,
        BRANCH,
        UNPUSHED,
      ),
    ).toBe('run is in_progress, not finished');
  });

  it('refuses a run that did not succeed', () => {
    expect(
      fetchRefusal({ ...RUN, conclusion: 'failure' }, HEAD, BRANCH, UNPUSHED),
    ).toBe('run ended failure: it recorded nothing');
  });

  it('refuses a record of another branch', () => {
    expect(fetchRefusal(RUN, HEAD, 'm1/547-ci-floors', UNPUSHED)).toBe(
      `run measured “record-floors ${BRANCH} at ${HEAD}”, not “record-floors m1/547-ci-floors at ${HEAD}”: push this commit to refs/floors/m1/547-ci-floors and dispatch record-floors on develop for it`,
    );
  });

  it('refuses a record of another commit', () => {
    expect(fetchRefusal(RUN, OTHER, BRANCH, UNPUSHED)).toBe(
      `run measured “record-floors ${BRANCH} at ${HEAD}”, not “record-floors ${BRANCH} at ${OTHER}”: push this commit to refs/floors/${BRANCH} and dispatch record-floors on develop for it`,
    );
  });

  it('refuses a HEAD already on the remote: the figures fold into a commit not yet pushed', () => {
    expect(fetchRefusal(RUN, HEAD, BRANCH, true)).toBe(
      `HEAD ${HEAD} is already on origin: figures fold into a commit not yet pushed, so measure the commit before its first push (#718)`,
    );
  });

  it('names the minimums workflow’s own scratch ref in its refusals', () => {
    expect(
      fetchRefusal(
        { ...RUN, workflowName: 'record-minimums' },
        OTHER,
        BRANCH,
        UNPUSHED,
        'record-minimums',
      ),
    ).toBe(
      `run measured “record-floors ${BRANCH} at ${HEAD}”, not “record-minimums ${BRANCH} at ${OTHER}”: push this commit to refs/minimums/${BRANCH} and dispatch record-minimums on develop for it`,
    );
  });
});

describe('the scratch ref', () => {
  it('is refs/floors/<branch> for floors and refs/minimums/<branch> for minimums', () => {
    expect(scratchRef('record-floors', BRANCH)).toBe(`refs/floors/${BRANCH}`);
    expect(scratchRef('record-minimums', BRANCH)).toBe(
      `refs/minimums/${BRANCH}`,
    );
  });

  it('is deleted, once the branch is pushed, by a normal push', () => {
    expect(deleteScratchRef('record-floors', BRANCH)).toBe(
      `git push origin --delete refs/floors/${BRANCH}`,
    );
  });
});

describe('pushedHead', () => {
  const PRUNING_FETCH = ['fetch', '--quiet', '--prune', 'origin'];
  const CONTAINS = ['branch', '--remotes', '--contains', 'HEAD'];

  it('fetches with --prune, then asks which remote branches hold HEAD', () => {
    const calls: [string, readonly string[]][] = [];
    pushedHead((command, args) => {
      calls.push([command, args]);
      return '';
    });
    expect(calls).toEqual([
      ['git', PRUNING_FETCH],
      ['git', CONTAINS],
    ]);
  });

  it('counts no stale ref of a branch deleted on GitHub (#723)', () => {
    let pruned = false;
    const pushed = pushedHead((_command, args) => {
      if (args[0] === 'fetch') pruned = args.includes('--prune');
      return pruned ? '' : '  origin/floors-bootstrap/718';
    });
    expect(pushed).toBe(false);
  });

  it('counts a remote branch that still holds HEAD after the prune', () => {
    const pushed = pushedHead((_command, args) =>
      args[0] === 'fetch' ? '' : '  origin/ci/723-prune',
    );
    expect(pushed).toBe(true);
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
