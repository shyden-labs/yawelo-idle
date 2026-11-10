import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ecosystemsOf,
  judgeDependabot,
  runOf,
  type DependabotRun,
  type Ecosystem,
} from '../../scripts/dependabot-check';

/**
 * The daily Dependabot check (#458): every ecosystem in .github/dependabot.yml
 * must have run within its interval plus two days, and every run in the last
 * interval must have ended `success` or `skipped`. AC0 (measured 2026-11-10,
 * on the issue): a scan with nothing to update leaves a run of its own,
 * named with Dependabot's internal ecosystem name.
 */

const NOW = new Date('2026-11-11T01:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();

const NPM: Ecosystem = { ecosystem: 'npm', directory: '/', interval: 'weekly' };
const ACTIONS: Ecosystem = {
  ecosystem: 'github-actions',
  directory: '/',
  interval: 'weekly',
};

const run = (overrides: Partial<DependabotRun>): DependabotRun => ({
  label: 'npm_and_yarn',
  directory: '/',
  title: 'npm_and_yarn in /. - Update #1',
  url: 'https://github.com/shyden-labs/yawelo-idle/actions/runs/1',
  conclusion: 'success',
  createdAt: ago(DAY_MS),
  ...overrides,
});

describe('ecosystemsOf', () => {
  it("reads this repository's config: every ecosystem with its directory and interval", () => {
    expect(
      ecosystemsOf(readFileSync('.github/dependabot.yml', 'utf8')),
    ).toEqual(expect.arrayContaining([NPM, ACTIONS]));
  });

  it('requires an ecosystem added to the config, with no code change', () => {
    const config = `version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule: { interval: 'weekly' }
  - package-ecosystem: 'docker'
    directory: '/docker/node'
    schedule: { interval: 'daily' }
`;
    expect(ecosystemsOf(config)).toEqual([
      NPM,
      { ecosystem: 'docker', directory: '/docker/node', interval: 'daily' },
    ]);
  });

  it('fails by name on a config it cannot parse', () => {
    expect(() => ecosystemsOf('updates: [')).toThrow(
      '.github/dependabot.yml cannot be parsed',
    );
  });

  it('fails by name on an update with no schedule interval', () => {
    expect(() =>
      ecosystemsOf(
        "version: 2\nupdates:\n  - package-ecosystem: 'npm'\n    directory: '/'\n",
      ),
    ).toThrow(
      '.github/dependabot.yml: update 1 has no package-ecosystem, directory or schedule.interval',
    );
  });
});

describe('runOf: a Dependabot run, read from its title', () => {
  const api = (name: string) => ({
    name,
    path: 'dynamic/dependabot/dependabot-updates',
    html_url: 'https://github.com/x/y/actions/runs/9',
    conclusion: 'success',
    created_at: '2026-11-07T08:03:37Z',
  });

  it("reads a weekly scan's ecosystem and directory (/. is /)", () => {
    expect(runOf(api('npm_and_yarn in /. - Update #1686521844'))).toEqual({
      label: 'npm_and_yarn',
      directory: '/',
      title: 'npm_and_yarn in /. - Update #1686521844',
      url: 'https://github.com/x/y/actions/runs/9',
      conclusion: 'success',
      createdAt: '2026-11-07T08:03:37Z',
    });
  });

  it("reads a dependency update's ecosystem and directory", () => {
    expect(
      runOf(
        api(
          'github_actions in / for actions/upload-artifact - Update #1685690235',
        ),
      ),
    ).toMatchObject({ label: 'github_actions', directory: '/' });
  });

  it('reads a subdirectory', () => {
    expect(
      runOf(api('docker in /docker/node - Update #1686521848')),
    ).toMatchObject({
      label: 'docker',
      directory: '/docker/node',
    });
  });

  it('skips a dynamic run that is not a Dependabot update', () => {
    expect(
      runOf({ ...api('CodeQL'), path: 'dynamic/github-code-scanning/codeql' }),
    ).toBeUndefined();
  });

  it('reads a run still going as no conclusion', () => {
    expect(
      runOf({ ...api('npm_and_yarn in /. - Update #1'), conclusion: null }),
    ).toMatchObject({ conclusion: null });
  });
});

describe('judgeDependabot', () => {
  it('passes when every ecosystem ran successfully within its interval', () => {
    expect(
      judgeDependabot(
        [NPM, ACTIONS],
        [
          run({}),
          run({
            label: 'github_actions',
            title: 'github_actions in /. - Update #2',
          }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it('passes a weekly ecosystem whose newest run is exactly 9 days old', () => {
    expect(
      judgeDependabot([NPM], [run({ createdAt: ago(9 * DAY_MS) })], NOW),
    ).toEqual([]);
  });

  it('fails a weekly ecosystem whose newest run is one second past 9 days', () => {
    expect(
      judgeDependabot([NPM], [run({ createdAt: ago(9 * DAY_MS + 1000) })], NOW),
    ).toEqual([
      `npm in / has not run since ${ago(9 * DAY_MS + 1000)}, past its weekly interval plus two days`,
    ]);
  });

  it('fails a daily ecosystem silent for one second past 3 days', () => {
    const daily: Ecosystem = { ...NPM, interval: 'daily' };
    expect(
      judgeDependabot(
        [daily],
        [run({ createdAt: ago(3 * DAY_MS + 1000) })],
        NOW,
      ),
    ).toHaveLength(1);
  });

  it('fails an ecosystem with no run ever recorded', () => {
    expect(judgeDependabot([ACTIONS], [run({})], NOW)).toEqual([
      'github-actions in / has no Dependabot run recorded',
    ]);
  });

  it("does not count another directory's runs", () => {
    const docker: Ecosystem = {
      ecosystem: 'docker',
      directory: '/docker/node',
      interval: 'weekly',
    };
    expect(
      judgeDependabot(
        [docker],
        [run({ label: 'docker', directory: '/.github/node' })],
        NOW,
      ),
    ).toEqual(['docker in /docker/node has no Dependabot run recorded']);
  });

  it('fails a failed run in the last interval, naming its title and address', () => {
    const failed = run({
      conclusion: 'failure',
      title: 'npm_and_yarn in /. for minimatch - Update #1681611166',
      url: 'https://github.com/x/y/actions/runs/7',
      createdAt: ago(2 * DAY_MS),
    });
    expect(judgeDependabot([NPM], [run({}), failed], NOW)).toEqual([
      'npm in /: "npm_and_yarn in /. for minimatch - Update #1681611166" ended failure: https://github.com/x/y/actions/runs/7',
    ]);
  });

  it('accepts a skipped run', () => {
    expect(
      judgeDependabot([NPM], [run({ conclusion: 'skipped' })], NOW),
    ).toEqual([]);
  });

  it('ignores a failure older than the last interval', () => {
    expect(
      judgeDependabot(
        [NPM],
        [run({}), run({ conclusion: 'failure', createdAt: ago(8 * DAY_MS) })],
        NOW,
      ),
    ).toEqual([]);
  });

  it('ignores a run still going', () => {
    expect(
      judgeDependabot([NPM], [run({}), run({ conclusion: null })], NOW),
    ).toEqual([]);
  });

  it('fails an ecosystem whose run name is unknown, naming it', () => {
    const pip: Ecosystem = {
      ecosystem: 'pip',
      directory: '/',
      interval: 'weekly',
    };
    expect(judgeDependabot([pip], [], NOW)).toEqual([
      'pip in /: no known Dependabot run name for this ecosystem; add it to RUN_LABELS in scripts/dependabot-check.ts',
    ]);
  });

  it('fails an interval it cannot measure, naming it', () => {
    const quarterly: Ecosystem = { ...NPM, interval: 'quarterly' };
    expect(judgeDependabot([quarterly], [run({})], NOW)).toEqual([
      'npm in /: interval quarterly is not daily, weekly or monthly',
    ]);
  });
});
