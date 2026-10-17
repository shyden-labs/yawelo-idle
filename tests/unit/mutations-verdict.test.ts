import { describe, expect, it } from 'vitest';
import { verdict } from '../../scripts/mutations-verdict';

/**
 * The `mutations` job's verdict (#619 AC5): develop's required check. It
 * runs whatever happened above it, so a failed judge, which skips the run
 * job, can never read as a pass. The run job may be skipped only when the
 * judge listed no file to run.
 */

describe('verdict', () => {
  it('passes when the judge passed and the listed files ran clean', () => {
    expect(verdict({ changed: 'success', count: '2', run: 'success' })).toEqual(
      { ok: true, line: '✓ the judge passed and 2 mutation files ran clean' },
    );
  });

  it('passes when the judge passed and listed no file to run', () => {
    expect(verdict({ changed: 'success', count: '0', run: 'skipped' })).toEqual(
      { ok: true, line: '✓ the judge passed and listed no mutation file' },
    );
  });

  it.each([
    ['failure', '✗ the judge ended failure: read its log for each finding'],
    ['cancelled', '✗ the judge ended cancelled: read its log for each finding'],
    ['skipped', '✗ the judge ended skipped: read its log for each finding'],
  ])('fails when the judge ended %s', (changed, line) => {
    expect(verdict({ changed, count: '', run: 'skipped' })).toEqual({
      ok: false,
      line,
    });
  });

  it.each([
    ['failure', '✗ the run of 1 mutation file ended failure'],
    ['cancelled', '✗ the run of 1 mutation file ended cancelled'],
  ])('fails when the run ended %s', (run, line) => {
    expect(verdict({ changed: 'success', count: '1', run })).toEqual({
      ok: false,
      line,
    });
  });

  it('fails when the run was skipped with files to run', () => {
    expect(verdict({ changed: 'success', count: '3', run: 'skipped' })).toEqual(
      { ok: false, line: '✗ the run of 3 mutation files ended skipped' },
    );
  });

  it('fails when the run ran with no file listed', () => {
    expect(verdict({ changed: 'success', count: '0', run: 'success' })).toEqual(
      {
        ok: false,
        line: '✗ the run job ran success with no mutation file listed',
      },
    );
  });

  it('refuses a count that is not a whole number', () => {
    expect(verdict({ changed: 'success', count: '', run: 'skipped' })).toEqual({
      ok: false,
      line: '✗ the judge passed but wrote no count it can read: ""',
    });
  });
});
