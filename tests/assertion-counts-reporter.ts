import { basename } from 'node:path';
import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

/**
 * Prints how many assertions each Playwright test made in the run (#933 AC6),
 * from the runner's own `expect` steps, hard and soft. An `expect` made
 * inside another (a `toPass` or `poll` retry) is part of that one, so it is
 * not counted again. A retried test counts its last attempt.
 */
export default class AssertionCounts implements Reporter {
  private readonly counts = new Map<string, number>();

  private readonly write: (text: string) => void;

  constructor(
    write: (text: string) => void = (text) => {
      process.stdout.write(text);
    },
  ) {
    this.write = write;
  }

  /** `project › file › describe… › title`. */
  private static nameOf(test: TestCase): string {
    const [, project = '', file = '', ...titles] = test.titlePath();
    return [project, basename(file), ...titles].join(' › ');
  }

  private static insideAnExpect(step: TestStep): boolean {
    for (let up = step.parent; up !== undefined; up = up.parent)
      if (up.category === 'expect') return true;
    return false;
  }

  onTestBegin(test: TestCase): void {
    this.counts.set(AssertionCounts.nameOf(test), 0);
  }

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'expect' || AssertionCounts.insideAnExpect(step))
      return;
    const name = AssertionCounts.nameOf(test);
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
  }

  onEnd(): void {
    let all = 0;
    let text = 'Assertions per test (#933):\n';
    for (const [name, count] of this.counts) {
      text += `${name}: ${String(count)}\n`;
      all += count;
    }
    text += `Assertions in all: ${String(all)} in ${String(this.counts.size)} tests\n`;
    this.write(text);
  }
}
