import type {
  FullConfig,
  Reporter,
  Suite,
  TestCase,
} from '@playwright/test/reporter';
import { BROWSER_TARGETS, type DeviceGroup } from './browser-targets';

const WHY = 'every target in a group runs the same suite (#883, #996)';
const GROUP_TAGS = new Set(['@phone', '@desktop']);
const DEVICE_WORD = /^@(phone|desktop|mobile|tablet|ios|iphone|ipad|android)/i;

/**
 * Prints each target's total under its device group (phones and tablets;
 * desktop browsers), and fails the run when two targets of one group ran
 * different totals, a supported target did not run, a target the list lacks
 * did, a target ran nothing, a `@phone` or `@desktop` test gives no reason,
 * or a test carries a device tag that names no group (#883 AC3, #996). The
 * list reporter beside it prints the run itself.
 */
export default class TargetTotals implements Reporter {
  private readonly targets: readonly { name: string; group: DeviceGroup }[];
  private readonly write: (text: string) => void;
  private failed = false;

  constructor(
    options: {
      targets?: readonly { name: string; group: DeviceGroup }[];
      write?: (text: string) => void;
    } = {},
  ) {
    this.targets =
      options.targets ??
      BROWSER_TARGETS.map((t) => ({ name: t.name, group: t.metadata.group }));
    this.write = options.write ?? ((text) => process.stdout.write(text));
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    const ran = suite.suites.map((project) => ({
      name: project.project()?.name ?? '',
      tests: project.allTests(),
    }));
    const groupOf = new Map(this.targets.map((t) => [t.name, t.group]));
    const groups = [...new Set(this.targets.map((t) => t.group))];
    const line = groups
      .map(
        (group) =>
          `${group}: ${ran
            .filter((r) => groupOf.get(r.name) === group)
            .map((r) => `${r.name} ${String(r.tests.length)}`)
            .join(', ')}`,
      )
      .join('; ');
    this.write(`Target totals: ${line}\n`);

    const names = ran.map((r) => r.name);
    const missing = this.targets
      .map((t) => t.name)
      .filter((name) => !names.includes(name));
    const extra = names.filter((name) => !groupOf.has(name));
    if (missing.length > 0)
      this.fail(`Targets not run: ${missing.join(', ')}: ${WHY}`);
    if (extra.length > 0)
      this.fail(`Targets not supported: ${extra.join(', ')}: ${WHY}`);
    for (const group of groups) {
      const counts = new Set(
        ran
          .filter((r) => groupOf.get(r.name) === group)
          .map((r) => r.tests.length),
      );
      if (counts.size > 1)
        this.fail(`Target totals differ within ${group}: ${WHY}`);
    }
    if (ran.some((r) => r.tests.length === 0))
      this.fail(`A target ran no test: ${WHY}`);
    this.checkTags(ran.flatMap((r) => r.tests));
  }

  onEnd(): Promise<{ status: 'failed' } | undefined> {
    return Promise.resolve(this.failed ? { status: 'failed' } : undefined);
  }

  /** Each problem once, however many targets ran the test. */
  private checkTags(tests: readonly TestCase[]): void {
    const problems = new Set<string>();
    for (const test of tests) {
      for (const tag of test.tags) {
        if (GROUP_TAGS.has(tag)) {
          const reason = test.annotations.find((a) => a.type === 'group-only');
          if ((reason?.description ?? '').trim() === '')
            problems.add(
              `Group-only test without a reason: ${test.title}: a @phone or @desktop test names the input or feature that differs in a group-only annotation (#996)`,
            );
        } else if (DEVICE_WORD.test(tag)) {
          problems.add(
            `Unknown device tag ${tag} on ${test.title}: only @phone and @desktop name a group (#996)`,
          );
        }
      }
    }
    for (const problem of problems) this.fail(problem);
  }

  private fail(message: string): void {
    this.failed = true;
    this.write(`${message}\n`);
  }
}
