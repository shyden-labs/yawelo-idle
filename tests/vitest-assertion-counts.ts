import type { Reporter, TestCase } from 'vitest/node';

/**
 * Prints how many assertions each integration test made in the run (#933
 * AC6), from Vitest's own count, copied onto the test's meta by
 * ./vitest-assertion-counts-setup.ts. A test with no count recorded (one
 * skipped, or failed before its hook ran) prints `unknown`, never 0.
 */
export default class VitestAssertionCounts implements Reporter {
  private readonly lines: string[] = [];
  private all = 0;

  private readonly write: (text: string) => void;

  /**
   * The runner builds a reporter with its own options object, so the
   * writer comes in one too; a test passes `write`, the runner none.
   */
  constructor(
    options: { write?: (text: string) => void; [option: string]: unknown } = {},
  ) {
    this.write =
      options.write ??
      ((text) => {
        process.stdout.write(text);
      });
  }

  onTestCaseResult(testCase: TestCase): void {
    const recorded: unknown = (testCase.meta() as Record<string, unknown>)
      .assertionCalls;
    const count = typeof recorded === 'number' ? recorded : null;
    if (count !== null) this.all += count;
    this.lines.push(
      `${testCase.module.relativeModuleId} › ${testCase.fullName}: ${count === null ? 'unknown' : String(count)}\n`,
    );
  }

  onTestRunEnd(): void {
    this.write(
      'Assertions per test (#933):\n' +
        this.lines.join('') +
        `Assertions in all: ${String(this.all)} in ${String(this.lines.length)} tests\n`,
    );
  }
}

/** Copies a finished test's assertion count onto its meta, for the reporter. */
export function recordAssertions(
  meta: Record<string, unknown>,
  assertionCalls: number,
): void {
  meta.assertionCalls = assertionCalls;
}
