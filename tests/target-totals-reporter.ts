import type { FullConfig, Reporter, Suite } from '@playwright/test/reporter';
import { BROWSER_TARGETS } from './browser-targets';

const WHY = 'every target runs the same suite (#883)';

/**
 * Prints each target's total, and fails the run when the totals differ, a
 * supported target did not run, a target the list lacks did, or nothing ran
 * at all (#883 AC3). The list reporter beside it prints the run itself.
 */
export default class TargetTotals implements Reporter {
  private readonly targets: readonly string[];
  private readonly write: (text: string) => void;
  private failed = false;

  constructor(
    options: {
      targets?: readonly string[];
      write?: (text: string) => void;
    } = {},
  ) {
    this.targets = options.targets ?? BROWSER_TARGETS.map((t) => t.name);
    this.write = options.write ?? ((text) => process.stdout.write(text));
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    const totals = suite.suites.map(
      (project) =>
        [project.project()?.name ?? '', project.allTests().length] as const,
    );
    this.write(
      `Target totals: ${totals.map(([name, n]) => `${name} ${String(n)}`).join(', ')}\n`,
    );
    const ran = totals.map(([name]) => name);
    const missing = this.targets.filter((name) => !ran.includes(name));
    const extra = ran.filter((name) => !this.targets.includes(name));
    const counts = new Set(totals.map(([, n]) => n));
    if (missing.length > 0)
      this.fail(`Targets not run: ${missing.join(', ')}: ${WHY}`);
    if (extra.length > 0)
      this.fail(`Targets not supported: ${extra.join(', ')}: ${WHY}`);
    if (counts.size > 1) this.fail(`Target totals differ: ${WHY}`);
    if (counts.has(0)) this.fail(`A target ran no test: ${WHY}`);
  }

  onEnd(): Promise<{ status: 'failed' } | undefined> {
    return Promise.resolve(this.failed ? { status: 'failed' } : undefined);
  }

  private fail(message: string): void {
    this.failed = true;
    this.write(`${message}\n`);
  }
}
