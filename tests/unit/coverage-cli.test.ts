import { describe, expect, it } from 'vitest';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import {
  percent,
  shortfalls,
  suiteFailure,
  THRESHOLDS,
  totalsOf,
} from '../../scripts/coverage';

/** One file's map: two statements, one branch with two arms. */
const fileMap = (
  path: string,
  statementHits: [number, number],
  armHits: [number, number],
): CoverageMapData => {
  const at = (line: number) => ({
    start: { line, column: 0 },
    end: { line, column: 1 },
  });
  const loc = at(1);
  return {
    [path]: {
      path,
      statementMap: { 0: loc, 1: at(2) },
      fnMap: {},
      branchMap: { 0: { loc, type: 'if', locations: [loc, at(2)], line: 1 } },
      s: { 0: statementHits[0], 1: statementHits[1] },
      f: {},
      b: { 0: armHits },
    },
  };
};

describe('every suite is joined before the totals are taken (#795)', () => {
  it('counts a statement one suite ran as run, whichever suite ran it', () => {
    expect(
      totalsOf([
        fileMap('a.ts', [1, 0], [0, 0]),
        fileMap('a.ts', [0, 1], [0, 1]),
      ]),
    ).toEqual({
      statements: { untested: 0, total: 2 },
      branches: { untested: 1, total: 2 },
    });
  });

  it('adds the files of different suites together', () => {
    expect(
      totalsOf([
        fileMap('a.ts', [1, 1], [1, 1]),
        fileMap('b.ts', [0, 0], [0, 0]),
      ]),
    ).toEqual({
      statements: { untested: 2, total: 4 },
      branches: { untested: 2, total: 4 },
    });
  });
});

describe('coverage fails below one overall threshold (#795)', () => {
  const at = (statements: number, branches: number) => ({
    statements: { untested: 100 - statements, total: 100 },
    branches: { untested: 100 - branches, total: 100 },
  });

  it('passes at both thresholds exactly', () => {
    expect(shortfalls(at(THRESHOLDS.statements, THRESHOLDS.branches))).toEqual(
      [],
    );
  });

  it('names statements below theirs', () => {
    expect(shortfalls(at(87, 90), { statements: 88, branches: 81 })).toEqual([
      'statements: 87.0% run (13 of 100 untested), below the 88% threshold',
    ]);
  });

  it('names branches below theirs', () => {
    expect(shortfalls(at(95, 80), { statements: 88, branches: 81 })).toEqual([
      'branches: 80.0% run (20 of 100 untested), below the 81% threshold',
    ]);
  });

  it('names both when both are below', () => {
    expect(shortfalls(at(0, 0), { statements: 88, branches: 81 })).toHaveLength(
      2,
    );
  });

  it('holds the figures CI measured with Svelte counted, rounded down', () => {
    expect(THRESHOLDS).toEqual({ statements: 85, branches: 77 });
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
