/**
 * Judges `npm audit --json` for CI (#720): every advisory fails the build
 * unless it is recorded below with a reason and an expiry date (#873).
 *
 * Usage: `node scripts/npm-audit.ts` (runs `npm audit --json` itself).
 * With `--daily` (the daily audit of develop, #720 AC3) each problem is also
 * reported to Shyden, one issue per problem.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import type { Gh } from './board-progress.ts';
import { report } from './issue-report.ts';

export interface AuditException {
  /** The advisory's GHSA id, as the last segment of its advisory URL. */
  readonly id: string;
  readonly reason: string;
  /** Last day the exception holds, as YYYY-MM-DD. */
  readonly expires: string;
}

export const EXCEPTIONS: readonly AuditException[] = [
  {
    id: 'GHSA-gcqx-w48m-w2h4',
    reason:
      'deepmerge 4.3.1 is the newest release and has no fix; it reaches the ' +
      'build only, through @sveltejs/vite-plugin-svelte, and never ships to ' +
      'players (Shyden, 2026-11-05, #873 route (c)).',
    expires: '2027-01-04',
  },
];

interface Advisory {
  readonly severity: string;
  readonly packages: Set<string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function advisoriesIn(report: unknown): Map<string, Advisory> {
  if (!isRecord(report) || !isRecord(report.vulnerabilities))
    throw new Error('not an npm audit --json report');
  const found = new Map<string, Advisory>();
  for (const entry of Object.values(report.vulnerabilities)) {
    if (!isRecord(entry) || !Array.isArray(entry.via)) continue;
    for (const via of entry.via) {
      if (!isRecord(via) || typeof via.url !== 'string') continue;
      const id = via.url.split('/').at(-1) ?? via.url;
      const advisory = found.get(id) ?? {
        severity: String(via.severity),
        packages: new Set<string>(),
      };
      advisory.packages.add(String(via.name));
      found.set(id, advisory);
    }
  }
  return found;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Every problem with the report, empty when CI may pass. `today` is YYYY-MM-DD. */
export function judgeAudit(
  report: unknown,
  exceptions: readonly AuditException[],
  today: string,
): string[] {
  const advisories = advisoriesIn(report);
  const problems: string[] = [];
  for (const [id, advisory] of advisories) {
    if (exceptions.some((entry) => entry.id === id)) continue;
    const packages = [...advisory.packages].sort().join(', ');
    problems.push(
      `${id} (${advisory.severity}, ${packages}) has no recorded exception`,
    );
  }
  for (const entry of exceptions) {
    if (entry.reason.trim() === '')
      problems.push(`the exception for ${entry.id} gives no reason`);
    else if (!DATE.test(entry.expires))
      problems.push(`the exception for ${entry.id} has no YYYY-MM-DD expiry`);
    else if (today > entry.expires)
      problems.push(
        `the exception for ${entry.id} expired on ${entry.expires}: look again`,
      );
    else if (!advisories.has(entry.id))
      problems.push(
        `the exception for ${entry.id} matches no finding: remove it`,
      );
  }
  return problems;
}

/** The issue title the daily audit gives `problem`, unique to it. */
export const auditIssueTitle = (problem: string): string =>
  `npm audit on develop: ${problem}`;

/**
 * Reports each problem on its own issue for Shyden (#720 AC3): a new one
 * opens an issue, one already open is commented on. Says what it did.
 */
export function reportDaily(
  problems: readonly string[],
  repo: string,
  gh: Gh,
): string[] {
  return problems.flatMap((problem) =>
    report(repo, gh, {
      title: auditIssueTitle(problem),
      lead: 'The daily audit of develop (npm-audit-daily.yml, #720) found:',
      problems: [problem],
      footer:
        'Upgrade the package, or record an exception with its reason and an ' +
        'expiry in scripts/npm-audit.ts; any vulnerability is P0. Add this ' +
        'issue to the board.',
    }),
  );
}

if (import.meta.main) {
  const run = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' });
  const problems = judgeAudit(
    JSON.parse(run.stdout),
    EXCEPTIONS,
    new Date().toISOString().slice(0, 10),
  );
  for (const problem of problems) console.error(`npm-audit: ${problem}`);
  if (process.argv.includes('--daily')) {
    const repo = process.env.GITHUB_REPOSITORY ?? '';
    const gh: Gh = (args) => execFileSync('gh', args, { encoding: 'utf8' });
    for (const line of reportDaily(problems, repo, gh))
      console.error(`npm-audit: ${line}`);
  }
  if (problems.length > 0) process.exit(1);
  console.log('npm-audit: no advisory without a current exception');
}
