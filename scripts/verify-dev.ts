/**
 * Verifies a dev deploy from the outside, the way a tester's browser sees it.
 *
 * `wrangler deploy` exiting 0 says an upload happened. It does not say the
 * live URL serves THIS commit, that D1 answers, or that the password gate
 * (#39) still keeps the public out. Each of those is checked here:
 *
 * 1. The web host answers 401 with a Basic challenge and none of the app,
 *    both without credentials and with a wrong password.
 * 2. Its robots.txt blocks every crawler, without credentials.
 * 3. With the password, the page carries `yawelo-idle-commit` = the expected SHA
 *    and the noindex header, and is the holding page production shows
 *    (#673): its mark, and the stylesheet it links served as CSS.
 * 4. The sync API's /health reports ok, that SHA and db "ok", with the
 *    noindex header (the API is not password-gated, by operator decision).
 * 5. The front door's other pages (`SITE_PAGES`: the Indonesian holding page
 *    and the game at /play/, forwarded by service binding) each carry that
 *    SHA and noindex with the password, the game refuses a caller without
 *    it, and the script the game shell loads is served as JavaScript (#332).
 * 6. The game Worker's own workers.dev address serves nothing: the site
 *    Worker's binding is its only way in, so nothing reaches the game
 *    around the gate (#332).
 * 7. The site being built, at the site Worker's own address
 *    (`PREVIEW_PAGES`: home, Indonesian and the roadmap), carries that SHA,
 *    noindex and its own mark with the password, and refuses a caller
 *    without it (#673).
 *
 * Nothing is retried (Refs #83). The one wait is for a named condition: both
 * hosts, and then each page judged, serving the expected commit, since
 * the previous deploy can be served for a few seconds after an upload, and
 * on one path after another has moved on (#581). Each look waits on only two answers: an
 * older commit, and no answer from a host that has not yet answered in this
 * run (a new Custom Domain's DNS on its first deploy). Anything else fails at
 * once, by name: a status other than 200, a missing stamp, a dropped
 * connection from a host that has answered, and above all a page served
 * WITHOUT the password, which is a leak at any look. Once both hosts and
 * every page serve the commit, every check is judged once, on that look's
 * own answers.
 *
 * The password is sent, never printed: no problem message carries a header.
 */

import { CONTENT_SECURITY_POLICY } from '../apps/web/worker/policy.ts';

export interface Probe {
  status: number;
  headers: Headers;
  body: string;
}

export interface Target {
  /** The dev front door, which shows the holding page (#673). */
  webUrl: string;
  /** The site Worker's own address, which shows the site being built (#673). */
  siteUrl: string;
  syncUrl: string;
  /** The game Worker's own workers.dev address, retired by #332. */
  gameUrl: string;
  sha: string;
  password: string;
}

export const NO_INDEX = 'noindex, nofollow, noarchive';

const COMMIT_STAMP = /<meta name="yawelo-idle-commit" content="([^"]*)"/;

/** The script a game shell loads, under /play/assets/. */
const GAME_SCRIPT = /<script[^>]+src="(\/play\/assets\/[^"]+\.js)"/;

/** The game's shell, the one page served by the game Worker (#332). */
const GAME_SHELL = '/play/';

/** The front door's pages checked once its home page serves the expected commit (#332, #673). */
export const SITE_PAGES: readonly string[] = ['/id/', GAME_SHELL];

/** The site being built's pages, at the site Worker's own address (#673). */
export const PREVIEW_PAGES: readonly string[] = ['/', '/id/', '/roadmap'];

/** The holding page's mark, an attribute Holding.astro writes (#673). */
const HOLDING_MARK = /<[a-z][^>]*\sdata-coming-soon[\s>=]/;

/** The site being built's mark, an attribute Base.astro writes (#673). */
const SITE_MARK = /<[a-z][^>]*\sdata-dev-strip[\s>=]/;

/** The stylesheet a page links, whatever the order of the tag's attributes (#673). */
export function stylesheetOf(body: string): string | undefined {
  for (const [tag] of body.matchAll(/<link\b[^>]*>/gi)) {
    if (!/\srel="stylesheet"/i.test(tag)) continue;
    const href = /\shref="([^"]+)"/i.exec(tag)?.[1];
    if (href !== undefined) return href;
  }
  return undefined;
}

/** Any sign that a response carries the app rather than a challenge. */
const APP_MARKUP = /<(?:!doctype|html|meta|script)\b/i;

export function basicAuthorization(password: string): string {
  const bytes = new TextEncoder().encode(`verify-dev:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

/** Problems with a response that should be the password challenge. */
/**
 * What one judgement ran and found (#372): the checks it judged, by name, and
 * the problems they found. A check that fails a gate (a wrong status, a body
 * that is not JSON) stops the ones after it, which are then not judged, so
 * `checked` is the population an absence of problems was drawn from.
 */
export interface Judgement {
  readonly checked: readonly string[];
  readonly problems: readonly string[];
}

/** One check: its name, the problem it finds or undefined, and whether a problem stops the rest. */
export interface Check {
  readonly name: string;
  readonly problem: () => string | undefined;
  readonly gate?: boolean;
}

export function judge(checks: readonly Check[]): Judgement {
  const checked: string[] = [];
  const problems: string[] = [];
  for (const { name, problem, gate } of checks) {
    checked.push(name);
    const found = problem();
    if (found === undefined) continue;
    problems.push(found);
    if (gate === true) break;
  }
  return { checked, problems };
}

export function gateJudgement(label: string, probe: Probe): Judgement {
  return judge([
    {
      name: 'status',
      problem: () =>
        probe.status === 401
          ? undefined
          : `${label}: answered ${String(probe.status)}, expected 401; the password gate is not in front of it`,
    },
    {
      name: 'challenge',
      problem: () =>
        /^Basic /i.test(probe.headers.get('www-authenticate') ?? '')
          ? undefined
          : `${label}: no Basic WWW-Authenticate challenge`,
    },
    {
      name: 'markup',
      problem: () =>
        APP_MARKUP.test(probe.body)
          ? `${label}: the response carries app markup`
          : undefined,
    },
  ]);
}

export function gateProblems(label: string, probe: Probe): string[] {
  return [...gateJudgement(label, probe).problems];
}

/** A gate probe that came back 2xx served content without the password. */
export function leaked(probe: Probe): boolean {
  return probe.status >= 200 && probe.status < 300;
}

export function robotsJudgement(probe: Probe): Judgement {
  return judge([
    {
      name: 'status',
      gate: true,
      problem: () =>
        probe.status === 200
          ? undefined
          : `robots.txt: status ${String(probe.status)} without credentials, expected 200`,
    },
    {
      name: 'blocks every crawler',
      problem: () =>
        /^User-agent: \*\nDisallow: \/$/m.test(probe.body)
          ? undefined
          : 'robots.txt: does not block every crawler',
    },
  ]);
}

export function robotsProblems(probe: Probe): string[] {
  return [...robotsJudgement(probe).problems];
}

const noIndexCheck = (label: string, probe: Probe): Check => ({
  name: 'noindex',
  problem: () => {
    const tag = probe.headers.get('x-robots-tag');
    return tag === NO_INDEX
      ? undefined
      : `${label}: X-Robots-Tag is ${JSON.stringify(tag)}, expected "${NO_INDEX}"`;
  },
});

function webChecks(probe: Probe, sha: string, label: string): Check[] {
  return [
    {
      name: 'status',
      gate: true,
      problem: () =>
        probe.status === 200
          ? undefined
          : `${label}: status ${String(probe.status)} with the password, expected 200`,
    },
    {
      name: 'commit',
      problem: () => {
        const stamp = COMMIT_STAMP.exec(probe.body)?.[1];
        if (stamp === undefined)
          return `${label}: no yawelo-idle-commit meta tag in the page`;
        return stamp === sha
          ? undefined
          : `${label}: serves commit ${stamp}, expected ${sha}`;
      },
    },
    noIndexCheck(label, probe),
  ];
}

export function webJudgement(
  probe: Probe,
  sha: string,
  label = 'web',
): Judgement {
  return judge(webChecks(probe, sha, label));
}

export function webProblems(
  probe: Probe,
  sha: string,
  label = 'web',
): string[] {
  return [...webJudgement(probe, sha, label).problems];
}

/** A check that the page carries the mark of the build that should serve it (#673). */
const markCheck = (
  label: string,
  probe: Probe,
  mark: RegExp,
  what: string,
  attribute: string,
): Check => ({
  name: 'mark',
  problem: () =>
    mark.test(probe.body)
      ? undefined
      : `${label}: not ${what}: no ${attribute} mark`,
});

/** A front door page: the holding page production shows (#673). */
export function holdingJudgement(
  probe: Probe,
  sha: string,
  label = 'web',
): Judgement {
  return judge([
    ...webChecks(probe, sha, label),
    markCheck(
      label,
      probe,
      HOLDING_MARK,
      'the holding page',
      'data-coming-soon',
    ),
  ]);
}

export function holdingProblems(
  probe: Probe,
  sha: string,
  label = 'web',
): string[] {
  return [...holdingJudgement(probe, sha, label).problems];
}

/** A page at the site Worker's own address: the site being built (#673). */
export function siteJudgement(
  probe: Probe,
  sha: string,
  label: string,
): Judgement {
  return judge([
    ...webChecks(probe, sha, label),
    markCheck(
      label,
      probe,
      SITE_MARK,
      'the site being built',
      'data-dev-strip',
    ),
  ]);
}

export function siteProblems(
  probe: Probe,
  sha: string,
  label: string,
): string[] {
  return [...siteJudgement(probe, sha, label).problems];
}

/** The holding page's stylesheet, read with the password (#673). */
export function stylesheetJudgement(label: string, probe: Probe): Judgement {
  return judge([
    {
      name: 'status',
      gate: true,
      problem: () =>
        probe.status === 200
          ? undefined
          : `${label}: status ${String(probe.status)} with the password, expected 200`,
    },
    {
      name: 'content type',
      problem: () => {
        const type = probe.headers.get('content-type');
        return /^text\/css\b/.test(type ?? '')
          ? undefined
          : `${label}: Content-Type is ${JSON.stringify(type)}, expected text/css`;
      },
    },
    noIndexCheck(label, probe),
  ]);
}

export function stylesheetProblems(label: string, probe: Probe): string[] {
  return [...stylesheetJudgement(label, probe).problems];
}

/** The game Worker's policy on a response it served (#123). */
const policyCheck = (label: string, probe: Probe): Check => ({
  name: 'content security policy',
  problem: () => {
    const policy = probe.headers.get('content-security-policy');
    return policy === CONTENT_SECURITY_POLICY
      ? undefined
      : `${label}: Content-Security-Policy is ${JSON.stringify(policy)}, expected ${JSON.stringify(CONTENT_SECURITY_POLICY)}`;
  },
});

/** The game's shell at /play/: a page of the site, under the game's policy (#123). */
export function gameShellJudgement(
  probe: Probe,
  sha: string,
  label: string,
): Judgement {
  return judge([...webChecks(probe, sha, label), policyCheck(label, probe)]);
}

export function gameShellProblems(
  probe: Probe,
  sha: string,
  label: string,
): string[] {
  return [...gameShellJudgement(probe, sha, label).problems];
}

/** A script the game shell loads, read with the password (#332). */
export function scriptJudgement(label: string, probe: Probe): Judgement {
  return judge([
    {
      name: 'status',
      gate: true,
      problem: () =>
        probe.status === 200
          ? undefined
          : `${label}: status ${String(probe.status)} with the password, expected 200`,
    },
    {
      name: 'content type',
      problem: () => {
        const type = probe.headers.get('content-type');
        return /^text\/javascript\b/.test(type ?? '')
          ? undefined
          : `${label}: Content-Type is ${JSON.stringify(type)}, expected text/javascript`;
      },
    },
    noIndexCheck(label, probe),
    policyCheck(label, probe),
  ]);
}

export function scriptProblems(label: string, probe: Probe): string[] {
  return [...scriptJudgement(label, probe).problems];
}

/**
 * The game Worker's own address, which must serve nothing (#332): any
 * success or redirect, or the game's commit stamp in the body, means the
 * game is reachable without passing the site Worker's gate.
 */
export function retiredJudgement(probe: Probe): Judgement {
  return judge([
    {
      name: 'status',
      problem: () =>
        probe.status >= 400
          ? undefined
          : `game address: answered ${String(probe.status)}; the game is reachable around the site's gate`,
    },
    {
      name: 'no game',
      problem: () =>
        COMMIT_STAMP.test(probe.body)
          ? 'game address: the response carries the game'
          : undefined,
    },
  ]);
}

export function retiredProblems(probe: Probe): string[] {
  return [...retiredJudgement(probe).problems];
}

export function healthJudgement(probe: Probe, sha: string): Judgement {
  let body: unknown;
  const expected = { ok: true, commit: sha, db: 'ok' };
  return judge([
    {
      name: 'status',
      gate: true,
      problem: () =>
        probe.status === 200
          ? undefined
          : `sync: /health status ${String(probe.status)}, expected 200`,
    },
    {
      name: 'JSON',
      gate: true,
      problem: () => {
        try {
          body = JSON.parse(probe.body);
          return undefined;
        } catch {
          return 'sync: /health did not return JSON';
        }
      },
    },
    {
      name: 'body',
      problem: () =>
        JSON.stringify(body) === JSON.stringify(expected)
          ? undefined
          : `sync: /health returned ${JSON.stringify(body)}, expected ${JSON.stringify(expected)}`,
    },
    noIndexCheck('sync', probe),
  ]);
}

/** Two of the roadmap's 10-minute checks (website spec §5.2 item 6). */
const ROADMAP_CHECK_MAX_AGE_MS = 20 * 60_000;

/** A health field in a message: a string as it is, anything else as JSON. */
const shown = (value: unknown): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

/** A health time in milliseconds, or NaN for anything but a parseable string. */
const timeOf = (value: unknown): number =>
  typeof value === 'string' ? Date.parse(value) : Number.NaN;

/** A health time in a message: a field the health left out says so. */
const stamped = (value: unknown): string =>
  value === undefined ? 'missing' : shown(value);

/** The fields of `/api/roadmap/health` this judges or names (#341, #689). */
interface RoadmapHealth {
  version?: unknown;
  drift?: unknown;
  readFailingSince?: unknown;
  readError?: unknown;
  lastCheckAt?: unknown;
  lastEventAt?: unknown;
  lastDriftAt?: unknown;
}

/**
 * The live roadmap's health (#341): the board has been read, no missed webhook
 * is outstanding (drift stays until a webhook is seen delivering a change
 * again, operator decision 2026-10-06), reads are not still failing at a
 * check after the one that failed (#693), and the 10-minute check ran within
 * two intervals.
 */
export function roadmapJudgement(probe: Probe, nowMs: number): Judgement {
  let body: RoadmapHealth = {};
  return judge([
    {
      name: 'status',
      gate: true,
      problem: () =>
        probe.status === 200
          ? undefined
          : `roadmap: /api/roadmap/health status ${String(probe.status)}, expected 200`,
    },
    {
      name: 'JSON',
      gate: true,
      problem: () => {
        try {
          body = JSON.parse(probe.body) as RoadmapHealth;
          return undefined;
        } catch {
          return 'roadmap: /api/roadmap/health did not return JSON';
        }
      },
    },
    {
      name: 'version',
      problem: () =>
        typeof body.version === 'number' && body.version >= 1
          ? undefined
          : `roadmap: version ${shown(body.version)}: the board has never been read`,
    },
    {
      name: 'drift',
      problem: () =>
        body.drift === 0
          ? undefined
          : // The times the judgement rests on, so the next drift is measured
            // from verify's own output, not inferred (#689).
            `roadmap: drift ${shown(body.drift)} since a webhook last delivered a change: a board change reached the roadmap only through the 10-minute check, so a webhook was missed (last drift ${stamped(body.lastDriftAt)}, last event ${stamped(body.lastEventAt)}, last check ${stamped(body.lastCheckAt)})`,
    },
    {
      name: 'reads',
      problem: () => {
        if (body.readFailingSince === null) return undefined;
        // A check stamps lastCheckAt as it starts, and a failed read stamps
        // readFailingSince with its own start: a failure no later check has
        // met yet is not red (#693, Shyden 2026-10-19). Times that cannot be
        // compared are red.
        const since = timeOf(body.readFailingSince);
        const check = timeOf(body.lastCheckAt);
        if (Number.isFinite(since) && Number.isFinite(check) && check <= since)
          return undefined;
        return `roadmap: reads failing since ${shown(body.readFailingSince)}, the check at ${stamped(body.lastCheckAt)} included: ${shown(body.readError)}`;
      },
    },
    {
      name: 'check age',
      problem: () => {
        const at = Date.parse(String(body.lastCheckAt));
        return Number.isFinite(at) && nowMs - at <= ROADMAP_CHECK_MAX_AGE_MS
          ? undefined
          : `roadmap: last check ${shown(body.lastCheckAt)}, more than 20 minutes ago: the cron is not running`;
      },
    },
    noIndexCheck('roadmap', probe),
  ]);
}
export function roadmapProblems(probe: Probe, nowMs: number): string[] {
  return [...roadmapJudgement(probe, nowMs).problems];
}

export function healthProblems(probe: Probe, sha: string): string[] {
  return [...healthJudgement(probe, sha).problems];
}

export async function probe(
  url: string,
  headers: Record<string, string> = {},
): Promise<Probe> {
  const response = await fetch(url, { headers, redirect: 'manual' });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.text(),
  };
}

export interface Outcome {
  problems: string[];
  /** The probe, or null when the request failed outright. */
  answer: Probe | null;
}

/**
 * Probes `url` and judges the answer. A request that fails outright (a dropped
 * connection, DNS not yet resolving a new hostname) is reported, never thrown,
 * so the report names it.
 */
export async function check(
  label: string,
  url: string,
  headers: Record<string, string>,
  judge: (probe: Probe) => string[],
): Promise<Outcome> {
  let answer: Probe;
  try {
    answer = await probe(url, headers);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      problems: [`${label}: request to ${url} failed: ${reason}`],
      answer: null,
    };
  }
  return { problems: judge(answer), answer };
}

/** How long to wait for the expected commit: `polls` looks, `pollMs` apart. */
export interface Wait {
  polls: number;
  pollMs: number;
}

/** The commit an answer reports, or a problem no wait will fix. */
type Reported = { commit: string } | { problem: string };

function webCommit(probe: Probe, label = 'web'): Reported {
  if (probe.status !== 200)
    return {
      problem: `${label}: status ${String(probe.status)} with the password, expected 200`,
    };
  const stamp = COMMIT_STAMP.exec(probe.body)?.[1];
  return stamp === undefined
    ? { problem: `${label}: no yawelo-idle-commit meta tag in the page` }
    : { commit: stamp };
}

function syncCommit(probe: Probe): Reported {
  if (probe.status !== 200)
    return {
      problem: `sync: /health status ${String(probe.status)}, expected 200`,
    };
  let body: unknown;
  try {
    body = JSON.parse(probe.body);
  } catch {
    return { problem: 'sync: /health did not return JSON' };
  }
  return typeof body === 'object' &&
    body !== null &&
    'commit' in body &&
    typeof body.commit === 'string'
    ? { commit: body.commit }
    : {
        problem: `sync: /health returned ${JSON.stringify(body)}, with no commit`,
      };
}

/** Where one host stands on the expected commit after one look. */
type Standing =
  | { kind: 'served' }
  | { kind: 'waiting'; problem: string }
  | { kind: 'failed'; problem: string };

export async function verifyDev(
  target: Target,
  { polls, pollMs }: Wait,
): Promise<string[]> {
  if (!Number.isInteger(polls) || polls < 1)
    throw new RangeError(
      `polls must be a whole number of at least 1, got ${String(polls)}`,
    );
  const healthUrl = new URL('/health', target.syncUrl).href;
  const robotsUrl = new URL('/robots.txt', target.webUrl).href;
  const right = { Authorization: basicAuthorization(target.password) };
  // Appending to the real password guarantees a different one.
  const wrong = { Authorization: basicAuthorization(`${target.password}x`) };

  /** Hosts that have answered in this run: a later failed request from one is a failure, not a wait. */
  const answered = new Set<Host>();
  const look = async (
    host: Host,
    label: string,
    url: string,
    headers: Record<string, string>,
    judge: (probe: Probe) => string[],
  ): Promise<Outcome & { unanswered: boolean }> => {
    const before = answered.has(host);
    const outcome = await check(label, url, headers, judge);
    if (outcome.answer !== null) answered.add(host);
    return { ...outcome, unanswered: outcome.answer === null && !before };
  };
  const standing = (
    outcome: Outcome & { unanswered: boolean },
    reported: (probe: Probe) => Reported,
    stale: (commit: string) => string,
  ): Standing => {
    if (outcome.answer === null)
      return {
        kind: outcome.unanswered ? 'waiting' : 'failed',
        problem: outcome.problems.join('; '),
      };
    const read = reported(outcome.answer);
    if ('problem' in read) return { kind: 'failed', problem: read.problem };
    return read.commit === target.sha
      ? { kind: 'served' }
      : { kind: 'waiting', problem: stale(read.commit) };
  };

  let waiting: string[] = [];
  for (let poll = 1; poll <= polls; poll += 1) {
    const gate = [
      await look('web', 'web without credentials', target.webUrl, {}, (p) =>
        gateProblems('web without credentials', p),
      ),
      await look(
        'web',
        'web with a wrong password',
        target.webUrl,
        wrong,
        (p) => gateProblems('web with a wrong password', p),
      ),
    ];
    if (gate.some(({ answer }) => answer !== null && leaked(answer)))
      return gate.flatMap((outcome) => outcome.problems);
    const web = await look('web', 'web', target.webUrl, right, (p) =>
      holdingProblems(p, target.sha),
    );
    const sync = await look('sync', 'sync', healthUrl, {}, (p) =>
      healthProblems(p, target.sha),
    );
    const hosts = [
      standing(
        web,
        webCommit,
        (c) => `web: serves commit ${c}, expected ${target.sha}`,
      ),
      standing(
        sync,
        syncCommit,
        (c) => `sync: /health serves commit ${c}, expected ${target.sha}`,
      ),
    ];
    const failed = hosts.flatMap((h) =>
      h.kind === 'failed' ? [h.problem] : [],
    );
    if (failed.length > 0) return failed;
    waiting = hosts.flatMap((h) => (h.kind === 'waiting' ? [h.problem] : []));
    if (waiting.length === 0) {
      // Every other page judged waits for the commit too (#581): a Workers
      // version rolls out per request, so /roadmap served the previous commit
      // 2 s after the home page served this one (deploy-dev run 38333791614).
      const pages = await lookAtPages(look, target, right);
      const standings = pages.map((page) =>
        standing(
          page,
          (p) => webCommit(p, page.label),
          (c) => `${page.label}: serves commit ${c}, expected ${target.sha}`,
        ),
      );
      const pageFailed = standings.flatMap((h) =>
        h.kind === 'failed' ? [h.problem] : [],
      );
      if (pageFailed.length > 0) return pageFailed;
      waiting = standings.flatMap((h) =>
        h.kind === 'waiting' ? [h.problem] : [],
      );
      if (waiting.length === 0) {
        const robots = await look(
          'web',
          'robots.txt',
          robotsUrl,
          {},
          robotsProblems,
        );
        return [
          ...gate,
          robots,
          web,
          sync,
          ...pages,
          ...(await lookAtTheRest(look, target, right, web, pages)),
        ].flatMap((outcome) => outcome.problems);
      }
    }
    if (poll < polls)
      await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return [
    `the expected commit ${target.sha} was not served on every page judged after ${String(polls)} looks ${String(pollMs)} ms apart`,
    ...waiting,
  ];
}

/** The hosts a run looks at: the front door, the site Worker's own address (#673), the sync API. */
type Host = 'web' | 'site' | 'sync';

/** One page's look, under the label its problems carry. */
type PageLook = Outcome & { unanswered: boolean; label: string };

type Look = (
  host: Host,
  label: string,
  url: string,
  headers: Record<string, string>,
  judge: (probe: Probe) => string[],
) => Promise<Outcome & { unanswered: boolean }>;

/**
 * Check 5's and 7's pages, at each look once both hosts serve the expected
 * commit: each of `SITE_PAGES` on the front door, then each of
 * `PREVIEW_PAGES` at the site Worker's own address, with the password, in
 * order.
 */
async function lookAtPages(
  look: Look,
  target: Target,
  right: Record<string, string>,
): Promise<PageLook[]> {
  const outcomes: PageLook[] = [];
  for (const path of SITE_PAGES) {
    const label = `web ${path}`;
    const outcome = await look(
      'web',
      label,
      new URL(path, target.webUrl).href,
      right,
      (p) =>
        path === GAME_SHELL
          ? gameShellProblems(p, target.sha, label)
          : holdingProblems(p, target.sha, label),
    );
    outcomes.push({ ...outcome, label });
  }
  for (const path of PREVIEW_PAGES) {
    const label = `site ${path}`;
    const outcome = await look(
      'site',
      label,
      new URL(path, target.siteUrl).href,
      right,
      (p) => siteProblems(p, target.sha, label),
    );
    outcomes.push({ ...outcome, label });
  }
  return outcomes;
}

/**
 * The rest of checks 3, 5, 6 and 7, once every page serves the expected
 * commit: the holding page's stylesheet (named by the front door's home page,
 * `home`, #673), the game's script (named by the shell among `pages`), the
 * gate in front of the game and of the site Worker's own address, the game's
 * retired address, and the live roadmap's health (#341).
 */
async function lookAtTheRest(
  look: Look,
  target: Target,
  right: Record<string, string>,
  home: Outcome,
  pages: readonly PageLook[],
): Promise<Outcome[]> {
  const at = (path: string) => new URL(path, target.webUrl).href;
  const outcomes: Outcome[] = [];
  const stylesheet = stylesheetOf(home.answer?.body ?? '');
  const shell =
    pages.find(({ label }) => label === `web ${GAME_SHELL}`)?.answer?.body ??
    '';
  const script = GAME_SCRIPT.exec(shell)?.[1];
  outcomes.push(
    stylesheet === undefined
      ? { problems: ['web: no stylesheet in the page'], answer: null }
      : await look('web', `web ${stylesheet}`, at(stylesheet), right, (p) =>
          stylesheetProblems(`web ${stylesheet}`, p),
        ),
    script === undefined
      ? { problems: ['web /play/: no game script in the page'], answer: null }
      : await look('web', `web ${script}`, at(script), right, (p) =>
          scriptProblems(`web ${script}`, p),
        ),
    await look('web', 'game without credentials', at('/play/'), {}, (p) =>
      gateProblems('game without credentials', p),
    ),
    await look('site', 'site without credentials', target.siteUrl, {}, (p) =>
      gateProblems('site without credentials', p),
    ),
    await check('game address', target.gameUrl, {}, retiredProblems),
    await look('web', 'roadmap health', at('/api/roadmap/health'), right, (p) =>
      roadmapProblems(p, Date.now()),
    ),
  );
  return outcomes;
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '')
    throw new Error(`${name} is not set`);
  return value;
}

if (import.meta.main) {
  const problems = await verifyDev(
    {
      webUrl: required('DEV_WEB_URL'),
      siteUrl: required('DEV_SITE_URL'),
      syncUrl: required('DEV_SYNC_URL'),
      gameUrl: required('DEV_GAME_URL'),
      sha: required('EXPECTED_SHA'),
      password: required('DEV_BASIC_AUTH_PASSWORD'),
    },
    { polls: 36, pollMs: 5_000 },
  );
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    process.exit(1);
  }
  console.log(
    '✓ dev is password-gated, blocks crawlers, serves the expected commit on every page and the game, shows the holding page on the front door and the site being built at its own address, keeps the game behind the site, and D1 answers',
  );
}
