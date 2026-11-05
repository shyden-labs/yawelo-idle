import { describe, expect, it } from 'vitest';
import type { FullConfig, Suite } from '@playwright/test/reporter';
import TargetTotals from '../target-totals-reporter';

/**
 * Each target's total is printed, and a run whose targets ran different
 * totals, or that left a target out, fails (#883 AC3). Playwright hands the
 * reporter one suite per project; these stand-ins carry what it reads.
 */

const run = (totals: Record<string, number>): Suite =>
  ({
    suites: Object.entries(totals).map(([name, count]) => ({
      project: () => ({ name }),
      allTests: () => Array.from({ length: count }),
    })),
  }) as unknown as Suite;

const TARGETS = ['chromium', 'webkit-phone'];

async function report(totals: Record<string, number>) {
  const printed: string[] = [];
  const reporter = new TargetTotals({
    targets: TARGETS,
    write: (line) => printed.push(line),
  });
  reporter.onBegin({} as FullConfig, run(totals));
  const end = await reporter.onEnd();
  return { printed: printed.join(''), end };
}

describe('the target totals reporter', () => {
  it('prints every target’s total and leaves an even run alone', async () => {
    const { printed, end } = await report({ chromium: 7, 'webkit-phone': 7 });
    expect(printed).toBe('Target totals: chromium 7, webkit-phone 7\n');
    expect(end).toBeUndefined();
  });

  it('fails a run whose targets ran different totals, naming them', async () => {
    const { printed, end } = await report({ chromium: 7, 'webkit-phone': 6 });
    expect(printed).toContain('Target totals: chromium 7, webkit-phone 6\n');
    expect(printed).toContain(
      'Target totals differ: every target runs the same suite (#883)\n',
    );
    expect(end).toEqual({ status: 'failed' });
  });

  it('fails a run that left a supported target out, naming it', async () => {
    const { printed, end } = await report({ chromium: 7 });
    expect(printed).toContain(
      'Targets not run: webkit-phone: every target runs the same suite (#883)\n',
    );
    expect(end).toEqual({ status: 'failed' });
  });

  it('fails a run with a target the list does not name', async () => {
    const { printed, end } = await report({
      chromium: 7,
      'webkit-phone': 7,
      'webkit-tablet': 7,
    });
    expect(printed).toContain(
      'Targets not supported: webkit-tablet: every target runs the same suite (#883)\n',
    );
    expect(end).toEqual({ status: 'failed' });
  });

  it('fails a run in which no target ran a test', async () => {
    const { end } = await report({ chromium: 0, 'webkit-phone': 0 });
    expect(end).toEqual({ status: 'failed' });
  });
});
