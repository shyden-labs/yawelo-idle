import { describe, expect, it } from 'vitest';
import type { FullConfig, Suite } from '@playwright/test/reporter';
import TargetTotals from '../target-totals-reporter';
import type { DeviceGroup } from '../browser-targets';

/**
 * Each target's total is printed under its device group, and a run fails
 * when two targets of one group ran different totals, a target was left
 * out, or a group-only test gives no reason (#883 AC3, #996). Playwright
 * hands the reporter one suite per project; these stand-ins carry what it
 * reads.
 */

interface StandInTest {
  title: string;
  tags: string[];
  annotations: { type: string; description?: string }[];
}

const shared = (title: string): StandInTest => ({
  title,
  tags: [],
  annotations: [],
});

const tests = (count: number): StandInTest[] =>
  Array.from({ length: count }, (_, i) => shared(`test ${String(i)}`));

const run = (ran: Record<string, StandInTest[]>): Suite =>
  ({
    suites: Object.entries(ran).map(([name, list]) => ({
      project: () => ({ name }),
      allTests: () => list,
    })),
  }) as unknown as Suite;

const TARGETS: { name: string; group: DeviceGroup }[] = [
  { name: 'chromium', group: 'desktop' },
  { name: 'firefox', group: 'desktop' },
  { name: 'android', group: 'phone' },
];

async function report(ran: Record<string, StandInTest[]>) {
  const printed: string[] = [];
  const reporter = new TargetTotals({
    targets: TARGETS,
    write: (line) => printed.push(line),
  });
  reporter.onBegin({} as FullConfig, run(ran));
  const end = await reporter.onEnd();
  return { printed: printed.join(''), end };
}

describe('the target totals reporter', () => {
  it('prints every target’s total under its group and leaves an even run alone', async () => {
    const { printed, end } = await report({
      chromium: tests(7),
      firefox: tests(7),
      android: tests(7),
    });
    expect(printed).toBe(
      'Target totals: desktop: chromium 7, firefox 7; phone: android 7\n',
    );
    expect(end).toBeUndefined();
  });

  it('allows the groups to differ when the difference is tagged with a reason', async () => {
    const keyboard: StandInTest = {
      title: 'Tab reaches the first island',
      tags: ['@desktop'],
      annotations: [{ type: 'group-only', description: 'hardware keyboard' }],
    };
    const { end } = await report({
      chromium: [...tests(7), keyboard],
      firefox: [...tests(7), keyboard],
      android: tests(7),
    });
    expect(end).toBeUndefined();
  });

  it('fails a run whose targets in one group ran different totals, naming the group', async () => {
    const { printed, end } = await report({
      chromium: tests(7),
      firefox: tests(6),
      android: tests(7),
    });
    expect(printed).toContain(
      'Target totals differ within desktop: every target in a group runs the same suite (#883, #996)\n',
    );
    expect(end).toEqual({ status: 'failed' });
  });

  it('fails a group-only test that gives no reason, naming it', async () => {
    const bare: StandInTest = {
      title: 'Tab reaches the first island',
      tags: ['@desktop'],
      annotations: [],
    };
    const { printed, end } = await report({
      chromium: [...tests(7), bare],
      firefox: [...tests(7), bare],
      android: tests(7),
    });
    expect(printed).toContain(
      'Group-only test without a reason: Tab reaches the first island: a @phone or @desktop test names the input or feature that differs in a group-only annotation (#996)\n',
    );
    expect(end).toEqual({ status: 'failed' });
  });

  it('fails a group-only test whose reason is blank', async () => {
    const blank: StandInTest = {
      title: 'rotates to landscape',
      tags: ['@phone'],
      annotations: [{ type: 'group-only', description: ' ' }],
    };
    const { printed, end } = await report({
      chromium: tests(7),
      firefox: tests(7),
      android: [...tests(7), blank],
    });
    expect(printed).toContain(
      'Group-only test without a reason: rotates to landscape: a @phone or @desktop test names the input or feature that differs in a group-only annotation (#996)\n',
    );
    expect(end).toEqual({ status: 'failed' });
  });

  it.each([['@mobile'], ['@Phone'], ['@tablet'], ['@ios'], ['@android']])(
    'fails a device tag other than @phone or @desktop: %s',
    async (tag) => {
      const odd: StandInTest = {
        title: 'something',
        tags: [tag],
        annotations: [{ type: 'group-only', description: 'touch' }],
      };
      const { printed, end } = await report({
        chromium: [...tests(7), odd],
        firefox: [...tests(7), odd],
        android: [...tests(7), odd],
      });
      expect(printed).toContain(
        `Unknown device tag ${tag} on something: only @phone and @desktop name a group (#996)\n`,
      );
      expect(end).toEqual({ status: 'failed' });
    },
  );

  it('fails a run that left a supported target out, naming it', async () => {
    const { printed, end } = await report({
      chromium: tests(7),
      firefox: tests(7),
    });
    expect(printed).toContain(
      'Targets not run: android: every target in a group runs the same suite (#883, #996)\n',
    );
    expect(end).toEqual({ status: 'failed' });
  });

  it('fails a run with a target the list does not name', async () => {
    const { printed, end } = await report({
      chromium: tests(7),
      firefox: tests(7),
      android: tests(7),
      'webkit-tablet': tests(7),
    });
    expect(printed).toContain(
      'Targets not supported: webkit-tablet: every target in a group runs the same suite (#883, #996)\n',
    );
    expect(end).toEqual({ status: 'failed' });
  });

  it('fails a run in which a target ran no test', async () => {
    const { end } = await report({
      chromium: tests(0),
      firefox: tests(0),
      android: tests(0),
    });
    expect(end).toEqual({ status: 'failed' });
  });
});
