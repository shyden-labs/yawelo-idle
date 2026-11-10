/**
 * The daily Dependabot check (#458; global rule: nothing we rely on stops
 * silently). A failed Dependabot update shows only on the repository's
 * Dependabot tab, and no pull request looks just like "nothing to update".
 *
 *     GH_TOKEN=… GITHUB_REPOSITORY=owner/name [PLANT_FAILURE=true] \
 *       node scripts/dependabot-check.ts
 *
 * Every ecosystem comes from .github/dependabot.yml, never a list kept here
 * (AC1). Each must have a Dependabot run newer than its interval plus two
 * days, and every run of it in the last interval must have ended `success`
 * or `skipped` (AC2). A weekly scan with nothing to update still leaves a run
 * of its own (AC0, measured 2026-11-10 on #458), so no run ever recorded is a
 * failure. Problems go on one issue for Shyden (scripts/issue-report.ts) and
 * the run goes red. PLANT_FAILURE adds a failed run of the first ecosystem:
 * the planted failure that proves the check speaks (AC3).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { report } from './issue-report.ts';

export interface Ecosystem {
  /** The config's name, e.g. `github-actions`. */
  readonly ecosystem: string;
  readonly directory: string;
  readonly interval: string;
}

export interface DependabotRun {
  /** Dependabot's own ecosystem name, from the run's title. */
  readonly label: string;
  readonly directory: string;
  readonly title: string;
  readonly url: string;
  /** null while the run is still going. */
  readonly conclusion: string | null;
  readonly createdAt: string;
}

/** The issue every Dependabot outage is reported on. */
export const ISSUE_TITLE = 'Dependabot has stopped updating';

/**
 * Each config ecosystem's name in Dependabot's run titles (AC0, measured
 * 2026-11-10). An ecosystem missing here fails the check, naming this table.
 */
export const RUN_LABELS: Readonly<Record<string, string>> = {
  npm: 'npm_and_yarn',
  'github-actions': 'github_actions',
  docker: 'docker',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS: Readonly<Record<string, number>> = {
  daily: 1,
  weekly: 7,
  monthly: 31,
};
/** A run may be this late before the ecosystem counts as stopped. */
const GRACE_DAYS = 2;
const PASSING = new Set(['success', 'skipped']);
const UPDATES_PATH = 'dynamic/dependabot/dependabot-updates';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every update in the config, in its order (AC1). */
export function ecosystemsOf(config: string): Ecosystem[] {
  let parsed: unknown;
  try {
    parsed = parse(config);
  } catch (error) {
    throw new Error(
      `.github/dependabot.yml cannot be parsed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.updates))
    throw new Error('.github/dependabot.yml cannot be parsed: no updates list');
  return parsed.updates.map((update: unknown, index) => {
    const schedule = isRecord(update) ? update.schedule : undefined;
    if (
      !isRecord(update) ||
      typeof update['package-ecosystem'] !== 'string' ||
      typeof update.directory !== 'string' ||
      !isRecord(schedule) ||
      typeof schedule.interval !== 'string'
    )
      throw new Error(
        `.github/dependabot.yml: update ${String(index + 1)} has no package-ecosystem, directory or schedule.interval`,
      );
    return {
      ecosystem: update['package-ecosystem'],
      directory: update.directory,
      interval: schedule.interval,
    };
  });
}

/** `/.` and `/` name the same directory; a scan's title uses the first. */
const normalised = (directory: string): string =>
  directory === '/.' ? '/' : directory.replace(/\/\.$/, '');

/** A Dependabot update run read from the Actions API, or undefined for any other run. */
export function runOf(run: Record<string, unknown>): DependabotRun | undefined {
  if (run.path !== UPDATES_PATH || typeof run.name !== 'string')
    return undefined;
  const match = /^(\S+) in (\S+?)(?: for .*)? - Update #\d+$/.exec(run.name);
  if (match === null) return undefined;
  return {
    label: match[1] ?? '',
    directory: normalised(match[2] ?? ''),
    title: run.name,
    url: String(run.html_url),
    conclusion: typeof run.conclusion === 'string' ? run.conclusion : null,
    createdAt: String(run.created_at),
  };
}

/** One line per problem; none when Dependabot is updating every ecosystem (AC2). */
export function judgeDependabot(
  ecosystems: readonly Ecosystem[],
  runs: readonly DependabotRun[],
  now: Date,
): string[] {
  return ecosystems.flatMap((each) => {
    const name = `${each.ecosystem} in ${each.directory}`;
    const label = RUN_LABELS[each.ecosystem];
    if (label === undefined)
      return [
        `${name}: no known Dependabot run name for this ecosystem; add it to RUN_LABELS in scripts/dependabot-check.ts`,
      ];
    const days = INTERVAL_DAYS[each.interval];
    if (days === undefined)
      return [
        `${name}: interval ${each.interval} is not daily, weekly or monthly`,
      ];
    const mine = runs.filter(
      (run) => run.label === label && run.directory === each.directory,
    );
    if (mine.length === 0) return [`${name} has no Dependabot run recorded`];
    const newest = mine
      .map((run) => run.createdAt)
      .reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
    const problems: string[] = [];
    if (now.getTime() - Date.parse(newest) > (days + GRACE_DAYS) * DAY_MS)
      problems.push(
        `${name} has not run since ${newest}, past its ${each.interval} interval plus two days`,
      );
    const since = now.getTime() - days * DAY_MS;
    for (const run of mine)
      if (
        Date.parse(run.createdAt) >= since &&
        run.conclusion !== null &&
        !PASSING.has(run.conclusion)
      )
        problems.push(
          `${name}: "${run.title}" ended ${run.conclusion}: ${run.url}`,
        );
    return problems;
  });
}

const gh = (args: readonly string[]): string =>
  execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '')
    throw new Error(`${name} is not set`);
  return value;
}

if (import.meta.main) {
  const repo = required('GITHUB_REPOSITORY');
  const now = new Date();
  let problems: string[];
  try {
    const ecosystems = ecosystemsOf(
      readFileSync('.github/dependabot.yml', 'utf8'),
    );
    // The longest window any ecosystem needs: its interval plus two days.
    const days = Math.max(
      ...ecosystems.map((each) => INTERVAL_DAYS[each.interval] ?? 0),
    );
    const since = new Date(now.getTime() - (days + GRACE_DAYS) * DAY_MS)
      .toISOString()
      .slice(0, 10);
    const pages: unknown = JSON.parse(
      gh([
        'api',
        '--paginate',
        '--slurp',
        `repos/${repo}/actions/runs?event=dynamic&per_page=100&created=>=${since}`,
      ]),
    );
    const runs = (Array.isArray(pages) ? pages : [])
      .flatMap((page: unknown): unknown[] =>
        isRecord(page) && Array.isArray(page.workflow_runs)
          ? (page.workflow_runs as unknown[])
          : [],
      )
      .flatMap((run: unknown) => {
        const read = isRecord(run) ? runOf(run) : undefined;
        return read === undefined ? [] : [read];
      });
    const first = ecosystems[0];
    if (process.env['PLANT_FAILURE'] === 'true' && first !== undefined)
      runs.push({
        label: RUN_LABELS[first.ecosystem] ?? first.ecosystem,
        directory: first.directory,
        title: 'planted failure (#458 AC3)',
        url: 'https://github.com/shyden-labs/yawelo-idle/issues/458',
        conclusion: 'failure',
        createdAt: now.toISOString(),
      });
    problems = judgeDependabot(ecosystems, runs, now);
  } catch (error) {
    problems = [
      `the check could not read Dependabot's runs: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  if (problems.length === 0) {
    console.log('✓ Dependabot ran every ecosystem within its interval');
  } else {
    for (const problem of problems) console.error(`✗ ${problem}`);
    for (const line of report(repo, gh, {
      title: ISSUE_TITLE,
      lead: 'The daily Dependabot check (dependabot-daily.yml, #458) found:',
      problems,
      footer:
        "Open the repository's Dependabot tab or the run named above, fix " +
        'the cause, and add this issue to the board. Until then no ' +
        'dependency update, security fixes included, reaches a pull request.',
    }))
      console.error(line);
    process.exit(1);
  }
}
