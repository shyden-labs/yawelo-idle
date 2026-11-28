/**
 * Verifies the reserved production API address from the outside (#1013 AC1):
 * api.yaweloidle.com serves this release's `commit.txt`, answers every other
 * path with the reserve's 404 page, keeps crawlers out with its robots file,
 * and marks every answer noindex.
 *
 *     API_URL=https://api.yaweloidle.com EXPECTED_SHA=… node scripts/verify-api.ts
 *
 * A new Custom Domain needs time for its DNS record and certificate, so it
 * first waits, at most `polls` looks `pollMs` apart, for `commit.txt` to name
 * the expected commit (a stated ceiling; then the last answer is named). It
 * then judges every check once and never retries one (operator rule,
 * 2026-10-02).
 */
import { readFileSync } from 'node:fs';
import { probe, type Probe, type Wait } from './verify-dev.ts';

/** The paths the verify looks at, in order. */
export const API_PATHS = ['/commit.txt', '/', '/robots.txt'] as const;
export type ApiPath = (typeof API_PATHS)[number];

const NOINDEX = 'noindex, nofollow, noarchive';

function noindexProblem(path: string, answer: Probe): string | undefined {
  const served = answer.headers.get('x-robots-tag');
  if (served === NOINDEX) return undefined;
  return `${path}: x-robots-tag is ${served === null ? 'missing' : served}, expected ${NOINDEX}`;
}

const served = (body: string): string => body.trim();

/** Every problem the answers show against this commit and the reserve's 404 page. */
export function apiProblems(
  answers: Readonly<Record<ApiPath, Probe>>,
  sha: string,
  notFoundPage: string,
): string[] {
  const problems: string[] = [];
  const commit = answers['/commit.txt'];
  if (commit.status !== 200)
    problems.push(`/commit.txt: status ${String(commit.status)}, expected 200`);
  else if (served(commit.body) !== sha)
    problems.push(
      `/commit.txt: serves ${served(commit.body)}, expected ${sha}`,
    );
  const home = answers['/'];
  if (home.status !== 404)
    problems.push(`/: status ${String(home.status)}, expected 404`);
  if (home.body !== notFoundPage)
    problems.push('/: body is not the reserve 404 page');
  const robots = answers['/robots.txt'];
  if (robots.status !== 200 || !/^Disallow: \/$/m.test(robots.body))
    problems.push('/robots.txt: does not disallow every path');
  for (const path of API_PATHS) {
    const problem = noindexProblem(path, answers[path]);
    if (problem !== undefined) problems.push(problem);
  }
  return problems;
}

/** Fetches one URL; the network in a run, a stand-in in the tests. */
export type Look = (url: string) => Promise<Probe>;

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Waits for `commit.txt` to name `sha`; the last answer (or failure) when it never does. */
async function waitForCommit(
  origin: string,
  sha: string,
  wait: Wait,
  look: Look,
): Promise<string | undefined> {
  const never = (last: string): string =>
    `/commit.txt: never served commit ${sha} in ${String(wait.polls)} looks ${String(wait.pollMs)} ms apart; last: ${last}`;
  const poll = async (attempt: number): Promise<string | undefined> => {
    let last: string;
    try {
      const answer = await look(`${origin}/commit.txt`);
      if (answer.status === 200 && served(answer.body) === sha)
        return undefined;
      last = `status ${String(answer.status)}, body ${served(answer.body).slice(0, 80)}`;
    } catch (error) {
      last = message(error);
    }
    if (attempt >= wait.polls) return never(last);
    await new Promise((done) => setTimeout(done, wait.pollMs));
    return poll(attempt + 1);
  };
  return wait.polls < 1 ? never('no answer yet') : poll(1);
}

/** Every problem the reserve at `origin` shows, after waiting for `sha`. */
export async function verifyApi(
  origin: string,
  sha: string,
  wait: Wait,
  look: Look,
  notFoundPage: string,
): Promise<string[]> {
  const waited = await waitForCommit(origin, sha, wait, look);
  if (waited !== undefined) return [waited];
  const answers: Partial<Record<ApiPath, Probe>> = {};
  const failures: string[] = [];
  const settled = await Promise.allSettled(
    API_PATHS.map((path) => look(`${origin}${path}`)),
  );
  settled.forEach((outcome, index) => {
    const path = API_PATHS[index] as ApiPath;
    if (outcome.status === 'fulfilled') answers[path] = outcome.value;
    else failures.push(`${path}: request failed: ${message(outcome.reason)}`);
  });
  if (failures.length > 0) return failures;
  return apiProblems(answers as Record<ApiPath, Probe>, sha, notFoundPage);
}

/** What a run prints, and its exit code. */
export function apiVerdict(
  origin: string,
  sha: string,
  problems: readonly string[],
): { code: number; lines: string[] } {
  if (problems.length > 0)
    return {
      code: 1,
      lines: problems.map((problem) => `✗ API reserve: ${problem}`),
    };
  return {
    code: 0,
    lines: [
      `✓ API reserve: ${origin} serves commit ${sha}, the 404 page on every other path, a robots file keeping crawlers out, and noindex on every answer`,
    ],
  };
}

function required(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = env[name];
  if (value === undefined || value === '')
    throw new Error(`${name} is not set`);
  return value;
}

/** Where a run's lines go. */
export interface Output {
  log: (line: string) => void;
  error: (line: string) => void;
}

/** One verify run, from API_URL and EXPECTED_SHA; returns the exit code. */
export async function runApiVerify(
  env: Readonly<Record<string, string | undefined>>,
  look: Look,
  out: Output,
): Promise<number> {
  const origin = required(env, 'API_URL');
  const sha = required(env, 'EXPECTED_SHA');
  // A new Custom Domain's DNS and certificate: up to 10 minutes (60 looks, 10 s apart).
  const problems = await verifyApi(
    origin,
    sha,
    { polls: 60, pollMs: 10_000 },
    look,
    readFileSync(
      new URL('../apps/sync-worker/reserve/public/404.html', import.meta.url),
      'utf8',
    ),
  );
  const { code, lines } = apiVerdict(origin, sha, problems);
  for (const line of lines)
    if (code === 0) out.log(line);
    else out.error(line);
  return code;
}

if (import.meta.main)
  process.exitCode = await runApiVerify(process.env, probe, console);
