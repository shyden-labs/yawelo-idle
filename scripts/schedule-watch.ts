/**
 * The schedule watch (#710): a daily check that does not run tells nobody,
 * so something that does not hang on its schedule must notice a missed day.
 *
 *   node scripts/schedule-watch.ts <owner/repo>
 *
 * with GH_TOKEN (the run's own token: actions: read, issues: write) in the
 * environment. `.github/workflows/schedule-watch.yml` runs it on every push
 * to develop, on its own schedule twelve and a half hours from
 * owner-review's, and by hand.
 *
 * For each workflow in `WATCHED` it reads GitHub's record: the workflow must
 * be `active` (GitHub disables a public repository's schedules after 60 days
 * without activity), its newest `schedule` run must be no older than
 * `LIMIT_HOURS`, or, before its first scheduled run, GitHub must have first
 * seen it within that time, and that run must not have ended in anything
 * but success. A read that fails or a reply it cannot place is a problem
 * too (fail closed). Each workflow with a problem gets one issue assigned
 * to ShydenMcM, or a comment on the one already open, and the run is red.
 */
import { execFileSync } from 'node:child_process';
import type { Gh } from './board-progress.ts';
import { isRecord } from './gh-reads.ts';
import { report } from './issue-report.ts';

/**
 * Every scheduled workflow in this repository, with its cron, each daily.
 * tests/unit/schedule-watch.test.ts holds this equal to the workflows on
 * disk, so a new schedule cannot go unwatched.
 */
export const WATCHED: readonly { file: string; cron: string }[] = [
  { file: 'owner-review.yml', cron: '17 2 * * *' },
  { file: 'schedule-watch.yml', cron: '47 14 * * *' },
];

/**
 * The longest a daily workflow may go between scheduled runs: a day, plus
 * twelve hours for GitHub's delay under load (measured on #710: owner-
 * review's first scheduled run started 320 minutes after its slot).
 */
export const LIMIT_HOURS = 36;

const HOUR = 3_600_000;

/** The issue the watch opens for `file`, and finds again while it is open. */
export const issueTitle = (file: string): string =>
  `The daily ${file} run is missing or failed (schedule watch, #710)`;

/** A judgement: what it read, and what it found wrong in what it read. */
export interface Judgement {
  checked: string[];
  problems: string[];
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** `text` as JSON, or undefined when it is not. */
function json(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** A time GitHub wrote, offset included, or undefined when unreadable. */
function timeOf(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : at;
}

const shown = (value: unknown): string =>
  value === undefined ? 'missing' : JSON.stringify(value);

const hours = (now: number, at: number): string =>
  ((now - at) / HOUR).toFixed(1);

/** The newest run in a runs reply, or undefined when the reply has no list. */
function newestRun(runsReply: string): { found: boolean; newest: unknown } {
  const runs = json(runsReply);
  if (!isRecord(runs) || !Array.isArray(runs.workflow_runs))
    return { found: false, newest: undefined };
  return { found: true, newest: runs.workflow_runs[0] };
}

/**
 * One watched workflow judged from GitHub's replies: the workflow itself,
 * and its runs listed newest first, filtered to `schedule`.
 */
export function workflowJudgement(
  file: string,
  workflowReply: string,
  runsReply: string,
  now: number,
): Judgement {
  const workflow = json(workflowReply);
  if (workflow === undefined)
    return {
      checked: [],
      problems: [`could not read ${file}'s state: the reply is not JSON`],
    };
  if (!isRecord(workflow) || typeof workflow.state !== 'string')
    return {
      checked: [],
      problems: [`could not read ${file}'s state: the reply has no state`],
    };
  const checked = ['state'];
  const problems: string[] = [];
  if (workflow.state !== 'active')
    problems.push(
      `${file} is ${workflow.state} on GitHub, so its schedule no longer runs: Actions > ${file} > Enable workflow`,
    );
  const { found, newest } = newestRun(runsReply);
  if (!found) {
    problems.push(
      `could not read ${file}'s scheduled runs: the reply has no workflow_runs list`,
    );
    return { checked, problems };
  }
  if (newest === undefined) {
    const seen = timeOf(workflow.created_at);
    if (seen === undefined) {
      problems.push(
        `could not read when GitHub first saw ${file}: its created_at is ${shown(workflow.created_at)}`,
      );
      return { checked, problems };
    }
    checked.push('first seen');
    if (now - seen > LIMIT_HOURS * HOUR)
      problems.push(
        `${file} has not run on its schedule since GitHub first saw it at ${String(workflow.created_at)}, ${hours(now, seen)} hours ago`,
      );
    return { checked, problems };
  }
  const at = isRecord(newest) ? timeOf(newest.created_at) : undefined;
  if (!isRecord(newest) || at === undefined) {
    problems.push(
      `could not read ${file}'s newest scheduled run: its created_at is ${shown(isRecord(newest) ? newest.created_at : newest)}`,
    );
    return { checked, problems };
  }
  checked.push('newest scheduled run');
  if (now - at > LIMIT_HOURS * HOUR)
    problems.push(
      `${file} last ran on its schedule at ${String(newest.created_at)}, ${hours(now, at)} hours ago: a daily run more than ${String(LIMIT_HOURS)} hours after the last one means a day was missed or dropped`,
    );
  if (newest.status === 'completed' && newest.conclusion !== 'success')
    problems.push(
      `${file}'s newest scheduled run ended ${String(newest.conclusion)}: ${String(newest.html_url)}`,
    );
  return { checked, problems };
}

/** What the watch says of a workflow it found nothing wrong with. */
function fine(file: string, runsReply: string, now: number): string {
  const { newest } = newestRun(runsReply);
  const at = isRecord(newest) ? timeOf(newest.created_at) : undefined;
  if (!isRecord(newest) || at === undefined)
    return `${file}: has no scheduled run yet, and GitHub first saw it within ${String(LIMIT_HOURS)} hours.`;
  const state =
    newest.status === 'completed' ? 'passed' : `is ${String(newest.status)}`;
  return `${file}: last ran on its schedule at ${String(newest.created_at)}, ${hours(now, at)} hours ago, and ${state}.`;
}

/**
 * Judges every watched workflow and reports each one found wrong: `ok`
 * only when nothing is.
 */
export function scheduleWatch(
  repo: string,
  gh: Gh,
  now: number,
): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  for (const { file } of WATCHED) {
    const base = `repos/${repo}/actions/workflows/${file}`;
    let problems: string[];
    let runsReply = '';
    try {
      const workflowReply = gh(['api', base]);
      runsReply = gh(['api', `${base}/runs?event=schedule&per_page=1`]);
      problems = workflowJudgement(
        file,
        workflowReply,
        runsReply,
        now,
      ).problems;
    } catch (error) {
      problems = [`could not read ${file} on GitHub: ${message(error)}`];
    }
    if (problems.length === 0) {
      lines.push(fine(file, runsReply, now));
      continue;
    }
    ok = false;
    lines.push(
      ...report(repo, gh, {
        title: issueTitle(file),
        lead: 'The schedule watch (#710) found:',
        problems,
        footer: `Until this is fixed, ${file} may not be checking what it guards, and a daily check that does not run tells nobody. The watched list and the limit are in \`scripts/schedule-watch.ts\`.`,
      }),
    );
  }
  return { ok, lines };
}

if (import.meta.main) {
  try {
    const repo = process.argv[2];
    if (repo === undefined || !/^[\w.-]+\/[\w.-]+$/.test(repo))
      throw new Error('usage: node scripts/schedule-watch.ts <owner/repo>');
    const gh: Gh = (args) =>
      execFileSync('gh', args, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
    const { ok, lines } = scheduleWatch(repo, gh, Date.now());
    for (const line of lines) process.stdout.write(`${line}\n`);
    if (!ok) {
      process.stdout.write(
        `::error::${lines[1] ?? 'a scheduled workflow is missing or failed'}\n`,
      );
      process.exitCode = 1;
    }
  } catch (error) {
    process.stdout.write(`::error::${message(error)}\n`);
    process.exitCode = 1;
  }
}
