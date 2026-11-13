import type { Reporter, TestCase } from 'vitest/node';

/**
 * Prints how many assertions each integration test made in this run (#933
 * AC6), read from Vitest itself: its count of `expect` calls in the test,
 * hard and soft. The setup file (vitest-assertion-counts-setup.ts) copies
 * that count onto the test's meta after each test; this reporter prints it.
 * A test with no recorded count prints "unknown", never 0.
 */
export default class VitestAssertionCounts implements Reporter {
  private readonly write: (text: string) => void;
  private readonly lines: string[] = [];
  private all = 0;

  constructor(options: { write?: (text: string) => void } = {}) {
    this.write = options.write ?? ((text) => process.stdout.write(text));
  }

  onTestCaseResult(testCase: TestCase): void {
    const recorded = (testCase.meta() as { assertions?: unknown }).assertions;
    const count = typeof recorded === 'number' ? recorded : undefined;
    if (count !== undefined) this.all += count;
    this.lines.push(
      `${testCase.module.relativeModuleId} › ${testCase.fullName}: ${count === undefined ? 'unknown' : String(count)}\n`,
    );
  }

  onTestRunEnd(): void {
    this.write(
      `Assertions per test (#933):\n${this.lines.join('')}` +
        `Assertions in all: ${String(this.all)} in ${String(this.lines.length)} tests\n`,
    );
  }
}

/** Copies a test's assertion count onto its meta, for the reporter. */
export function recordAssertions(
  task: { meta: Record<string, unknown> },
  assertions: number,
): void {
  task.meta['assertions'] = assertions;
}
