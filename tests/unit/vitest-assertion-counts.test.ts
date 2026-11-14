import { describe, expect, it, vi } from 'vitest';
import type { TestCase } from 'vitest/node';
import VitestAssertionCounts, {
  recordAssertions,
} from '../vitest-assertion-counts';

/**
 * #933 AC6, redone test-first: Vitest's own count of each integration
 * test's assertions, recorded on its meta and printed.
 */
const testCase = (
  file: string,
  fullName: string,
  meta: Record<string, unknown>,
) =>
  ({
    module: { relativeModuleId: file },
    fullName,
    meta: () => meta,
  }) as unknown as TestCase;

const run = (cases: TestCase[]): string => {
  let printed = '';
  const reporter = new VitestAssertionCounts({
    write: (text: string) => {
      printed += text;
    },
  });
  for (const one of cases) reporter.onTestCaseResult(one);
  reporter.onTestRunEnd();
  return printed;
};

describe('recordAssertions', () => {
  it('puts the count on the meta', () => {
    const meta: Record<string, unknown> = {};
    recordAssertions(meta, 4, 0);
    expect(meta).toEqual({ assertionCalls: 4 });
  });

  // A concurrent test asserts with its own `expect` from the test context,
  // which keeps its own count apart from the shared one (#969).
  it('adds the count of the test’s own expect to the shared one', () => {
    const meta: Record<string, unknown> = {};
    recordAssertions(meta, 2, 3);
    expect(meta).toEqual({ assertionCalls: 5 });
  });
});

describe('the Vitest assertion counts reporter (#933)', () => {
  it('prints each test’s recorded count under the heading, with the total', () => {
    expect(
      run([
        testCase('tests/integration/a.test.ts', 'reads > the tree', {
          assertionCalls: 3,
        }),
        testCase('tests/integration/b.test.ts', 'writes', {
          assertionCalls: 0,
        }),
      ]),
    ).toBe(
      'Assertions per test (#933):\n' +
        'tests/integration/a.test.ts › reads > the tree: 3\n' +
        'tests/integration/b.test.ts › writes: 0\n' +
        'Assertions in all: 3 in 2 tests\n',
    );
  });

  it('prints unknown, never 0, for a test with no recorded count, and leaves it out of the total', () => {
    expect(
      run([
        testCase('tests/integration/a.test.ts', 'skipped', {}),
        testCase('tests/integration/b.test.ts', 'ran', { assertionCalls: 2 }),
      ]),
    ).toBe(
      'Assertions per test (#933):\n' +
        'tests/integration/a.test.ts › skipped: unknown\n' +
        'tests/integration/b.test.ts › ran: 2\n' +
        'Assertions in all: 2 in 2 tests\n',
    );
  });

  it('writes to stdout when Vitest builds it with its own options', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      new VitestAssertionCounts({}).onTestRunEnd();
      expect(stdout).toHaveBeenCalledWith(
        'Assertions per test (#933):\nAssertions in all: 0 in 0 tests\n',
      );
    } finally {
      stdout.mockRestore();
    }
  });
});
