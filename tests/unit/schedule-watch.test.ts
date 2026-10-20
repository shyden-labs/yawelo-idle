import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { Gh } from '../../scripts/board-progress';
import {
  LIMIT_HOURS,
  WATCHED,
  issueTitle,
  scheduleWatch,
  workflowJudgement,
} from '../../scripts/schedule-watch';
import { floorBreach } from '../floors';
import { searched } from '../searched';
import { isRecord } from './workflow-secrets';

/**
 * The schedule watch (#710): every scheduled workflow ran on its schedule
 * within the limit, is still enabled, and its newest scheduled run passed.
 * Every read and write goes through a stand-in `gh`, so these tests reach no
 * network.
 */

const REPO = 'shyden-labs/yawelo-idle';
const FILE = 'owner-review.yml';
const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-21T12:00:00Z');
const hoursAgo = (hours: number): string =>
  new Date(NOW - hours * HOUR).toISOString();

const workflowReply = (fields: Record<string, unknown> = {}): string =>
  JSON.stringify({
    path: `.github/workflows/${FILE}`,
    state: 'active',
    created_at: hoursAgo(200),
    ...fields,
  });

const runsReply = (...runs: Record<string, unknown>[]): string =>
  JSON.stringify({
    total_count: runs.length,
    workflow_runs: runs.map((run) => ({
      event: 'schedule',
      status: 'completed',
      conclusion: 'success',
      created_at: hoursAgo(10),
      html_url: 'https://github.com/shyden-labs/yawelo-idle/actions/runs/1',
      ...run,
    })),
  });

describe('workflowJudgement', () => {
  it('finds nothing when the newest scheduled run passed within the limit', () => {
    const judged = workflowJudgement(FILE, workflowReply(), runsReply({}), NOW);
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'facts read about one scheduled workflow',
      }),
    ).toEqual([]);
    expect(
      floorBreach('schedule-watch/facts-checked', judged.checked.length),
    ).toBeUndefined();
  });

  it('passes a run exactly at the limit', () => {
    const judged = workflowJudgement(
      FILE,
      workflowReply(),
      runsReply({ created_at: hoursAgo(LIMIT_HOURS) }),
      NOW,
    );
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'facts read about one scheduled workflow',
      }),
    ).toEqual([]);
    expect(
      floorBreach('schedule-watch/at-limit-checked', judged.checked.length),
    ).toBeUndefined();
  });

  it('names a run one second past the limit as a missed day', () => {
    const at = new Date(NOW - LIMIT_HOURS * HOUR - 1000).toISOString();
    expect(
      workflowJudgement(
        FILE,
        workflowReply(),
        runsReply({ created_at: at }),
        NOW,
      ).problems,
    ).toEqual([
      `${FILE} last ran on its schedule at ${at}, 36.0 hours ago: a daily run more than ${String(LIMIT_HOURS)} hours after the last one means a day was missed or dropped`,
    ]);
  });

  it("reads a time with an offset, as GitHub writes a workflow's times", () => {
    expect(
      workflowJudgement(
        FILE,
        workflowReply({ created_at: '2026-10-19T12:00:00.000+07:00' }),
        runsReply(),
        NOW,
      ).problems,
    ).toEqual([
      `${FILE} has not run on its schedule since GitHub first saw it at 2026-10-19T12:00:00.000+07:00, 55.0 hours ago`,
    ]);
  });

  it('passes a workflow with no scheduled run yet that GitHub first saw within the limit', () => {
    const judged = workflowJudgement(
      FILE,
      workflowReply({ created_at: hoursAgo(3) }),
      runsReply(),
      NOW,
    );
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'facts read about one scheduled workflow',
      }),
    ).toEqual([]);
    expect(
      floorBreach('schedule-watch/never-run-checked', judged.checked.length),
    ).toBeUndefined();
  });

  it('names a disabled workflow, and where to enable it', () => {
    expect(
      workflowJudgement(
        FILE,
        workflowReply({ state: 'disabled_inactivity' }),
        runsReply({}),
        NOW,
      ).problems,
    ).toEqual([
      `${FILE} is disabled_inactivity on GitHub, so its schedule no longer runs: Actions > ${FILE} > Enable workflow`,
    ]);
  });

  it('names a newest scheduled run that failed, with its address', () => {
    expect(
      workflowJudgement(
        FILE,
        workflowReply(),
        runsReply({ conclusion: 'failure' }),
        NOW,
      ).problems,
    ).toEqual([
      `${FILE}'s newest scheduled run ended failure: https://github.com/shyden-labs/yawelo-idle/actions/runs/1`,
    ]);
  });

  it('names a newest scheduled run that was cancelled', () => {
    expect(
      workflowJudgement(
        FILE,
        workflowReply(),
        runsReply({ conclusion: 'cancelled' }),
        NOW,
      ).problems,
    ).toEqual([
      `${FILE}'s newest scheduled run ended cancelled: https://github.com/shyden-labs/yawelo-idle/actions/runs/1`,
    ]);
  });

  it('passes a newest scheduled run still in progress', () => {
    const judged = workflowJudgement(
      FILE,
      workflowReply(),
      runsReply({ status: 'in_progress', conclusion: null }),
      NOW,
    );
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'facts read about one scheduled workflow',
      }),
    ).toEqual([]);
    expect(
      floorBreach('schedule-watch/running-checked', judged.checked.length),
    ).toBeUndefined();
  });

  it('judges only the newest run, the first GitHub lists', () => {
    const judged = workflowJudgement(
      FILE,
      workflowReply(),
      runsReply({}, { conclusion: 'failure', created_at: hoursAgo(34) }),
      NOW,
    );
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'facts read about one scheduled workflow',
      }),
    ).toEqual([]);
    expect(
      floorBreach('schedule-watch/newest-only-checked', judged.checked.length),
    ).toBeUndefined();
  });

  it('fails closed on a workflow reply that is not JSON', () => {
    expect(
      workflowJudgement(FILE, 'not json', runsReply({}), NOW).problems,
    ).toEqual([`could not read ${FILE}'s state: the reply is not JSON`]);
  });

  it('fails closed on a workflow reply with no state', () => {
    expect(
      workflowJudgement(
        FILE,
        workflowReply({ state: undefined }),
        runsReply({}),
        NOW,
      ).problems,
    ).toEqual([`could not read ${FILE}'s state: the reply has no state`]);
  });

  it('fails closed on a runs reply with no list of runs', () => {
    expect(
      workflowJudgement(FILE, workflowReply(), '{"total_count":0}', NOW)
        .problems,
    ).toEqual([
      `could not read ${FILE}'s scheduled runs: the reply has no workflow_runs list`,
    ]);
  });

  it('fails closed on a run whose time cannot be read', () => {
    expect(
      workflowJudgement(
        FILE,
        workflowReply(),
        runsReply({ created_at: 'yesterday' }),
        NOW,
      ).problems,
    ).toEqual([
      `could not read ${FILE}'s newest scheduled run: its created_at is "yesterday"`,
    ]);
  });

  it('fails closed on a workflow with no scheduled run whose first-seen time cannot be read', () => {
    expect(
      workflowJudgement(
        FILE,
        workflowReply({ created_at: undefined }),
        runsReply(),
        NOW,
      ).problems,
    ).toEqual([
      `could not read when GitHub first saw ${FILE}: its created_at is missing`,
    ]);
  });
});

interface Call {
  args: readonly string[];
}

/** Every watched workflow as fine, unless `replies` says otherwise. */
function run(
  replies: {
    workflow?: (file: string) => string;
    runs?: (file: string) => string;
    openIssues?: string;
  } = {},
) {
  const calls: Call[] = [];
  const gh: Gh = (args) => {
    calls.push({ args });
    const path = args.find((a) => a.startsWith('repos/')) ?? '';
    const file = /actions\/workflows\/([^/?]+)/.exec(path)?.[1] ?? '';
    if (args.includes('POST')) return '{}';
    if (path.includes('/issues?')) return replies.openIssues ?? '[[]]';
    if (path.includes('/runs?')) return replies.runs?.(file) ?? runsReply({});
    return replies.workflow?.(file) ?? workflowReply();
  };
  const result = scheduleWatch(REPO, gh, NOW);
  return {
    result,
    calls,
    writes: calls.filter((c) => c.args.includes('POST')),
  };
}

const late = (file: string) =>
  file === FILE ? runsReply({ created_at: hoursAgo(50) }) : runsReply({});

describe('scheduleWatch', () => {
  it('opens nothing when every watched workflow ran within the limit', () => {
    const { result, writes } = run();
    expect([result.ok, writes]).toEqual([true, []]);
  });

  it('reads each watched workflow and its newest scheduled run, in the order watched', () => {
    const { calls } = run();
    expect(calls.map((c) => c.args)).toEqual(
      WATCHED.flatMap(({ file }) => [
        ['api', `repos/${REPO}/actions/workflows/${file}`],
        [
          'api',
          `repos/${REPO}/actions/workflows/${file}/runs?event=schedule&per_page=1`,
        ],
      ]),
    );
  });

  it('says each workflow it judged and when it last ran', () => {
    const { result } = run();
    expect(result.lines).toEqual(
      WATCHED.map(
        ({ file }) =>
          `${file}: last ran on its schedule at ${hoursAgo(10)}, 10.0 hours ago, and passed.`,
      ),
    );
  });

  it('opens one issue assigned to Shyden, titled for the late workflow alone', () => {
    const { result, writes } = run({ runs: late });
    expect(result.ok).toBe(false);
    expect(writes.map((w) => w.args.slice(0, 4))).toEqual([
      ['api', '-X', 'POST', `repos/${REPO}/issues`],
    ]);
    expect(writes[0]?.args).toContain(`title=${issueTitle(FILE)}`);
    expect(writes[0]?.args).toContain('assignees[]=ShydenMcM');
  });

  it('opens one issue per late workflow', () => {
    const { writes } = run({
      runs: () => runsReply({ created_at: hoursAgo(50) }),
    });
    expect(
      writes.map((w) => w.args.find((a) => a.startsWith('title='))),
    ).toEqual(WATCHED.map(({ file }) => `title=${issueTitle(file)}`));
  });

  it('comments on the issue already open for that workflow', () => {
    const { writes } = run({
      runs: late,
      openIssues: JSON.stringify([
        [
          { number: 12, title: issueTitle('another.yml') },
          { number: 34, title: issueTitle(FILE) },
        ],
      ]),
    });
    expect(writes.map((w) => w.args.slice(0, 4))).toEqual([
      ['api', '-X', 'POST', `repos/${REPO}/issues/34/comments`],
    ]);
  });

  it('names the problem and what it breaks in the issue', () => {
    const { writes } = run({ runs: late });
    const body = writes[0]?.args.find((a) => a.startsWith('body=')) ?? '';
    expect([
      body.startsWith('body=The schedule watch (#710) found:'),
      body.includes(`- ${FILE} last ran on its schedule at ${hoursAgo(50)}`),
      body.includes('a daily check that does not run tells nobody'),
    ]).toEqual([true, true, true]);
  });

  it('reports a read that fails, never passing over it', () => {
    const { result, writes } = run({
      workflow: (file) => {
        if (file === FILE) throw new Error('HTTP 502');
        return workflowReply();
      },
    });
    expect(result.ok).toBe(false);
    expect(writes[0]?.args).toContain(`title=${issueTitle(FILE)}`);
    expect(result.lines).toContain(
      `could not read ${FILE} on GitHub: HTTP 502`,
    );
  });
});

const WORKFLOWS = '.github/workflows';

/** Every workflow on disk whose `on:` holds `schedule`, with its crons. */
function scheduledOnDisk(): { file: string; cron: string }[] {
  return readdirSync(WORKFLOWS)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .flatMap((file) => {
      const workflow: unknown = parse(
        readFileSync(`${WORKFLOWS}/${file}`, 'utf8'),
      );
      if (!isRecord(workflow) || !isRecord(workflow.on)) return [];
      const schedule: unknown = workflow.on.schedule;
      if (!Array.isArray(schedule)) return [];
      return schedule.map((entry: unknown) => ({
        file,
        cron: isRecord(entry) ? String(entry.cron) : String(entry),
      }));
    });
}

describe('WATCHED', () => {
  it('names every scheduled workflow on disk with its cron, and nothing else', () => {
    const onDisk = scheduledOnDisk();
    expect([...WATCHED].sort((a, b) => a.file.localeCompare(b.file))).toEqual(
      onDisk,
    );
  });

  it('watches itself, so a stopped watch is seen on the next push', () => {
    expect(WATCHED.map((w) => w.file)).toContain('schedule-watch.yml');
  });

  it.each(WATCHED)(
    '$file runs once a day, which the limit assumes ($cron)',
    ({ cron }) => {
      expect(cron).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    },
  );

  it('allows a day and twelve hours between scheduled runs', () => {
    expect(LIMIT_HOURS).toBe(36);
  });
});
