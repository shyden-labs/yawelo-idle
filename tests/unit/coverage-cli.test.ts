import { describe, expect, it } from 'vitest';
import {
  childEnv,
  coveragePlan,
  fetchedRecordRefusals,
  metaRefusal,
  percent,
  renamesFrom,
  suiteFailure,
} from '../../scripts/coverage.ts';

describe("a suite's coverage run never carries the record switch (#728)", () => {
  it('drops FLOORS_RECORD_JOB, so the measured code runs as it does on a pull request', () => {
    expect(
      childEnv({ FLOORS_RECORD_JOB: 'record-floors', CI: 'true' }),
    ).toEqual({ CI: 'true' });
  });

  it('drops a variable the environment holds unset', () => {
    expect(childEnv({ CI: 'true', GONE: undefined })).toEqual({ CI: 'true' });
  });
});

const SHA = 'a'.repeat(40);

describe('a report is judged only on the commit it measured (#728)', () => {
  it('the same commit passes', () => {
    expect(metaRefusal(JSON.stringify({ commit: SHA }), SHA)).toBeUndefined();
  });

  it('another commit is refused, naming both', () => {
    expect(metaRefusal(JSON.stringify({ commit: SHA }), 'b'.repeat(40))).toBe(
      `the coverage report measured ${SHA}, not ${'b'.repeat(40)}: run npm run test:coverage again`,
    );
  });

  it('a missing report is refused', () => {
    expect(metaRefusal(undefined, SHA)).toBe(
      'no coverage report (coverage/meta.json): run npm run test:coverage first',
    );
  });

  it('an unreadable report is refused', () => {
    expect(metaRefusal('{', SHA)).toBe(
      'coverage/meta.json is not a coverage report: run npm run test:coverage again',
    );
  });

  it('a report naming no commit is refused', () => {
    expect(metaRefusal('{}', SHA)).toBe(
      'coverage/meta.json is not a coverage report: run npm run test:coverage again',
    );
  });
});

/**
 * floors:fetch brings the coverage record back with the floors (#728). A
 * run from before the record existed uploads none, and nothing is lost; a
 * tree that holds a record must get one back.
 */
describe('floors:fetch brings the coverage record back (#728)', () => {
  it('fetches when the run uploaded one and the tree holds one', () => {
    expect(coveragePlan(true, true)).toBe('fetch');
  });

  it('fetches the first record, when the tree holds none yet', () => {
    expect(coveragePlan(true, false)).toBe('fetch');
  });

  it('skips when neither the run nor the tree has one', () => {
    expect(coveragePlan(false, false)).toBe('skip');
  });

  it('refuses when the tree has a record and the run uploaded none', () => {
    expect(coveragePlan(false, true)).toBe(
      'the tree holds tests/coverage/record.json but the run uploaded no coverage record: dispatch record-floors again',
    );
  });
});

describe('renamed files are judged against their old path (#728)', () => {
  it('maps each rename, new path to old', () => {
    expect(
      renamesFrom([
        { status: 'R087', paths: ['old.ts', 'new.ts'] },
        { status: 'M', paths: ['kept.ts'] },
        { status: 'C100', paths: ['src.ts', 'copy.ts'] },
      ]),
    ).toEqual(new Map([['new.ts', 'old.ts']]));
  });
});

const recordText = (files: Record<string, number>): string =>
  JSON.stringify({
    files: Object.fromEntries(
      Object.entries(files).map(([path, statements]) => [
        path,
        {
          measure: 'v8',
          statements: { untested: statements, total: 9 },
          branches: { untested: 0, total: 0 },
        },
      ]),
    ),
  });

/**
 * floors:fetch writes a fetched record only when no file's untested code grew
 * against the record at the merge base, the same test the pull request's
 * coverage job makes (#728 design, check (b)).
 */
describe('a fetched coverage record is ratcheted before it is written (#728)', () => {
  it('names only the file that grew, not the one that fell', () => {
    expect(
      fetchedRecordRefusals(
        recordText({ 'a.ts': 2, 'b.ts': 0 }),
        recordText({ 'a.ts': 1, 'b.ts': 1 }),
        new Map(),
      ),
    ).toEqual(['b.ts: untested statements rose from 0 to 1']);
  });

  it('refuses a record a file grew in, naming it', () => {
    expect(
      fetchedRecordRefusals(
        recordText({ 'a.ts': 2 }),
        recordText({ 'a.ts': 3 }),
        new Map(),
      ),
    ).toEqual(['a.ts: untested statements rose from 2 to 3']);
  });

  it('judges the first record against nothing, where a base record would refuse it', () => {
    expect([
      fetchedRecordRefusals(undefined, recordText({ 'a.ts': 3 }), new Map()),
      fetchedRecordRefusals(
        recordText({ 'a.ts': 2 }),
        recordText({ 'a.ts': 3 }),
        new Map(),
      ),
    ]).toEqual([[], ['a.ts: untested statements rose from 2 to 3']]);
  });

  it('refuses a fetched record it cannot read', () => {
    expect(fetchedRecordRefusals(undefined, '{', new Map())).toEqual([
      'the fetched coverage record is not a record',
    ]);
  });

  it('refuses a base record it cannot read', () => {
    expect(
      fetchedRecordRefusals(
        '{"files": 1}',
        recordText({ 'a.ts': 0 }),
        new Map(),
      ),
    ).toEqual(['the coverage record at the merge base is not a record']);
  });
});

describe('a count reads as the share of code run (#728)', () => {
  it('names the share run and both counts', () => {
    expect(percent({ untested: 1, total: 4 })).toBe(
      '75.0% run (1 of 4 untested)',
    );
  });

  it('groups thousands, as the probe figures were written', () => {
    expect(percent({ untested: 5290, total: 25566 })).toBe(
      '79.3% run (5,290 of 25,566 untested)',
    );
  });

  it('reads a file with no code as all run', () => {
    expect(percent({ untested: 0, total: 0 })).toBe(
      '100.0% run (0 of 0 untested)',
    );
  });
});

describe('a suite that did not run measures nothing (#728, #771)', () => {
  it.each([
    [
      'one that never started',
      { error: new Error('spawn npx ENOENT'), status: null },
      'the unit suite did not start: spawn npx ENOENT',
    ],
    [
      'one that failed',
      { status: 3 },
      'the unit suite failed (exit 3): nothing measured',
    ],
    [
      'one stopped by a signal',
      { status: null },
      'the unit suite failed (exit null): nothing measured',
    ],
  ])('stops on %s', (_case, run, failure) => {
    expect(suiteFailure('unit', run)).toBe(failure);
  });

  it('goes on after one that passed', () => {
    expect(suiteFailure('unit', { status: 0 })).toBeUndefined();
  });
});
