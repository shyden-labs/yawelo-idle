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

/** Waits for `commit.txt` to name `sha`; the last answer (or failure) when it never does. */
async function waitForCommit(
  origin: string,
  sha: string,
  wait: Wait,
): Promise<string | undefined> {
  let last = 'no answer yet';
  for (let look = 1; look <= wait.polls; look += 1) {
    try {
      const answer = await probe(`${origin}/commit.txt`);
      if (answer.status === 200 && served(answer.body) === sha)
        return undefined;
      last = `status ${String(answer.status)}, body ${served(answer.body).slice(0, 80)}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (look < wait.polls)
      await new Promise((done) => setTimeout(done, wait.pollMs));
  }
  return `/commit.txt: never served commit ${sha} in ${String(wait.polls)} looks ${String(wait.pollMs)} ms apart; last: ${last}`;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '')
    throw new Error(`${name} is not set`);
  return value;
}

if (import.meta.main) {
  const origin = required('API_URL');
  const sha = required('EXPECTED_SHA');
  // A new Custom Domain's DNS and certificate: up to 10 minutes (60 looks, 10 s apart).
  const waited = await waitForCommit(origin, sha, {
    polls: 60,
    pollMs: 10_000,
  });
  const problems: string[] = [];
  if (waited === undefined) {
    const answers = {} as Record<ApiPath, Probe>;
    for (const path of API_PATHS)
      answers[path] = await probe(`${origin}${path}`);
    const page = readFileSync(
      new URL('../apps/sync-worker/reserve/public/404.html', import.meta.url),
      'utf8',
    );
    problems.push(...apiProblems(answers, sha, page));
  } else problems.push(waited);
  for (const problem of problems) console.error(`✗ API reserve: ${problem}`);
  if (problems.length === 0)
    console.log(
      `✓ API reserve: ${origin} serves commit ${sha}, the 404 page on every other path, a robots file keeping crawlers out, and noindex on every answer`,
    );
  process.exitCode = problems.length > 0 ? 1 : 0;
}
