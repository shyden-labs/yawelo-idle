import { describe, expect, it } from 'vitest';
import type { TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import AssertionCounts from '../assertion-counts-reporter';

/**
 * #933 AC6, redone test-first: the Playwright reporter counts each test's
 * `expect` steps (hard and soft alike), once each, and prints them.
 */
const testCase = (project: string, file: string, ...titles: string[]) =>
  ({
    titlePath: () => ['', project, file, ...titles],
  }) as unknown as TestCase;

const step = (category: string, parent?: TestStep): TestStep =>
  ({ category, parent }) as unknown as TestStep;

const result = {} as TestResult;

const run = (play: (reporter: AssertionCounts) => void): string => {
  let printed = '';
  const reporter = new AssertionCounts((text) => {
    printed += text;
  });
  play(reporter);
  reporter.onEnd();
  return printed;
};

describe('the Playwright assertion counts reporter (#933)', () => {
  it('prints each test’s expect steps under the heading, with the total', () => {
    const first = testCase('chromium', 'site/roadmap.spec.ts', 'opens');
    const second = testCase('webkit', 'site/roadmap.spec.ts', 'closes');
    const printed = run((r) => {
      r.onTestBegin(first);
      r.onStepEnd(first, result, step('expect'));
      r.onStepEnd(first, result, step('expect'));
      r.onTestBegin(second);
      r.onStepEnd(second, result, step('expect'));
    });
    expect(printed).toBe(
      'Assertions per test (#933):\n' +
        'chromium › roadmap.spec.ts › opens: 2\n' +
        'webkit › roadmap.spec.ts › closes: 1\n' +
        'Assertions in all: 3 in 2 tests\n',
    );
  });

  it('counts no step that is not an expect', () => {
    const test = testCase('firefox', 'a.spec.ts', 'loads');
    const printed = run((r) => {
      r.onTestBegin(test);
      r.onStepEnd(test, result, step('pw:api'));
      r.onStepEnd(test, result, step('hook'));
    });
    expect(printed).toContain('firefox › a.spec.ts › loads: 0\n');
  });

  it('counts an expect inside a test.step', () => {
    const test = testCase('firefox', 'a.spec.ts', 'loads');
    const printed = run((r) => {
      r.onTestBegin(test);
      r.onStepEnd(test, result, step('expect', step('test.step')));
    });
    expect(printed).toContain('firefox › a.spec.ts › loads: 1\n');
  });

  it('does not count an expect made inside another expect (a toPass retry)', () => {
    const test = testCase('firefox', 'a.spec.ts', 'loads');
    const outer = step('expect');
    const printed = run((r) => {
      r.onTestBegin(test);
      r.onStepEnd(test, result, step('expect', step('pw:api', outer)));
      r.onStepEnd(test, result, outer);
    });
    expect(printed).toContain('firefox › a.spec.ts › loads: 1\n');
  });

  it('names a test by its describe blocks too', () => {
    const test = testCase('chromium', 'x.spec.ts', 'the map', 'opens');
    const printed = run((r) => {
      r.onTestBegin(test);
    });
    expect(printed).toContain('chromium › x.spec.ts › the map › opens: 0\n');
  });

  it('counts a retried test from its last attempt alone', () => {
    const test = testCase('chromium', 'x.spec.ts', 'flaky');
    const printed = run((r) => {
      r.onTestBegin(test);
      r.onStepEnd(test, result, step('expect'));
      r.onStepEnd(test, result, step('expect'));
      r.onTestBegin(test);
      r.onStepEnd(test, result, step('expect'));
    });
    expect(printed).toContain('chromium › x.spec.ts › flaky: 1\n');
  });
});
