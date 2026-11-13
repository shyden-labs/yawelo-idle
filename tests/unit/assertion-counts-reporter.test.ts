import { describe, expect, it } from 'vitest';
import type { TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import AssertionCounts from '../assertion-counts-reporter';

/**
 * Each browser test's assertions are counted as the run makes them (#933
 * AC6): every `expect`, hard or soft, is one of Playwright's steps in the
 * `expect` category. An `expect` inside another (a `toPass` or `poll` retry)
 * is not counted again, so a retry cannot inflate a test's count. These
 * stand-ins carry what the reporter reads.
 */

const test = (...path: string[]): TestCase =>
  ({ titlePath: () => ['', ...path] }) as unknown as TestCase;

const step = (category: string, parent?: TestStep): TestStep =>
  ({ category, parent }) as unknown as TestStep;

const RESULT = {} as TestResult;

function report(run: (reporter: AssertionCounts) => void): Promise<string> {
  const printed: string[] = [];
  const reporter = new AssertionCounts({ write: (t) => printed.push(t) });
  run(reporter);
  return reporter.onEnd().then(() => printed.join(''));
}

describe('the assertion counts reporter', () => {
  it('prints each test’s count of expect steps, hard and soft alike', async () => {
    const a = test('chromium', 'roadmap.spec.ts', 'draws the board');
    const b = test('chromium', 'shell.spec.ts', 'loads the game');
    const printed = await report((r) => {
      r.onTestBegin(a);
      r.onStepEnd(a, RESULT, step('expect'));
      r.onStepEnd(a, RESULT, step('expect'));
      r.onStepEnd(a, RESULT, step('pw:api'));
      r.onTestBegin(b);
      r.onStepEnd(b, RESULT, step('expect'));
    });
    expect(printed).toBe(
      'Assertions per test (#933):\n' +
        'chromium › roadmap.spec.ts › draws the board: 2\n' +
        'chromium › shell.spec.ts › loads the game: 1\n' +
        'Assertions in all: 3 in 2 tests\n',
    );
  });

  it('does not count an expect made inside another expect', async () => {
    const a = test('webkit-phone', 'roadmap.spec.ts', 'polls the board');
    const printed = await report((r) => {
      r.onTestBegin(a);
      const outer = step('expect');
      r.onStepEnd(a, RESULT, step('expect', outer));
      r.onStepEnd(a, RESULT, step('expect', step('test.step', outer)));
      r.onStepEnd(a, RESULT, outer);
    });
    expect(printed).toContain(
      'webkit-phone › roadmap.spec.ts › polls the board: 1\n',
    );
  });

  it('counts an expect inside a test.step', async () => {
    const a = test('chromium', 'roadmap.spec.ts', 'opens a card');
    const printed = await report((r) => {
      r.onTestBegin(a);
      r.onStepEnd(a, RESULT, step('expect', step('test.step')));
    });
    expect(printed).toContain('chromium › roadmap.spec.ts › opens a card: 1\n');
  });

  it('prints a test that made no assertion as 0', async () => {
    const a = test('chromium', 'shell.spec.ts', 'checks nothing');
    const printed = await report((r) => {
      r.onTestBegin(a);
    });
    expect(printed).toContain('chromium › shell.spec.ts › checks nothing: 0\n');
  });
});
