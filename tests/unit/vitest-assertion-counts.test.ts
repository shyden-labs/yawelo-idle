import { describe, expect, it } from 'vitest';
import type { TestCase } from 'vitest/node';
import VitestAssertionCounts, {
  recordAssertions,
} from '../vitest-assertion-counts';

/**
 * Each integration test's assertions are counted as the run makes them
 * (#933 AC6): Vitest's own count of `expect` calls in a test, hard and soft,
 * which the setup file records on the test's meta after each test, and the
 * reporter prints. These stand-ins carry what each side reads.
 */

const testCase = (file: string, name: string, assertions?: number): TestCase =>
  ({
    fullName: name,
    module: { relativeModuleId: file },
    meta: () => (assertions === undefined ? {} : { assertions }),
  }) as unknown as TestCase;

function report(cases: TestCase[]): string {
  const printed: string[] = [];
  const reporter = new VitestAssertionCounts({
    write: (t) => printed.push(t),
  });
  for (const c of cases) reporter.onTestCaseResult(c);
  reporter.onTestRunEnd();
  return printed.join('');
}

describe('the Vitest assertion counts reporter', () => {
  it('prints each test’s recorded count, and the total', () => {
    expect(
      report([
        testCase('tests/integration/a.test.ts', 'a > reads', 4),
        testCase('tests/integration/b.test.ts', 'b > writes', 1),
      ]),
    ).toBe(
      'Assertions per test (#933):\n' +
        'tests/integration/a.test.ts › a > reads: 4\n' +
        'tests/integration/b.test.ts › b > writes: 1\n' +
        'Assertions in all: 5 in 2 tests\n',
    );
  });

  it('prints a test with no recorded count as unknown, never as 0', () => {
    expect(
      report([testCase('tests/integration/a.test.ts', 'a > skipped')]),
    ).toContain('tests/integration/a.test.ts › a > skipped: unknown\n');
  });
});

describe('recordAssertions', () => {
  it('copies the assertion count onto the test’s meta', () => {
    const task = { meta: {} as Record<string, unknown> };
    recordAssertions(task, 3);
    expect(task.meta).toEqual({ assertions: 3 });
  });
});
