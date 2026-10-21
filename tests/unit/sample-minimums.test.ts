import { describe, expect, it } from 'vitest';
import {
  SAMPLE_JOB_ENV,
  runFile,
  sampleArgs,
  sampleRefusal,
  sampleRun,
} from '../../scripts/sample-minimums';
import { MINIMUMS_RECORD_ENV } from '../minimums';

/**
 * `npm run minimums:sample -- --runs <n> --out <dir>` (#84, spec §5.5): the
 * properties suite run n times in CI, each a fresh process with fresh seeds
 * recording its reach counts, and nowhere else.
 */

describe('sampleRefusal', () => {
  it('accepts CI with the switch set to the record-minimums workflow', () => {
    expect(
      sampleRefusal({ CI: 'true', [SAMPLE_JOB_ENV]: 'record-minimums' }),
    ).toBeUndefined();
  });

  it('refuses the laptop, which runs no suite but the unit suite', () => {
    expect(sampleRefusal({ [SAMPLE_JOB_ENV]: 'record-minimums' })).toBe(
      'minimums are sampled in CI only, by the record-minimums workflow: ' +
        'push the commit to refs/minimums/<branch> and dispatch ' +
        'record-minimums on develop (#84, #718)',
    );
  });

  it('refuses CI without the switch, and with it set to another job', () => {
    expect(sampleRefusal({ CI: 'true' })).toMatch(
      /^minimums are sampled in CI only/,
    );
    expect(
      sampleRefusal({ CI: 'true', [SAMPLE_JOB_ENV]: 'record-floors' }),
    ).toMatch(/^minimums are sampled in CI only/);
  });

  it('refuses CI set to the empty string', () => {
    expect(
      sampleRefusal({ CI: '', [SAMPLE_JOB_ENV]: 'record-minimums' }),
    ).toMatch(/^minimums are sampled in CI only/);
  });
});

describe('sampleArgs', () => {
  it('reads the runs and the folder', () => {
    expect(sampleArgs(['--runs', '50', '--out', 'minimums-runs'])).toEqual({
      runs: 50,
      out: 'minimums-runs',
    });
  });

  it('reads them in either order', () => {
    expect(sampleArgs(['--out', 'o', '--runs', '2'])).toEqual({
      runs: 2,
      out: 'o',
    });
  });

  it.each([
    [[]],
    [['--runs', '50']],
    [['--out', 'o']],
    [['--runs', '0', '--out', 'o']],
    [['--runs', '1.5', '--out', 'o']],
    [['--runs', 'many', '--out', 'o']],
    [['--runs', '5', '--out', 'o', '--seed', '3']],
    [['--runs', '5', '--out']],
  ])('refuses %j', (argv) => {
    expect(sampleArgs(argv)).toBe(
      'usage: npm run minimums:sample -- --runs <whole number of 1 or more> --out <folder>',
    );
  });
});

describe('runFile', () => {
  it('names run n of a sample, padded so the files sort in run order', () => {
    expect(runFile('o', 7)).toBe('o/run-007.jsonl');
    expect(runFile('o', 123)).toBe('o/run-123.jsonl');
  });
});

describe('sampleRun', () => {
  it('runs the whole properties suite with the record switch set to the run’s file', () => {
    expect(sampleRun('o', 3)).toEqual({
      command: 'npx',
      args: ['vitest', 'run', '-c', 'vitest.properties.config.ts'],
      env: { [MINIMUMS_RECORD_ENV]: 'o/run-003.jsonl' },
    });
  });
});
