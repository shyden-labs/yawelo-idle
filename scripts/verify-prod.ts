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
 * 4. Each promo file on its media host (#713) answers 200 of its type, byte
 *    for byte the copy in apps/site/media/, then 206 of exactly the bytes
 *    `bytes=0-1` asks for, then 416 for a range past its end, each with the
 *    headers the host must send.
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
import { readFileSync } from 'node:fs';
import {
  DEV_MEDIA,
  PROD_MEDIA,
  PROMO,
  type MediaHost,
} from '../apps/site/src/media.ts';
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
const statusCheck = (
  path: string,
  answer: { status: number },
  expected: number,
): Check => ({
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

/** A media answer with its body as bytes, which decoding as text would mangle. */
export interface MediaProbe {
  status: number;
  headers: Headers;
  bytes: Uint8Array;
}

/** A tracked promo file: its name in apps/site/media/, its content type and its bytes. */
export interface MediaSource {
  file: string;
  type: string;
  bytes: Uint8Array;
}

/** The range every media file is asked for, as #629's Worker was. */
export const FIRST_TWO = 'bytes=0-1';

/** A range that starts at a file's end, which no byte satisfies. */
export const pastEnd = (size: number): string => `bytes=${String(size)}-`;

const sameBytes = (served: Uint8Array, tracked: Uint8Array): boolean =>
  served.length === tracked.length &&
  served.every((byte, at) => byte === tracked[at]);

const typeCheck = (label: string, answer: MediaProbe, type: string): Check => ({
  name: `${label} content-type`,
  problem: () => {
    const served = answer.headers.get('content-type') ?? '';
    return served.startsWith(type)
      ? undefined
      : `${label}: content-type ${served}, expected ${type}`;
  },
});

/** One check per header the media host must send, or must not (`null`). */
const hostHeaderChecks = (
  label: string,
  answer: MediaProbe,
  host: MediaHost,
): Check[] =>
  Object.entries(host.headers).map(([name, expected]) => ({
    name: `${label} ${name}`,
    problem: () => {
      const served = answer.headers.get(name);
      if (expected === null)
        return served === null
          ? undefined
          : `${label}: ${name} is ${served}, expected none`;
      return served === expected
        ? undefined
        : `${label}: ${name} is ${served ?? 'missing'}, expected ${expected}`;
    },
  }));

/** A promo file asked for whole: 200 of its type, byte for byte the tracked file, with the host's headers. */
export function mediaJudgement(
  url: string,
  answer: MediaProbe,
  source: MediaSource,
  host: MediaHost,
): Judgement {
  const length = answer.headers.get('content-length');
  const size = String(source.bytes.length);
  return judge([
    statusCheck(url, answer, 200),
    typeCheck(url, answer, source.type),
    {
      name: `${url} size`,
      problem: () =>
        length === size
          ? undefined
          : `${url}: Content-Length ${length ?? 'missing'}, expected ${size}`,
    },
    {
      name: `${url} bytes`,
      problem: () =>
        sameBytes(answer.bytes, source.bytes)
          ? undefined
          : `${url}: differs from apps/site/media/${source.file}; upload it (apps/site/media/README.md)`,
    },
    ...hostHeaderChecks(url, answer, host),
  ]);
}

export const mediaProblems = (
  ...args: Parameters<typeof mediaJudgement>
): readonly string[] => mediaJudgement(...args).problems;

/** A promo file asked for its first two bytes: 206 of exactly those, of its type, with the host's headers. */
export function rangeJudgement(
  url: string,
  answer: MediaProbe,
  source: MediaSource,
  host: MediaHost,
): Judgement {
  const label = `${url} ${FIRST_TWO}`;
  const range = answer.headers.get('content-range');
  const expected = `bytes 0-1/${String(source.bytes.length)}`;
  return judge([
    statusCheck(label, answer, 206),
    {
      name: `${label} content-range`,
      problem: () =>
        range === expected
          ? undefined
          : `${label}: Content-Range ${range ?? 'missing'}, expected ${expected}`,
    },
    {
      name: `${label} bytes`,
      problem: () =>
        sameBytes(answer.bytes, source.bytes.subarray(0, 2))
          ? undefined
          : `${label}: the ${String(answer.bytes.length)} bytes served are not the first 2 of apps/site/media/${source.file}`,
    },
    typeCheck(label, answer, source.type),
    ...hostHeaderChecks(label, answer, host),
  ]);
}

export const rangeProblems = (
  ...args: Parameters<typeof rangeJudgement>
): readonly string[] => rangeJudgement(...args).problems;

/**
 * A promo file asked for a range past its end: 416 with the host's headers,
 * naming its size where the host does and no Content-Range where it doesn't.
 */
export function pastEndJudgement(
  url: string,
  answer: MediaProbe,
  source: MediaSource,
  host: MediaHost,
): Judgement {
  const label = `${url} ${pastEnd(source.bytes.length)}`;
  const range = answer.headers.get('content-range');
  const expected = host.sizeOnPastEnd
    ? `bytes */${String(source.bytes.length)}`
    : null;
  return judge([
    statusCheck(label, answer, 416),
    {
      name: `${label} content-range`,
      problem: () =>
        range === expected
          ? undefined
          : `${label}: Content-Range ${range ?? 'missing'}, expected ${expected ?? 'none'}`,
    },
    ...hostHeaderChecks(label, answer, host),
  ]);
}

export const pastEndProblems = (
  ...args: Parameters<typeof pastEndJudgement>
): readonly string[] => pastEndJudgement(...args).problems;

/** Fetches `url` with `headers`, keeping the body as bytes. */
export async function mediaProbe(
  url: string,
  headers: Record<string, string> = {},
): Promise<MediaProbe> {
  const response = await fetch(url, { headers, redirect: 'manual' });
  return {
    status: response.status,
    headers: response.headers,
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
}

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
/** The tracked promo files, which every media host must serve byte for byte. */
const MEDIA_FOLDER = new URL('../apps/site/media/', import.meta.url);

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
  media: MediaHost = PROD_MEDIA,
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
  const ask = async (
    url: string,
    range?: string,
  ): Promise<MediaProbe | string> => {
    try {
      return await mediaProbe(url, range === undefined ? {} : { range });
    } catch (error) {
      return `${url}${range === undefined ? '' : ` ${range}`}: request failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  for (const { file, type } of PROMO) {
    const source: MediaSource = {
      file,
      type,
      bytes: new Uint8Array(readFileSync(new URL(file, MEDIA_FOLDER))),
    };
    const url = `${media.origin}/${file}`;
    const whole = await ask(url);
    problems.push(
      ...(typeof whole === 'string'
        ? [whole]
        : mediaProblems(url, whole, source, media)),
    );
    const range = await ask(url, FIRST_TWO);
    problems.push(
      ...(typeof range === 'string'
        ? [range]
        : rangeProblems(url, range, source, media)),
    );
    const past = await ask(url, pastEnd(source.bytes.length));
    problems.push(
      ...(typeof past === 'string'
        ? [past]
        : pastEndProblems(url, past, source, media)),
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
    dev ? DEV_MEDIA : PROD_MEDIA,
  );
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    process.exit(1);
  }
  console.log(
    '✓ production serves exactly what this commit builds, in English and Indonesian, with its headers, 404 pages, robots file and promo video',
  );
}
