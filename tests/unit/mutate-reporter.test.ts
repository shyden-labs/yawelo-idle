import { describe, expect, it } from 'vitest';
import {
  reportOf,
  type ErrorView,
  type ModuleView,
  type Written,
} from '../../scripts/mutate-reporter';

/**
 * The mutation runner's own vitest reporter (#527, spec §4a): what it writes
 * from the test modules of a run. Vitest's JSON keeps only a failure's
 * headline, cut at about 30 characters; the error objects a reporter
 * receives carry the whole diff, and say when a test timed out.
 */

const ROOT = '/repo';
const FILE = 'tests/guards/reader.test.ts';

function test(fullName: string, state: string, errors: ErrorView[] = []) {
  return { fullName, result: () => ({ state, errors }) };
}

function module(
  tests: ReturnType<typeof test>[],
  errors: ErrorView[] = [],
  moduleId = `${ROOT}/${FILE}`,
): ModuleView {
  return {
    moduleId,
    errors: () => errors,
    children: { allTests: () => tests },
  };
}

describe('reportOf', () => {
  it('counts every test, skipped ones too, and names every file', () => {
    expect(
      reportOf(
        [module([test('a > b', 'passed'), test('a > c', 'skipped')])],
        ROOT,
      ),
    ).toEqual<Written>({ total: 2, files: [FILE], failing: {}, timedOut: [] });
  });

  it('keeps a failure’s whole text: message, diff, actual and expected', () => {
    expect(
      reportOf(
        [
          module([
            test('reader > reads every item', 'failed', [
              {
                message: 'expected [ { …(3) } ] to deeply equal []',
                diff: '- []\n+ [ { "id": "reader/items" } ]',
                actual: '[ { "id": "reader/items" } ]',
                expected: '[]',
              },
            ]),
          ]),
        ],
        ROOT,
      ).failing,
    ).toEqual({
      [`${FILE} › reader > reads every item`]:
        'expected [ { …(3) } ] to deeply equal []\n- []\n+ [ { "id": "reader/items" } ]\n[ { "id": "reader/items" } ]\n[]',
    });
  });

  it('joins each error of a test that failed more than once', () => {
    expect(
      reportOf(
        [
          module([
            test('a', 'failed', [{ message: 'one' }, { message: 'two' }]),
          ]),
        ],
        ROOT,
      ).failing,
    ).toEqual({ [`${FILE} › a`]: 'one\ntwo' });
  });

  it('names a test that timed out', () => {
    expect(
      reportOf(
        [
          module([
            test('slow', 'failed', [
              {
                message:
                  'Test timed out in 1000ms.\nIf this is a long-running test, …',
              },
            ]),
          ]),
        ],
        ROOT,
      ).timedOut,
    ).toEqual([`${FILE} › slow`]);
  });

  it('does not take a failure that only mentions a timeout for one', () => {
    expect(
      reportOf(
        [
          module([
            test('quotes', 'failed', [
              {
                message: "expected 'Error: Test timed out in 1000ms.' to be ''",
              },
            ]),
            test('slow', 'failed', [{ message: 'Test timed out in 1000ms.' }]),
          ]),
        ],
        ROOT,
      ).timedOut,
    ).toEqual([`${FILE} › slow`]);
  });

  it('names a file that failed outside any test', () => {
    expect(
      reportOf(
        [module([], [{ message: '[PARSE_ERROR] Unexpected token' }])],
        ROOT,
      ).failing,
    ).toEqual({ [`${FILE} › (the file)`]: '[PARSE_ERROR] Unexpected token' });
  });

  it('refuses a file outside the root', () => {
    expect(() =>
      reportOf([module([], [], '/elsewhere/a.test.ts')], ROOT),
    ).toThrow('/elsewhere/a.test.ts is outside /repo');
  });
});
