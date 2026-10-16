/**
 * Verifies a production deploy of the holding page from the outside (#621
 * AC5), against what this commit builds:
 *
 * 1. `/` and `/id/` answer 200 HTML that is byte-for-byte the page this
 *    commit builds (its commit stamp included), with exactly the headers
 *    `_headers` sets, no cookie and no noindex.
 * 2. An unknown path answers the 404 page this commit builds, in its
 *    language, with the headers.
 * 3. `robots.txt` is the one this commit builds.
 * 4. The promo video and its poster answer 200 of their type, at the size
 *    this commit builds, embeddable by the same site only, and each video
 *    answers a byte range with 206, as iPhones need.
 *
 *     npm run build:holding --workspace @yawelo-idle/site   # stamped with EXPECTED_SHA
 *     PROD_URL=https://yawelo-idle.shyden.co.uk EXPECTED_SHA=… node scripts/verify-prod.ts
 *
 * It reads the build, not the site's source, so it runs under Node's own
 * loader. A new Custom Domain needs time for its DNS record and certificate,
 * so it first waits, at most `polls` looks `pollMs` apart, for `/` to report
 * the expected commit (a stated ceiling; then the last answer is named). It
 * then judges every check once and never retries one (operator rule,
 * 2026-10-02).
 */
import { readFileSync, statSync } from 'node:fs';
import { headerRules, ruleFor } from './headers-file.ts';
import {
  judge,
  probe,
  type Check,
  type Judgement,
  type Probe,
  type Wait,
} from './verify-dev.ts';

const COMMIT_STAMP = /<meta name="yawelo-idle-commit" content="([^"]*)"/;

/** The commit a page reports, or undefined when it carries no stamp. */
export function reportedCommit(body: string): string | undefined {
  return COMMIT_STAMP.exec(body)?.[1];
}

/** One check per header `_headers` sets on every path. */
function headerChecks(
  path: string,
  answer: Probe,
  rules: ReadonlyMap<string, string>,
): Check[] {
  return [...rules].map(([name, expected]) => ({
    name: `${path} ${name}`,
    problem: () => {
      const served = answer.headers.get(name);
      if (served === null)
        return `${path}: ${name} is missing, expected "${expected}"`;
      return served === expected
        ? undefined
        : `${path}: ${name} is "${served}", expected "${expected}"`;
    },
  }));
}

/** A status check that stops the rest when it fails. */
const statusCheck = (path: string, answer: Probe, expected: number): Check => ({
  name: `${path} status`,
  gate: true,
  problem: () =>
    answer.status === expected
      ? undefined
      : `${path}: status ${String(answer.status)}, expected ${String(expected)}`,
});

/** The body is the built file, byte for byte. */
const bodyCheck = (path: string, answer: Probe, built: string): Check => ({
  name: `${path} body`,
  problem: () =>
    answer.body === built
      ? undefined
      : `${path}: is not the page this commit builds (${String(answer.body.length)} characters served, ${String(built.length)} built)`,
});

/**
 * A home page: 200 HTML of this commit, exactly as built, the headers, no
 * cookie, and, unless it is the noindex dev copy (#621 AC8), no noindex.
 */
export function pageJudgement(
  path: string,
  answer: Probe,
  built: string,
  sha: string,
  rules: ReadonlyMap<string, string>,
  indexable = true,
): Judgement {
  const type = answer.headers.get('content-type') ?? '';
  const commit = reportedCommit(answer.body);
  return judge([
    statusCheck(path, answer, 200),
    {
      name: `${path} content-type`,
      problem: () =>
        type.startsWith('text/html')
          ? undefined
          : `${path}: content-type ${type}, expected text/html`,
    },
    {
      name: `${path} commit`,
      problem: () =>
        commit === sha
          ? undefined
          : `${path}: serves commit ${commit ?? 'none'}, expected ${sha}`,
    },
    bodyCheck(path, answer, built),
    ...headerChecks(path, answer, rules),
    {
      name: `${path} cookie`,
      problem: () =>
        answer.headers.get('set-cookie') === null
          ? undefined
          : `${path}: sets a cookie`,
    },
    ...(indexable
      ? [
          {
            name: `${path} indexing`,
            problem: () =>
              /noindex/i.test(answer.headers.get('x-robots-tag') ?? '')
                ? `${path}: X-Robots-Tag noindex`
                : undefined,
          },
        ]
      : []),
  ]);
}

export const pageProblems = (
  ...args: Parameters<typeof pageJudgement>
): readonly string[] => pageJudgement(...args).problems;

/** An unknown path: the 404 page this commit builds, with the headers. */
export function notFoundJudgement(
  path: string,
  answer: Probe,
  built: string,
  rules: ReadonlyMap<string, string>,
): Judgement {
  return judge([
    statusCheck(path, answer, 404),
    bodyCheck(path, answer, built),
    ...headerChecks(path, answer, rules),
  ]);
}

export const notFoundProblems = (
  ...args: Parameters<typeof notFoundJudgement>
): readonly string[] => notFoundJudgement(...args).problems;

/** A video or poster file: 200 of its type and built size, embeddable by the same site only. */
export function mediaJudgement(
  path: string,
  answer: Probe,
  type: string,
  bytes: number,
): Judgement {
  const served = answer.headers.get('content-type') ?? '';
  const length = answer.headers.get('content-length');
  const corp = answer.headers.get('cross-origin-resource-policy');
  return judge([
    statusCheck(path, answer, 200),
    {
      name: `${path} content-type`,
      problem: () =>
        served.startsWith(type)
          ? undefined
          : `${path}: content-type ${served}, expected ${type}`,
    },
    {
      name: `${path} size`,
      problem: () =>
        length === String(bytes)
          ? undefined
          : `${path}: Content-Length ${length ?? 'missing'}, expected ${String(bytes)}`,
    },
    {
      name: `${path} embedding`,
      problem: () =>
        corp === 'same-site'
          ? undefined
          : `${path}: Cross-Origin-Resource-Policy is ${corp ?? 'missing'}, expected same-site`,
    },
  ]);
}

export const mediaProblems = (
  ...args: Parameters<typeof mediaJudgement>
): readonly string[] => mediaJudgement(...args).problems;

/**
 * A video asked for its first two bytes: 206, exactly those bytes, and the
 * embed rule. Safari on iPhone plays video only from a server that answers in
 * ranges (#621; Apple: "HTTP servers hosting media files for iOS must support
 * byte-range requests").
 */
export function rangeJudgement(
  path: string,
  answer: Probe,
  bytes: number,
): Judgement {
  const range = answer.headers.get('content-range') ?? '';
  const length = answer.headers.get('content-length');
  const corp = answer.headers.get('cross-origin-resource-policy');
  const expected = `bytes 0-1/${String(bytes)}`;
  return judge([
    {
      name: `${path} range status`,
      gate: true,
      problem: () =>
        answer.status === 206
          ? undefined
          : `${path}: a range request got status ${String(answer.status)}, expected 206`,
    },
    {
      name: `${path} content-range`,
      problem: () =>
        range === expected
          ? undefined
          : `${path}: Content-Range ${range}, expected ${expected}`,
    },
    {
      name: `${path} range length`,
      problem: () =>
        length === '2'
          ? undefined
          : `${path}: a 2-byte range came back with Content-Length ${length ?? 'missing'}`,
    },
    {
      name: `${path} range embedding`,
      problem: () =>
        corp === 'same-site'
          ? undefined
          : `${path}: Cross-Origin-Resource-Policy is ${corp ?? 'missing'} on a range, expected same-site`,
    },
  ]);
}

export const rangeProblems = (
  ...args: Parameters<typeof rangeJudgement>
): readonly string[] => rangeJudgement(...args).problems;

export function robotsJudgement(answer: Probe, built: string): Judgement {
  return judge([
    statusCheck('/robots.txt', answer, 200),
    bodyCheck('/robots.txt', answer, built),
  ]);
}

export const robotsProblems = (
  ...args: Parameters<typeof robotsJudgement>
): readonly string[] => robotsJudgement(...args).problems;

/** Each home page and the built file it must equal. */
const HOMES: readonly [string, string][] = [
  ['/', 'index.html'],
  ['/id/', 'id/index.html'],
];
/** An unknown path in each language and the built 404 it must equal. */
const MISSING: readonly [string, string][] = [
  ['/no-such-page', '404.html'],
  ['/id/no-such-page', 'id/404.html'],
];
const MEDIA: readonly [string, string][] = [
  ['/media/yawelo-idle-promo.webm', 'video/webm'],
  ['/media/yawelo-idle-promo.mp4', 'video/mp4'],
  ['/media/yawelo-idle-promo-poster.jpg', 'image/jpeg'],
];

/** Waits for `/` to report `sha`; the last answer (or failure) when it never does. */
async function waitForCommit(
  origin: string,
  sha: string,
  wait: Wait,
): Promise<string | undefined> {
  let last = 'no answer yet';
  for (let look = 1; look <= wait.polls; look += 1) {
    try {
      const answer = await probe(`${origin}/`);
      const commit = reportedCommit(answer.body);
      if (answer.status === 200 && commit === sha) return undefined;
      last = `status ${String(answer.status)}, commit ${commit ?? 'none'}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (look < wait.polls)
      await new Promise((done) => setTimeout(done, wait.pollMs));
  }
  return `/: never served commit ${sha} in ${String(wait.polls)} looks ${String(wait.pollMs)} ms apart; last: ${last}`;
}

/** Every problem production shows against the build in `dist`, after waiting for the commit. */
export async function verifyProd(
  origin: string,
  sha: string,
  dist: URL,
  wait: Wait,
  indexable = true,
): Promise<string[]> {
  const built = (file: string): string =>
    readFileSync(new URL(file, dist), 'utf8');
  const rules = ruleFor(headerRules(built('_headers')), '/*');
  const waited = await waitForCommit(origin, sha, wait);
  if (waited !== undefined) return [waited];
  const problems: string[] = [];
  const look = async (path: string): Promise<Probe | string> => {
    try {
      return await probe(`${origin}${path}`);
    } catch (error) {
      return `${path}: request failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  for (const [path, file] of HOMES) {
    const answer = await look(path);
    problems.push(
      ...(typeof answer === 'string'
        ? [answer]
        : pageProblems(path, answer, built(file), sha, rules, indexable)),
    );
  }
  for (const [path, file] of MISSING) {
    const answer = await look(path);
    problems.push(
      ...(typeof answer === 'string'
        ? [answer]
        : notFoundProblems(path, answer, built(file), rules)),
    );
  }
  const robots = await look('/robots.txt');
  problems.push(
    ...(typeof robots === 'string'
      ? [robots]
      : robotsProblems(robots, built('robots.txt'))),
  );
  for (const [path] of MEDIA.filter(([, type]) => type.startsWith('video/'))) {
    const bytes = statSync(new URL(path.slice(1), dist)).size;
    let answer: Probe | string;
    try {
      answer = await probe(`${origin}${path}`, { Range: 'bytes=0-1' });
    } catch (error) {
      answer = `${path}: range request failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    problems.push(
      ...(typeof answer === 'string'
        ? [answer]
        : rangeProblems(path, answer, bytes)),
    );
  }
  for (const [path, type] of MEDIA) {
    // GET, not HEAD: Cloudflare's static assets send no Content-Length on a
    // HEAD (measured on the dev copy, deploy-dev run 38893672548).
    const answer = await look(path);
    const bytes = statSync(new URL(path.slice(1), dist)).size;
    problems.push(
      ...(typeof answer === 'string'
        ? [answer]
        : mediaProblems(path, answer, type, bytes)),
    );
  }
  return problems;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '')
    throw new Error(`${name} is not set`);
  return value;
}

if (import.meta.main) {
  // `--dev-copy` checks the holding page's noindex dev copy (#621 AC8) against
  // dist-holding-dev, made by scripts/holding-dev.ts; otherwise production.
  const dev = process.argv.includes('--dev-copy');
  // A new Custom Domain's DNS and certificate: up to 10 minutes (60 looks, 10 s apart).
  const problems = await verifyProd(
    required(dev ? 'DEV_HOLDING_URL' : 'PROD_URL'),
    required('EXPECTED_SHA'),
    new URL(
      dev ? '../apps/site/dist-holding-dev/' : '../apps/site/dist-holding/',
      import.meta.url,
    ),
    { polls: 60, pollMs: 10_000 },
    !dev,
  );
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    process.exit(1);
  }
  console.log(
    '✓ production serves exactly what this commit builds, in English and Indonesian, with its headers, 404 pages, robots file and promo video',
  );
}
