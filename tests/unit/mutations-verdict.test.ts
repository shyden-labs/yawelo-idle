import { describe, expect, it } from 'vitest';
import {
  OUTCOME_FILE,
  outcomePaths,
  verdict,
} from '../../scripts/mutations-verdict.ts';
import { againstControl } from '../searched.ts';

/**
 * The `mutations` job's verdict (#619 AC5, #754 AC2): develop's required
 * check. It runs whatever happened above it, so a failed judge, which skips
 * the run jobs, can never read as a pass. The run jobs may be skipped only
 * when the judge listed no file to run, and each listed file passes only on
 * the result its own job uploaded: a job cancelled, skipped or timed out
 * uploads none, and that file fails by name.
 */

const A = 'tests/mutations/1-a.ts';
const B = 'tests/mutations/2-b.ts';
const C = 'tests/mutations/3-c.ts';
const list = (...files: string[]): string => JSON.stringify(files);
const ran = (file: string, outcome: string): string =>
  JSON.stringify({ file, outcome });
const NONE = 'uploaded no result (its job was cancelled, skipped or timed out)';

describe('verdict', () => {
  it('passes when the judge passed and the listed files ran clean', () => {
    expect(
      verdict({
        changed: 'success',
        count: '2',
        files: list(A, B),
        run: 'success',
        outcomes: [ran(A, 'success'), ran(B, 'success')],
      }),
    ).toEqual({
      ok: true,
      line: '✓ the judge passed and 2 mutation files ran clean',
    });
  });

  it('passes when the judge passed and listed no file to run', () => {
    expect(
      verdict({
        changed: 'success',
        count: '0',
        files: list(),
        run: 'skipped',
        outcomes: [],
      }),
    ).toEqual({
      ok: true,
      line: '✓ the judge passed and listed no mutation file',
    });
  });

  it.each([
    ['failure', '✗ the judge ended failure: read its log for each finding'],
    ['cancelled', '✗ the judge ended cancelled: read its log for each finding'],
    ['skipped', '✗ the judge ended skipped: read its log for each finding'],
  ])('fails when the judge ended %s', (changed, line) => {
    expect(
      verdict({ changed, count: '', files: '', run: 'skipped', outcomes: [] }),
    ).toEqual({ ok: false, line });
  });

  it.each([
    ['failure', '✗ the run of 1 mutation file ended failure'],
    ['cancelled', '✗ the run of 1 mutation file ended cancelled'],
    ['skipped', '✗ the run of 1 mutation file ended skipped'],
  ])('fails when the run ended %s', (run, line) => {
    expect(
      verdict({
        changed: 'success',
        count: '1',
        files: list(A),
        run,
        outcomes: [ran(A, 'success')],
      }),
    ).toEqual({ ok: false, line });
  });

  it('fails when the run was skipped with files to run', () => {
    expect(
      verdict({
        changed: 'success',
        count: '3',
        files: list(A, B, C),
        run: 'skipped',
        outcomes: [],
      }),
    ).toEqual({
      ok: false,
      line: `✗ the run of 3 mutation files was not clean: ${A} ${NONE}; ${B} ${NONE}; ${C} ${NONE}`,
    });
  });

  it('fails when the run ran with no file listed', () => {
    expect(
      verdict({
        changed: 'success',
        count: '0',
        files: list(),
        run: 'success',
        outcomes: [],
      }),
    ).toEqual({
      ok: false,
      line: '✗ the run job ran success with no mutation file listed',
    });
  });

  it('refuses a count that is not a whole number', () => {
    expect(
      verdict({
        changed: 'success',
        count: '',
        files: '',
        run: 'skipped',
        outcomes: [],
      }),
    ).toEqual({
      ok: false,
      line: '✗ the judge passed but wrote no count it can read: ""',
    });
  });

  it.each(['failure', 'cancelled', 'skipped'])(
    'names the file whose run ended %s while the others ran clean',
    (outcome) => {
      expect(
        verdict({
          changed: 'success',
          count: '2',
          files: list(A, B),
          run: 'failure',
          outcomes: [ran(A, 'success'), ran(B, outcome)],
        }),
      ).toEqual({
        ok: false,
        line: `✗ the run of 2 mutation files was not clean: ${B} ended ${outcome}`,
      });
    },
  );

  it('names a file that uploaded no result, even when the run reads success', () => {
    expect(
      verdict({
        changed: 'success',
        count: '2',
        files: list(A, B),
        run: 'success',
        outcomes: [ran(A, 'success')],
      }),
    ).toEqual({
      ok: false,
      line: `✗ the run of 2 mutation files was not clean: ${B} ${NONE}`,
    });
  });

  it('names every file that did not run clean, in the judge’s order', () => {
    expect(
      verdict({
        changed: 'success',
        count: '3',
        files: list(A, B, C),
        run: 'failure',
        outcomes: [ran(C, 'failure'), ran(B, 'success')],
      }),
    ).toEqual({
      ok: false,
      line: `✗ the run of 3 mutation files was not clean: ${A} ${NONE}; ${C} ended failure`,
    });
  });

  it('refuses a result for a file the judge did not list', () => {
    expect(
      verdict({
        changed: 'success',
        count: '1',
        files: list(A),
        run: 'success',
        outcomes: [ran(A, 'success'), ran(B, 'success')],
      }),
    ).toEqual({
      ok: false,
      line: `✗ the run of 1 mutation file was not clean: ${B} has a result but was not listed`,
    });
  });

  it('refuses two results for one file', () => {
    expect(
      verdict({
        changed: 'success',
        count: '1',
        files: list(A),
        run: 'success',
        outcomes: [ran(A, 'success'), ran(A, 'success')],
      }),
    ).toEqual({ ok: false, line: `✗ two results name ${A}` });
  });

  it.each([
    ['not JSON', 'ran'],
    ['null', 'null'],
    ['a list', '[]'],
    ['no outcome', JSON.stringify({ file: A })],
    [
      'a file that is not a string',
      JSON.stringify({ file: 1, outcome: 'success' }),
    ],
    ['an outcome a step never ends with', ran(A, 'passed')],
  ])('refuses a result that is %s', (_what, text) => {
    expect(
      verdict({
        changed: 'success',
        count: '1',
        files: list(A),
        run: 'success',
        outcomes: [text],
      }),
    ).toEqual({
      ok: false,
      line: `✗ a run result is not {file, outcome}: ${JSON.stringify(text)}`,
    });
  });

  it.each([
    ['shorter than its count', '2', list(A)],
    ['longer than its count', '0', list(A)],
    ['not JSON', '1', A],
    ['empty', '0', ''],
    ['a list of other than strings', '1', '[1]'],
  ])('refuses a file list %s', (_what, count, files) => {
    expect(
      verdict({
        changed: 'success',
        count,
        files,
        run: 'skipped',
        outcomes: [],
      }),
    ).toEqual({
      ok: false,
      line: `✗ the judge counted ${count} but listed ${JSON.stringify(files)}`,
    });
  });
});

describe('OUTCOME_FILE', () => {
  it('is the name each file’s job writes its result under', () => {
    expect(OUTCOME_FILE).toBe('run-outcome.json');
  });
});

describe('outcomePaths', () => {
  it('finds a lone artifact’s result at the top of the download folder', () => {
    expect(outcomePaths(['run-outcome.json', 'unit/row-1.log'])).toEqual([
      'run-outcome.json',
    ]);
  });

  it('finds each of several artifacts’ results in its own folder, and nothing else', () => {
    expect(
      outcomePaths([
        'mutations-2-b',
        'mutations-2-b/run-outcome.json',
        'mutations-1-a/unit/run-outcome.json.log',
        'mutations-1-a/run-outcome.json',
      ]),
    ).toEqual([
      'mutations-1-a/run-outcome.json',
      'mutations-2-b/run-outcome.json',
    ]);
  });

  it('finds none in an empty folder', () => {
    expect(
      againstControl(outcomePaths, {
        input: [],
        control: ['mutations-a/run-outcome.json'],
      }),
    ).toEqual([]);
  });
});
