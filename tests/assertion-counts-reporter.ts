import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

/**
 * Prints how many assertions each browser test made in this run (#933 AC6),
 * read from the runner itself: every `expect`, hard or soft, is a step in
 * Playwright's `expect` category. An `expect` inside another (a `toPass` or
 * `poll` retry) is not counted again, so retries cannot inflate a count. A
 * test stopped by a failing hard `expect` shows only what it ran.
 */
export default class AssertionCounts implements Reporter {
  private readonly write: (text: string) => void;
  private readonly counts = new Map<string, number>();

  constructor(options: { write?: (text: string) => void } = {}) {
    this.write = options.write ?? ((text) => process.stdout.write(text));
  }

  onTestBegin(test: TestCase): void {
    this.counts.set(AssertionCounts.name_(test), 0);
  }

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'expect') return;
    for (let up = step.parent; up !== undefined; up = up.parent) {
      if (up.category === 'expect') return;
    }
    const name = AssertionCounts.name_(test);
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
  }

  onEnd(): Promise<undefined> {
    const lines = [...this.counts].map(([n, c]) => `${n}: ${String(c)}\n`);
    const all = [...this.counts.values()].reduce((a, b) => a + b, 0);
    this.write(
      `Assertions per test (#933):\n${lines.join('')}` +
        `Assertions in all: ${String(all)} in ${String(this.counts.size)} tests\n`,
    );
    return Promise.resolve(undefined);
  }

  /** Target, file, describes and title, without the root's empty title. */
  private static name_(test: TestCase): string {
    return test
      .titlePath()
      .filter((part) => part !== '')
      .join(' › ');
  }
}
