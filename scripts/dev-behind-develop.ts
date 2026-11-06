/**
 * Dev never falls behind develop silently (#497, global rule "nothing we rely
 * on stops silently").
 *
 * On 2026-10-08 GitHub started no workflow for a push to develop, so dev
 * kept serving an older commit and nothing noticed. This check, run daily by
 * `.github/workflows/dev-behind-develop.yml`, compares develop's head with
 * the commit dev's sync API reports at `/health` (the field
 * `scripts/verify-dev.ts` judges; `/health` needs no password, so the check
 * holds no secret). When dev serves another commit and the head is more than
 * 30 minutes old, or dev cannot be read at all, it opens an issue assigned
 * to ShydenMcM, or comments on the open one, naming both commits and the
 * newest deploy-dev run. Recovery is dispatching deploy-dev on develop.
 */

export const ISSUE_TITLE = 'Dev is behind develop';
const OWNER = 'ShydenMcM';
/** A deploy-dev run takes about 10 minutes; past 30 the head should be served. */
const GRACE_MINUTES = 30;

export interface Head {
  readonly sha: string;
  /** The head commit's committer date, ISO 8601. */
  readonly committedAt: string;
}

export type Served = string | { readonly error: string };

export type Verdict =
  | { readonly kind: 'current' }
  | { readonly kind: 'deploying' }
  | { readonly kind: 'behind'; readonly reason: string };

export function judgeDev(head: Head, served: Served, now: Date): Verdict {
  if (typeof served !== 'string')
    return {
      kind: 'behind',
      reason: `dev's served commit could not be read (${served.error}); develop's head is ${head.sha}`,
    };
  if (served === head.sha) return { kind: 'current' };
  const committed = Date.parse(head.committedAt);
  if (Number.isNaN(committed))
    throw new Error(`develop head date "${head.committedAt}" is not a date`);
  const minutes = Math.floor((now.getTime() - committed) / 60_000);
  if (minutes <= GRACE_MINUTES) return { kind: 'deploying' };
  return {
    kind: 'behind',
    reason: `dev serves ${served}, develop's head is ${head.sha} (committed ${head.committedAt}, ${String(minutes)} minutes ago)`,
  };
}

/** The GitHub REST API, by method and path under https://api.github.com. */
export interface GitHub {
  request(method: string, path: string, body?: unknown): Promise<unknown>;
}

export interface CheckDeps {
  readonly github: GitHub;
  /** `owner/name`. */
  readonly repo: string;
  readonly now: Date;
  /** The commit dev reports; rejects when dev cannot be read. */
  readonly readServed: () => Promise<string>;
}

/** Runs the check once and says what it found and did. */
export async function checkDev(deps: CheckDeps): Promise<string> {
  const { github, repo } = deps;
  const head = await readHead(github, repo);
  const served: Served = await deps.readServed().then(
    (sha) => sha,
    (error: unknown) => ({
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  const verdict = judgeDev(head, served, deps.now);
  if (verdict.kind === 'current')
    return `✓ dev serves develop's head ${head.sha}`;
  if (verdict.kind === 'deploying')
    return `… dev serves another commit, but develop's head ${head.sha} is ${String(GRACE_MINUTES)} minutes old or younger: a deploy may be running`;
  const body = `${verdict.reason}.\n\nNewest deploy-dev run on develop: ${await newestDeploy(github, repo)}\n\nTo recover, dispatch deploy-dev on develop: \`gh workflow run deploy-dev.yml --ref develop\`. Opened by the daily dev-behind-develop check (#497); add it to the board.`;
  const open = await openIssue(github, repo);
  if (open !== undefined) {
    await github.request(
      'POST',
      `/repos/${repo}/issues/${String(open)}/comments`,
      {
        body,
      },
    );
    return `✗ ${verdict.reason}: commented on #${String(open)}`;
  }
  const created = record(
    await github.request('POST', `/repos/${repo}/issues`, {
      title: ISSUE_TITLE,
      body,
      assignees: [OWNER],
    }),
  );
  return `✗ ${verdict.reason}: opened #${String(created.number)}`;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`GitHub answered ${JSON.stringify(value)}, not an object`);
  return value as Record<string, unknown>;
}

async function readHead(github: GitHub, repo: string): Promise<Head> {
  const answer = record(
    await github.request('GET', `/repos/${repo}/commits/develop`),
  );
  const committer = record(record(answer.commit).committer);
  if (typeof answer.sha !== 'string' || typeof committer.date !== 'string')
    throw new Error(`develop's head has no sha or committer date`);
  return { sha: answer.sha, committedAt: committer.date };
}

async function newestDeploy(github: GitHub, repo: string): Promise<string> {
  const answer = record(
    await github.request(
      'GET',
      `/repos/${repo}/actions/workflows/deploy-dev.yml/runs?branch=develop&per_page=1`,
    ),
  );
  const runs = answer.workflow_runs;
  if (!Array.isArray(runs) || runs.length === 0) return 'none found.';
  const run = record(runs[0]);
  return `${String(run.html_url)} (commit ${String(run.head_sha)}, ${String(run.conclusion ?? run.status)}).`;
}

/** The open issue (never a pull request) carrying ISSUE_TITLE, read page by page. */
async function openIssue(
  github: GitHub,
  repo: string,
): Promise<number | undefined> {
  for (let page = 1; ; page++) {
    const issues = await github.request(
      'GET',
      `/repos/${repo}/issues?state=open&per_page=100&page=${String(page)}`,
    );
    if (!Array.isArray(issues)) throw new Error('GitHub listed no issue array');
    const found = issues
      .map(record)
      .find((i) => i.title === ISSUE_TITLE && i.pull_request === undefined);
    if (found !== undefined) return Number(found.number);
    if (issues.length < 100) return undefined;
  }
}

/** The GitHub REST API through fetch, with the run's own token. */
function restGitHub(token: string): GitHub {
  return {
    async request(method, path, body) {
      const response = await fetch(`https://api.github.com${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok)
        throw new Error(
          `GitHub ${method} ${path}: status ${String(response.status)}`,
        );
      return response.json();
    },
  };
}

/** The commit dev's sync API reports at /health. */
async function readServed(syncUrl: string): Promise<string> {
  const response = await fetch(new URL('/health', syncUrl));
  if (!response.ok)
    throw new Error(`sync /health status ${String(response.status)}`);
  const body = record(await response.json());
  if (typeof body.commit !== 'string')
    throw new Error(`sync /health has no commit: ${JSON.stringify(body)}`);
  return body.commit;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '')
    throw new Error(`${name} is not set`);
  return value;
}

if (import.meta.main) {
  const syncUrl = required('DEV_SYNC_URL');
  // The planted failure (#497 AC2): a dispatch may stand in an older served
  // commit, so the issue path is proven on GitHub itself.
  const standIn = process.env['STAND_IN_SERVED'] ?? '';
  const said = await checkDev({
    github: restGitHub(required('GITHUB_TOKEN')),
    repo: required('GITHUB_REPOSITORY'),
    now: new Date(),
    readServed: () =>
      standIn === '' ? readServed(syncUrl) : Promise.resolve(standIn),
  });
  console.log(said);
  // Behind is not a pass: the run goes red as well as opening the issue.
  if (said.startsWith('✗')) process.exit(1);
}
