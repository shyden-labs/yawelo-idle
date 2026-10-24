import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  NO_INDEX,
  basicAuthorization,
  gateJudgement,
  gameShellJudgement,
  gameShellProblems,
  gateProblems,
  healthJudgement,
  healthProblems,
  holdingJudgement,
  holdingProblems,
  leaked,
  PREVIEW_PAGES,
  roadmapJudgement,
  roadmapProblems,
  verifyRoadmap,
  retiredJudgement,
  retiredProblems,
  robotsJudgement,
  robotsProblems,
  scriptJudgement,
  scriptProblems,
  SITE_PAGES,
  siteJudgement,
  siteProblems,
  stylesheetJudgement,
  stylesheetOf,
  stylesheetProblems,
  verifyDev,
  webJudgement,
  webProblems,
  type Probe,
} from '../../scripts/verify-dev.ts';
import { CONTENT_SECURITY_POLICY } from '../../apps/web/worker/policy.ts';
import { floorBreach } from '../floors.ts';
import { searched } from '../searched.ts';

// The first fetch in a process sets up Node's HTTP client: 20-38 ms of CPU,
// measured for #553, which fell on whichever verifyDev test ran first. It
// runs with the file instead, under #541's load limit, against a server
// that answers this one request.
const warm = createServer((_req, res) => res.end());
await new Promise<void>((resolve) => warm.listen(0, '127.0.0.1', resolve));
const warmed = await fetch(
  `http://127.0.0.1:${String((warm.address() as AddressInfo).port)}/`,
);
await warmed.text();
warm.close();

const SHA = 'd547bd669678987eb85b5807d1a26ea55eaeb987';
const OLD = '1f660b30f75d081ae6559d175e5c0c3e26acb84c';
const PASSWORD = 'pä:ss';
const ROBOTS = '# blocked\nUser-agent: *\nDisallow: /\n';
const page = (sha: string) =>
  `<!doctype html><html><head><meta name="yawelo-idle-commit" content="${sha}" /></head></html>`;
const probe = (
  status: number,
  body = '',
  headers: Record<string, string> = {},
): Probe => ({ status, body, headers: new Headers(headers) });
const challenge = { 'www-authenticate': 'Basic realm="Yawelo Idle Non-Prod"' };
const SCRIPT = '/play/assets/app.js';
const JAVASCRIPT = 'text/javascript; charset=utf-8';
/** A page as the fake site serves it: every page names the game's script. */
const shell = (sha: string) =>
  page(sha).replace(
    '</head>',
    `<script type="module" src="${SCRIPT}"></script></head>`,
  );
const noindex = { 'x-robots-tag': NO_INDEX };
const policy = { 'content-security-policy': CONTENT_SECURITY_POLICY };
const STYLESHEET = '/_astro/Holding.Bd-ZPiSZ.css';
const CSS = 'text/css; charset=utf-8';
/** The holding page as its build writes it (Holding.astro, #673). */
const holding = (sha: string) =>
  page(sha)
    .replace(
      '</head>',
      `<link rel="alternate" hreflang="id" href="/id/"><link rel="stylesheet" href="${STYLESHEET}"></head>`,
    )
    .replace(
      '</html>',
      '<body><p class="badge" data-coming-soon>Soon</p></body></html>',
    );
/** The site being built as its build writes it (Base.astro, #673). */
const site = (sha: string) =>
  page(sha).replace(
    '</html>',
    '<body><p class="dev-strip" data-dev-strip>In development</p></body></html>',
  );

describe('holdingProblems (#673)', () => {
  it('accepts the holding page with its commit, noindex and mark', () => {
    const judged = holdingJudgement(probe(200, holding(SHA), noindex), SHA);
    expect(
      searched(judged.problems, { of: judged.checked, what: 'holding checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/holding-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('fails the site being built served in its place', () => {
    expect(holdingProblems(probe(200, site(SHA), noindex), SHA)).toEqual([
      'web: not the holding page: no data-coming-soon mark',
    ]);
  });

  it('fails a page that names the mark only in its text', () => {
    const text = page(SHA).replace(
      '</html>',
      '<body><p>data-coming-soon</p></body></html>',
    );
    expect(holdingProblems(probe(200, text, noindex), SHA)).toEqual([
      'web: not the holding page: no data-coming-soon mark',
    ]);
  });

  it('fails a non-200 and judges nothing after it', () => {
    const judged = holdingJudgement(probe(404, holding(SHA), noindex), SHA);
    expect(judged).toEqual({
      checked: ['status'],
      problems: ['web: status 404 with the password, expected 200'],
    });
  });
});

describe('siteProblems (#673)', () => {
  it('accepts the site being built with its commit, noindex and mark', () => {
    const judged = siteJudgement(probe(200, site(SHA), noindex), SHA, 'site /');
    expect(
      searched(judged.problems, { of: judged.checked, what: 'site checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/site-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('fails the holding page served in its place', () => {
    expect(
      siteProblems(probe(200, holding(SHA), noindex), SHA, 'site /'),
    ).toEqual(['site /: not the site being built: no data-dev-strip mark']);
  });
});

describe('stylesheetOf (#673)', () => {
  it('names the stylesheet the page links', () => {
    expect(stylesheetOf(holding(SHA))).toBe(STYLESHEET);
  });

  it('names none in a page that links none', () => {
    expect(stylesheetOf(site(SHA))).toBeUndefined();
  });

  it('names none for a link that is not a stylesheet', () => {
    expect(
      stylesheetOf('<link rel="alternate" href="/_astro/x.css">'),
    ).toBeUndefined();
  });

  it('names the stylesheet whatever the order of its attributes', () => {
    expect(stylesheetOf(`<link href="${STYLESHEET}" rel="stylesheet">`)).toBe(
      STYLESHEET,
    );
  });
});

describe('stylesheetProblems (#673)', () => {
  const label = `web ${STYLESHEET}`;

  it('accepts CSS with noindex', () => {
    const judged = stylesheetJudgement(
      label,
      probe(200, 'body{}', { 'content-type': CSS, ...noindex }),
    );
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'stylesheet checks',
      }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/stylesheet-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('fails a stylesheet served as a page', () => {
    expect(
      stylesheetProblems(
        label,
        probe(200, '<html>', { 'content-type': 'text/html', ...noindex }),
      ),
    ).toEqual([`${label}: Content-Type is "text/html", expected text/css`]);
  });

  it('fails a stylesheet without the noindex header', () => {
    expect(
      stylesheetProblems(label, probe(200, 'body{}', { 'content-type': CSS })),
    ).toEqual([`${label}: X-Robots-Tag is null, expected "${NO_INDEX}"`]);
  });

  it('fails a non-200 and judges nothing after it', () => {
    const judged = stylesheetJudgement(label, probe(404, '', noindex));
    expect(judged).toEqual({
      checked: ['status'],
      problems: [`${label}: status 404 with the password, expected 200`],
    });
  });
});

describe('basicAuthorization', () => {
  it('encodes the password as UTF-8 after a fixed username', () => {
    const header = basicAuthorization(PASSWORD);
    expect(header.startsWith('Basic ')).toBe(true);
    const bytes = Uint8Array.from(atob(header.slice(6)), (c) =>
      c.charCodeAt(0),
    );
    expect(new TextDecoder().decode(bytes)).toBe(`verify-dev:${PASSWORD}`);
  });
});

describe('gateProblems', () => {
  it('accepts a 401 Basic challenge with no app in it', () => {
    const judged = gateJudgement('web', probe(401, 'testers only', challenge));
    expect(
      searched(judged.problems, { of: judged.checked, what: 'gate checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/gate-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('fails a 200, naming the missing gate', () => {
    expect(gateProblems('web', probe(200, page(SHA)))).toEqual([
      'web: answered 200, expected 401; the password gate is not in front of it',
      'web: no Basic WWW-Authenticate challenge',
      'web: the response carries app markup',
    ]);
  });

  it.each([
    ['a non-Basic challenge', { 'www-authenticate': 'Bearer' }],
    ['no challenge at all', {}],
  ])('fails a 401 with %s', (_case, headers) => {
    expect(gateProblems('web', probe(401, '', headers))).toEqual([
      'web: no Basic WWW-Authenticate challenge',
    ]);
  });

  it('fails a 401 that still carries the page', () => {
    expect(gateProblems('web', probe(401, page(SHA), challenge))).toEqual([
      'web: the response carries app markup',
    ]);
  });

  it('fails a redirect, which is not the challenge', () => {
    expect(gateProblems('web', probe(302, '', challenge))).toEqual([
      'web: answered 302, expected 401; the password gate is not in front of it',
    ]);
  });
});

describe('leaked', () => {
  it.each([
    [200, true],
    [204, true],
    [299, true],
    [301, false],
    [401, false],
    [500, false],
  ])('status %i leaked: %s', (status, expected) => {
    expect(leaked(probe(status))).toBe(expected);
  });
});

describe('robotsProblems', () => {
  it('accepts a robots.txt that blocks every crawler', () => {
    const judged = robotsJudgement(probe(200, ROBOTS));
    expect(
      searched(judged.problems, { of: judged.checked, what: 'robots checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/robots-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it.each([
    ['allows everything', 'User-agent: *\nDisallow:\n'],
    ['blocks one crawler only', 'User-agent: Googlebot\nDisallow: /\n'],
    ['blocks a path only', 'User-agent: *\nDisallow: /admin\n'],
    ['is empty', ''],
  ])('fails one that %s', (_case, body) => {
    expect(robotsProblems(probe(200, body))).toEqual([
      'robots.txt: does not block every crawler',
    ]);
  });

  it('fails a challenge in place of robots.txt', () => {
    expect(robotsProblems(probe(401, ROBOTS))).toEqual([
      'robots.txt: status 401 without credentials, expected 200',
    ]);
  });
});

describe('webProblems', () => {
  it('accepts the expected commit with noindex', () => {
    const judged = webJudgement(probe(200, page(SHA), noindex), SHA);
    expect(
      searched(judged.problems, { of: judged.checked, what: 'web checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/web-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('names the stale commit when the previous deploy is still served', () => {
    expect(webProblems(probe(200, page(OLD), noindex), SHA)).toEqual([
      `web: serves commit ${OLD}, expected ${SHA}`,
    ]);
  });

  it('fails a page without the noindex header', () => {
    expect(webProblems(probe(200, page(SHA)), SHA)).toEqual([
      `web: X-Robots-Tag is null, expected "${NO_INDEX}"`,
    ]);
  });

  it('fails a page with no stamp, and a non-200', () => {
    expect(webProblems(probe(200, '<html></html>', noindex), SHA)).toEqual([
      'web: no yawelo-idle-commit meta tag in the page',
    ]);
    expect(webProblems(probe(401, '', noindex), SHA)).toEqual([
      'web: status 401 with the password, expected 200',
    ]);
  });
});

describe('scriptProblems (#332)', () => {
  it('accepts JavaScript with noindex, judging every check', () => {
    const ok = probe(200, 'export {};', {
      'content-type': JAVASCRIPT,
      ...noindex,
      ...policy,
    });
    expect(scriptJudgement('web /x.js', ok)).toEqual({
      checked: ['status', 'content type', 'noindex', 'content security policy'],
      problems: [],
    });
  });

  it('fails a script served without the game’s Content Security Policy (#123)', () => {
    const bare = probe(200, '', { 'content-type': JAVASCRIPT, ...noindex });
    expect(scriptProblems('web /x.js', bare)).toEqual([
      `web /x.js: Content-Security-Policy is null, expected ${JSON.stringify(CONTENT_SECURITY_POLICY)}`,
    ]);
  });

  it('fails a non-200 and judges nothing after it', () => {
    expect(scriptJudgement('web /x.js', probe(404))).toEqual({
      checked: ['status'],
      problems: ['web /x.js: status 404 with the password, expected 200'],
    });
  });

  it.each([
    ['HTML', 'text/html; charset=utf-8'],
    ['a look-alike type', 'text/javascriptish'],
  ])('fails a script served as %s', (_case, type) => {
    const wrongType = probe(200, '', {
      'content-type': type,
      ...noindex,
      ...policy,
    });
    expect(scriptProblems('web /x.js', wrongType)).toEqual([
      `web /x.js: Content-Type is ${JSON.stringify(type)}, expected text/javascript`,
    ]);
  });

  it('fails a script without the noindex header', () => {
    const bare = probe(200, '', { 'content-type': JAVASCRIPT, ...policy });
    expect(scriptProblems('web /x.js', bare)).toEqual([
      'web /x.js: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"',
    ]);
  });
});

describe('gameShellProblems (#123)', () => {
  it('accepts the game shell with its commit, noindex and the game’s policy', () => {
    const judged = gameShellJudgement(
      probe(200, shell(SHA), { ...noindex, ...policy }),
      SHA,
      'web /play/',
    );
    expect(
      searched(judged.problems, {
        of: judged.checked,
        what: 'game shell checks',
      }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/game-shell-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it.each([
    ['no policy', {}, 'null'],
    [
      'a weaker policy',
      { 'content-security-policy': 'default-src *' },
      JSON.stringify('default-src *'),
    ],
  ])('names a shell served with %s', (_case, headers, seen) => {
    expect(
      gameShellProblems(
        probe(200, shell(SHA), { ...noindex, ...headers }),
        SHA,
        'web /play/',
      ),
    ).toEqual([
      `web /play/: Content-Security-Policy is ${seen}, expected ${JSON.stringify(CONTENT_SECURITY_POLICY)}`,
    ]);
  });
});

describe('retiredProblems (#332)', () => {
  it('accepts a not-found that carries no game, judging both checks', () => {
    expect(retiredJudgement(probe(404, 'There is nothing here yet'))).toEqual({
      checked: ['status', 'no game'],
      problems: [],
    });
  });

  it.each([200, 301, 307, 399])(
    'fails a %s, which reaches past the gate',
    (status) => {
      expect(retiredProblems(probe(status))).toEqual([
        `game address: answered ${String(status)}; the game is reachable around the site's gate`,
      ]);
    },
  );

  it('fails an error page that still carries the game', () => {
    expect(retiredProblems(probe(500, page(SHA)))).toEqual([
      'game address: the response carries the game',
    ]);
  });
});

describe('healthProblems', () => {
  const healthy = JSON.stringify({ ok: true, commit: SHA, db: 'ok' });

  it('accepts ok, the commit, db ok and noindex', () => {
    const judged = healthJudgement(probe(200, healthy, noindex), SHA);
    expect(
      searched(judged.problems, { of: judged.checked, what: 'health checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/health-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it.each([
    ['a stale commit', { ok: true, commit: OLD, db: 'ok' }],
    ['a D1 failure', { ok: false, commit: SHA, db: 'unreachable' }],
    ['an extra field', { ok: true, commit: SHA, db: 'ok', debug: 1 }],
  ])('fails %s', (_label, body) => {
    expect(
      healthProblems(probe(200, JSON.stringify(body), noindex), SHA),
    ).toHaveLength(1);
  });

  it('fails a healthy answer without the noindex header', () => {
    expect(
      healthProblems(probe(200, healthy, { 'x-robots-tag': 'noindex' }), SHA),
    ).toEqual([`sync: X-Robots-Tag is "noindex", expected "${NO_INDEX}"`]);
  });

  it('fails a non-JSON body and a non-200', () => {
    expect(healthProblems(probe(200, 'oops', noindex), SHA)).toEqual([
      'sync: /health did not return JSON',
    ]);
    expect(healthProblems(probe(503, healthy, noindex), SHA)).toEqual([
      'sync: /health status 503, expected 200',
    ]);
  });
});

describe('roadmapProblems (#341)', () => {
  /** Every check roadmapJudgement runs, in order. */
  const ALL_ROADMAP_CHECKS = [
    'status',
    'JSON',
    'after deploy',
    'version',
    'drift',
    'reads',
    'check age',
    'noindex',
  ];
  const NOW = Date.parse('2026-10-06T13:00:00Z');
  /** The deploy each record is judged against: before every check below (#708). */
  const DEPLOYED = Date.parse('2026-10-06T12:30:00Z');
  const healthy = {
    lastEventAt: '2026-10-06T12:58:00.000Z',
    lastCheckAt: '2026-10-06T12:51:00.000Z',
    version: 3,
    drift: 0,
    driftTotal: 0,
    pendingDriftSince: null,
    readFailingSince: null,
    readError: null,
  };
  const health = (over: Record<string, unknown> = {}) =>
    probe(200, JSON.stringify({ ...healthy, ...over }), noindex);

  it('accepts a read board with no drift, no failing reads and a recent check', () => {
    const judged = roadmapJudgement(health(), NOW, DEPLOYED);
    expect(
      searched(judged.problems, { of: judged.checked, what: 'roadmap checks' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/roadmap-checks', judged.checked.length),
    ).toBeUndefined();
  });

  it('fails a board never read', () => {
    expect(roadmapProblems(health({ version: 0 }), NOW, DEPLOYED)).toEqual([
      'roadmap: version 0: the board has never been read',
    ]);
  });

  it('fails drift, naming a missed webhook, however old it is', () => {
    expect(
      roadmapProblems(
        health({
          drift: 1,
          driftTotal: 1,
          lastDriftAt: '2026-10-06T12:41:00.000Z',
        }),
        NOW,
        DEPLOYED,
      ),
    ).toEqual([
      'roadmap: drift 1 since a webhook last delivered a change: a board change reached the roadmap only through the 10-minute check, so a webhook was missed (last drift 2026-10-06T12:41:00.000Z, last event 2026-10-06T12:58:00.000Z, last check 2026-10-06T12:51:00.000Z)',
    ]);
  });

  // #689: the drift on 2026-10-19 could only be inferred, because verify
  // printed the judgement and not the times it rests on.
  it('names a time the health left out as missing, not as a time', () => {
    expect(
      roadmapProblems(
        health({ drift: 2, lastEventAt: null, lastDriftAt: undefined }),
        NOW,
        DEPLOYED,
      ),
    ).toEqual([
      'roadmap: drift 2 since a webhook last delivered a change: a board change reached the roadmap only through the 10-minute check, so a webhook was missed (last drift missing, last event null, last check 2026-10-06T12:51:00.000Z)',
    ]);
  });

  // #708 (Shyden, 2026-10-20: "treat any failure as red"): only a record
  // whose last check came after the deploy is judged, so a failed read it
  // carries is the deployed code's, or the old code's with the new code's
  // check failing too. Either is red at once: #693's wait for a second
  // failed check would let a deploy that breaks reads pass on its first.
  it.each([
    [
      'still failing at a later check',
      '2026-10-06T12:40:00.000Z',
      'GitHub refused POST /graphql: HTTP 502',
    ],
    [
      'one millisecond before the last check',
      '2026-10-06T12:50:59.999Z',
      'GitHub refused GET /orgs/shyden-labs/installation: HTTP 520',
    ],
    [
      'at the last check, the first after the deploy',
      '2026-10-06T12:51:00.000Z',
      'GitHub refused GET /orgs/shyden-labs/installation: HTTP 520',
    ],
    [
      'in an event read after the last check',
      '2026-10-06T12:55:00.000Z',
      'GitHub refused POST /graphql: HTTP 502',
    ],
    ['at a time it cannot read', 'soon', 'GitHub refused'],
  ])('fails a read that failed %s, with the reason', (_label, since, error) => {
    expect(
      roadmapJudgement(
        health({ readFailingSince: since, readError: error }),
        NOW,
        DEPLOYED,
      ),
    ).toEqual({
      checked: ALL_ROADMAP_CHECKS,
      problems: [
        `roadmap: reads failing since ${since} (last check 2026-10-06T12:51:00.000Z): ${error}`,
      ],
    });
  });

  it('fails a read failure the health left out of its fields', () => {
    expect(
      roadmapProblems(health({ readFailingSince: undefined }), NOW, DEPLOYED),
    ).toEqual([
      'roadmap: reads failing since missing (last check 2026-10-06T12:51:00.000Z): null',
    ]);
  });

  it('fails a last check more than 20 minutes old', () => {
    expect(
      roadmapProblems(
        health({ lastCheckAt: '2026-10-06T12:39:59.000Z' }),
        NOW,
        DEPLOYED,
      ),
    ).toEqual([
      'roadmap: last check 2026-10-06T12:39:59.000Z, more than 20 minutes ago: the cron is not running',
    ]);
  });

  it('accepts a last check exactly 20 minutes old, at the recorded floor', () => {
    const judged = roadmapJudgement(
      health({ lastCheckAt: '2026-10-06T12:40:00.000Z' }),
      NOW,
      DEPLOYED,
    );
    expect(
      searched(judged.problems, { of: judged.checked, what: 'roadmap checks' }),
    ).toEqual([]);
    expect(
      floorBreach(
        'verify-dev/roadmap-checks-at-the-bound',
        judged.checked.length,
      ),
    ).toBeUndefined();
  });

  it('fails a check that never ran', () => {
    expect(
      roadmapProblems(health({ lastCheckAt: null }), NOW, DEPLOYED),
    ).toEqual([
      'roadmap: last check null, more than 20 minutes ago: the cron is not running',
    ]);
  });

  // #708: deploy-dev run 39353024750 judged the old Worker's 01:20:56 check
  // after the 01:28:39 deploy. A record made before the deploy is the
  // previous code's, so it is not judged at all: the rest of its checks
  // would judge the old code too.
  it('refuses a check made before the deploy, naming both times, and judges nothing after it', () => {
    const judged = roadmapJudgement(
      health({
        lastCheckAt: '2026-10-06T12:29:59.999Z',
        drift: 1,
        version: 0,
      }),
      NOW,
      DEPLOYED,
    );
    expect(judged).toEqual({
      checked: ['status', 'JSON', 'after deploy'],
      problems: [
        'roadmap: last check 2026-10-06T12:29:59.999Z was made before the deploy at 2026-10-06T12:30:00.000Z, by the code that deploy replaced',
      ],
    });
  });

  it('judges a check made at the deploy’s own millisecond as today', () => {
    expect(
      roadmapJudgement(
        health({ lastCheckAt: '2026-10-06T12:30:00.000Z' }),
        Date.parse('2026-10-06T12:31:00Z'),
        DEPLOYED,
      ),
    ).toEqual({ checked: ALL_ROADMAP_CHECKS, problems: [] });
  });

  // A last check that cannot be read as a time is not called "before the
  // deploy": the check-age check names it, as before #708.
  it('leaves a last check that is not a time to the check-age check', () => {
    expect(
      roadmapJudgement(health({ lastCheckAt: 'soon' }), NOW, DEPLOYED),
    ).toEqual({
      checked: ALL_ROADMAP_CHECKS,
      problems: [
        'roadmap: last check soon, more than 20 minutes ago: the cron is not running',
      ],
    });
  });

  it('fails a non-JSON body and a non-200', () => {
    expect(roadmapProblems(probe(200, 'oops', noindex), NOW, DEPLOYED)).toEqual(
      ['roadmap: /api/roadmap/health did not return JSON'],
    );
    expect(roadmapProblems(probe(401, '', noindex), NOW, DEPLOYED)).toEqual([
      'roadmap: /api/roadmap/health status 401, expected 200',
    ]);
  });

  it('fails a healthy answer without the noindex header', () => {
    expect(
      roadmapProblems(
        probe(200, JSON.stringify(healthy), { 'x-robots-tag': 'noindex' }),
        NOW,
        DEPLOYED,
      ),
    ).toEqual([`roadmap: X-Robots-Tag is "noindex", expected "${NO_INDEX}"`]);
  });
});

/**
 * verifyDev end to end over real HTTP: a local server stands in for both dev
 * hosts. `/health` is the ungated sync API; every other path is the web host,
 * which answers the Basic challenge unless the password is right, except
 * robots.txt. The `let`s below switch it between healthy and broken states.
 */
describe('verifyDev', () => {
  let server: Server;
  let base = '';
  /** The site Worker's own address, which shows the site being built (#673). */
  let siteServer: Server;
  let siteBase = '';
  /** The front door serves the site being built in place of the holding page. */
  let plantSite = false;
  /** The site's own address serves the holding page in place of the site. */
  let siteServesHolding = false;
  /** The site's own address serves its pages to anyone. */
  let ungatedSite = false;
  /** The status the holding page's stylesheet answers with. */
  let styleStatus = 200;
  let served = SHA;
  let gated = true;
  let tagged = true;
  /** Looks at the authorised page and at /health that still find OLD, each. */
  let staleLooks = 0;
  /** The authorised page request, counted from 1, whose connection is dropped. */
  let dropAuthorisedAt = 0;
  let dropRobots = false;
  /** The next unauthenticated page request is redirected instead of challenged. */
  let redirectGateOnce = false;
  /** The status the authorised page answers with. */
  let authorisedStatus = 200;
  let requests = 0;
  let authorisedRequests = 0;
  /** The retired game address still serves the game (#332). */
  let retiredServes = false;
  /** The Content-Type the game's script is served with. */
  let scriptType = JAVASCRIPT;
  /** A page path that keeps serving OLD after the home page turns current. */
  let stalePath = '';
  /** How many requests to `stalePath` find OLD before it turns current (#581). */
  let stalePathLooks = Number.POSITIVE_INFINITY;
  let stalePathSeen = 0;
  /** A page path that answers `failStatus` with the password (#581). */
  let failPath = '';
  let failStatus = 500;
  /** A page path served to anyone, as if the gate did not cover it. */
  let ungatedPath = '';
  /** The game shell names no script. */
  let noScript = false;
  /** The game's shell and script carry its Content Security Policy (#123). */
  let policyServed = true;
  const seenUrls: string[] = [];
  let webStale = 0;
  let healthStale = 0;
  const seenAuthorization: string[] = [];
  /** What /api/roadmap/health answers to an authorised request (#341). */
  let roadmap: Record<string, unknown> = {};
  /** Records answered first, one per look, before `roadmap` (#708). */
  let roadmapLooks: Record<string, unknown>[] = [];
  let roadmapStatus = 200;
  /** Drops the roadmap request's connection, so the request fails outright. */
  let roadmapDrops = false;

  /** One fake for both addresses: `role` says which Worker's pages it plays. */
  const handle =
    (role: 'web' | 'site') =>
    (req: IncomingMessage, res: ServerResponse): void => {
      requests += 1;
      seenUrls.push(`${role === 'site' ? 'site:' : ''}${req.url ?? ''}`);
      const tag: Record<string, string> = tagged
        ? { 'x-robots-tag': NO_INDEX }
        : {};
      const authorization = req.headers.authorization ?? '';
      seenAuthorization.push(authorization);
      const authorised = authorization === basicAuthorization(PASSWORD);
      if (req.url === '/health') {
        healthStale += 1;
        const commit = healthStale <= staleLooks ? OLD : served;
        res.writeHead(200, { 'content-type': 'application/json', ...tag });
        res.end(JSON.stringify({ ok: true, commit, db: 'ok' }));
        return;
      }
      if (req.url === '/api/roadmap/health' && authorised) {
        if (roadmapDrops) {
          req.socket.destroy();
          return;
        }
        const record = roadmapLooks.shift() ?? roadmap;
        res.writeHead(roadmapStatus, {
          'content-type': 'application/json',
          ...tag,
        });
        res.end(JSON.stringify(record));
        return;
      }
      if (req.url === '/retired-game/') {
        res.writeHead(retiredServes ? 200 : 404, {
          'content-type': 'text/html',
        });
        res.end(retiredServes ? shell(served) : 'There is nothing here yet');
        return;
      }
      const gamePolicy: Record<string, string> = policyServed
        ? { 'content-security-policy': CONTENT_SECURITY_POLICY }
        : {};
      if (req.url === SCRIPT && authorised) {
        res.writeHead(200, {
          'content-type': scriptType,
          ...tag,
          ...gamePolicy,
        });
        res.end('export {};');
        return;
      }
      if (role === 'web' && req.url === STYLESHEET && authorised) {
        res.writeHead(styleStatus, { 'content-type': CSS, ...tag });
        res.end('body{}');
        return;
      }
      if (req.url === '/robots.txt') {
        if (dropRobots) {
          req.socket.destroy();
          return;
        }
        res.writeHead(200, { 'content-type': 'text/plain', ...tag });
        res.end(ROBOTS);
        return;
      }
      if (authorised) {
        authorisedRequests += 1;
        if (authorisedRequests === dropAuthorisedAt) {
          req.socket.destroy();
          return;
        }
      }
      const ungated = role === 'site' ? ungatedSite : req.url === ungatedPath;
      if (gated && !authorised && !ungated) {
        if (redirectGateOnce && authorization === '') {
          redirectGateOnce = false;
          res.writeHead(302, { location: '/login', ...tag });
          res.end();
          return;
        }
        res.writeHead(401, { ...challenge, ...tag });
        res.end('testers only');
        return;
      }
      webStale += 1;
      const pathStale =
        req.url === stalePath && (stalePathSeen += 1) <= stalePathLooks;
      res.writeHead(
        authorised && req.url === failPath
          ? failStatus
          : authorised
            ? authorisedStatus
            : 200,
        {
          'content-type': 'text/html',
          ...tag,
          ...(req.url === '/play/' ? gamePolicy : {}),
        },
      );
      const commit = webStale <= staleLooks || pathStale ? OLD : served;
      if (req.url === '/play/' && role === 'web')
        res.end(noScript ? page(commit) : shell(commit));
      else if (role === 'site')
        res.end(siteServesHolding ? holding(commit) : site(commit));
      else res.end(plantSite ? site(commit) : holding(commit));
    };

  const listen = async (handler: Server): Promise<string> => {
    await new Promise<void>((resolve) =>
      handler.listen(0, '127.0.0.1', resolve),
    );
    return `http://127.0.0.1:${String((handler.address() as AddressInfo).port)}`;
  };

  beforeAll(async () => {
    server = createServer(handle('web'));
    siteServer = createServer(handle('site'));
    base = await listen(server);
    siteBase = await listen(siteServer);
  });

  afterAll(() => {
    server.close();
    siteServer.close();
  });

  const target = () => ({
    webUrl: `${base}/`,
    siteUrl: `${siteBase}/`,
    syncUrl: base,
    gameUrl: `${base}/retired-game/`,
    sha: SHA,
    password: PASSWORD,
  });

  const reset = () => {
    plantSite = false;
    siteServesHolding = false;
    ungatedSite = false;
    styleStatus = 200;
    served = SHA;
    gated = true;
    tagged = true;
    staleLooks = 0;
    dropAuthorisedAt = 0;
    dropRobots = false;
    redirectGateOnce = false;
    authorisedStatus = 200;
    requests = 0;
    authorisedRequests = 0;
    retiredServes = false;
    scriptType = JAVASCRIPT;
    stalePath = '';
    stalePathLooks = Number.POSITIVE_INFINITY;
    stalePathSeen = 0;
    failPath = '';
    failStatus = 500;
    ungatedPath = '';
    noScript = false;
    policyServed = true;
    seenUrls.length = 0;
    webStale = 0;
    healthStale = 0;
    seenAuthorization.length = 0;
    roadmap = {
      lastEventAt: null,
      lastCheckAt: new Date().toISOString(),
      version: 1,
      drift: 0,
      driftTotal: 0,
      pendingDriftSince: null,
      readFailingSince: null,
      readError: null,
    };
    roadmapLooks = [];
    roadmapStatus = 200;
    roadmapDrops = false;
  };

  describe('verifyRoadmap (#708)', () => {
    const ROADMAP = '/api/roadmap/health';
    const looks = () => seenUrls.filter((url) => url === ROADMAP).length;
    /** A minute ago: the reset record's check, stamped at reset, is after it. */
    const deployed = () => Date.now() - 60_000;
    const before = (at: number) => new Date(at - 1).toISOString();
    const replaced = (at: number) =>
      `roadmap: last check ${before(at)} was made before the deploy at ${new Date(at).toISOString()}, by the code that deploy replaced`;

    it('waits past checks the old code made, then judges the first one after the deploy, with the password', async () => {
      reset();
      const at = deployed();
      roadmapLooks = [
        { ...roadmap, lastCheckAt: before(at) },
        { ...roadmap, lastCheckAt: before(at) },
      ];
      const problems = await verifyRoadmap(target(), at, {
        polls: 3,
        pollMs: 0,
      });
      // The exact looks first: a floor that moved would otherwise stop the
      // test before they were checked (measured on #332).
      const looked = looks();
      expect(looked).toBe(3);
      expect(seenAuthorization).toEqual([
        basicAuthorization(PASSWORD),
        basicAuthorization(PASSWORD),
        basicAuthorization(PASSWORD),
      ]);
      expect(searched(problems, { of: looked, what: 'roadmap looks' })).toEqual(
        [],
      );
      expect(
        floorBreach('verify-dev/roadmap-wait-looks', looked),
      ).toBeUndefined();
    });

    it('fails at its ceiling, naming the last check the old code made', async () => {
      reset();
      const at = deployed();
      roadmap = { ...roadmap, lastCheckAt: before(at) };
      expect(
        await verifyRoadmap(target(), at, { polls: 3, pollMs: 0 }),
      ).toEqual([
        `roadmap: no check after the deploy at ${new Date(at).toISOString()} in 3 looks 0 ms apart`,
        replaced(at),
      ]);
      expect(looks()).toBe(3);
    });

    it('fails a check after the deploy that missed a webhook, without looking again (#341)', async () => {
      reset();
      roadmap = {
        ...roadmap,
        drift: 1,
        driftTotal: 1,
        lastDriftAt: '2026-10-19T00:50:00.000Z',
      };
      expect(
        await verifyRoadmap(target(), deployed(), { polls: 3, pollMs: 0 }),
      ).toEqual([
        `roadmap: drift 1 since a webhook last delivered a change: a board change reached the roadmap only through the 10-minute check, so a webhook was missed (last drift 2026-10-19T00:50:00.000Z, last event null, last check ${String(roadmap.lastCheckAt)})`,
      ]);
      expect(looks()).toBe(1);
    });

    it('fails a check after the deploy served without the noindex header', async () => {
      reset();
      tagged = false;
      expect(
        await verifyRoadmap(target(), deployed(), { polls: 3, pollMs: 0 }),
      ).toEqual([
        'roadmap: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"',
      ]);
      expect(looks()).toBe(1);
    });

    it('fails a status other than 200 at once, without waiting', async () => {
      reset();
      roadmapStatus = 503;
      expect(
        await verifyRoadmap(target(), deployed(), { polls: 3, pollMs: 0 }),
      ).toEqual(['roadmap: /api/roadmap/health status 503, expected 200']);
      expect(looks()).toBe(1);
    });

    it('fails a request that fails outright at once, without waiting', async () => {
      reset();
      roadmapDrops = true;
      expect(
        await verifyRoadmap(target(), deployed(), { polls: 3, pollMs: 0 }),
      ).toEqual([
        `roadmap: request to ${new URL(ROADMAP, base).href} failed: fetch failed`,
      ]);
      expect(looks()).toBe(1);
    });

    // Every comparison with NaN is false, so a deploy time that is not a time
    // would pass the old code's record as the new code's.
    it('refuses a deploy time that is not a time', async () => {
      reset();
      await expect(
        verifyRoadmap(target(), Number.NaN, { polls: 3, pollMs: 0 }),
      ).rejects.toThrow('the deploy time must be a time, got NaN');
      expect(looks()).toBe(0);
    });

    it.each([0, 1.5])('refuses %s looks', async (polls) => {
      await expect(
        verifyRoadmap(target(), deployed(), { polls, pollMs: 0 }),
      ).rejects.toThrow(
        `polls must be a whole number of at least 1, got ${String(polls)}`,
      );
    });
  });

  const notServed = (polls: number) =>
    `the expected commit ${SHA} was not served on every page judged after ${String(polls)} looks 0 ms apart`;

  it('passes a gated site serving the expected commit, judging each check once', async () => {
    reset();
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    // The exact requests first: a floor that moved would otherwise stop the
    // test before they were checked (measured on #332).
    expect(seenUrls).toEqual([
      '/',
      '/',
      '/',
      '/health',
      ...SITE_PAGES,
      ...PREVIEW_PAGES.map((path) => `site:${path}`),
      '/robots.txt',
      STYLESHEET,
      SCRIPT,
      '/play/',
      'site:/',
      '/retired-game/',
    ]);
    expect(seenAuthorization).toEqual([
      '',
      basicAuthorization(`${PASSWORD}x`),
      basicAuthorization(PASSWORD),
      '',
      ...SITE_PAGES.map(() => basicAuthorization(PASSWORD)),
      ...PREVIEW_PAGES.map(() => basicAuthorization(PASSWORD)),
      '',
      basicAuthorization(PASSWORD),
      basicAuthorization(PASSWORD),
      '',
      '',
      '',
    ]);
    expect(searched(problems, { of: requests, what: 'probes' })).toEqual([]);
    expect(
      floorBreach('verify-dev/healthy-site-probes', requests),
    ).toBeUndefined();
  });

  it('checks Indonesian and the game at /play/ on the front door (#332 AC7, #673)', () => {
    expect(SITE_PAGES).toEqual(['/id/', '/play/']);
  });

  it('checks the site being built at its own address, roadmap included (#673)', () => {
    expect(PREVIEW_PAGES).toEqual(['/', '/id/', '/roadmap']);
  });

  it('fails a front door serving the site being built in place of the holding page (#673)', async () => {
    reset();
    plantSite = true;
    expect(await verifyDev(target(), { polls: 3, pollMs: 0 })).toEqual([
      'web: not the holding page: no data-coming-soon mark',
      'web /id/: not the holding page: no data-coming-soon mark',
      'web: no stylesheet in the page',
    ]);
  });

  it('fails a holding page whose stylesheet is not served (#673)', async () => {
    reset();
    styleStatus = 404;
    expect(await verifyDev(target(), { polls: 3, pollMs: 0 })).toEqual([
      `web ${STYLESHEET}: status 404 with the password, expected 200`,
    ]);
  });

  it('fails a site address serving the holding page in place of the site (#673)', async () => {
    reset();
    siteServesHolding = true;
    expect(await verifyDev(target(), { polls: 3, pollMs: 0 })).toEqual(
      PREVIEW_PAGES.map(
        (path) =>
          `site ${path}: not the site being built: no data-dev-strip mark`,
      ),
    );
  });

  it('fails a site address the gate does not cover (#673)', async () => {
    reset();
    ungatedSite = true;
    expect(await verifyDev(target(), { polls: 3, pollMs: 0 })).toEqual([
      'site without credentials: answered 200, expected 401; the password gate is not in front of it',
      'site without credentials: no Basic WWW-Authenticate challenge',
      'site without credentials: the response carries app markup',
    ]);
  });

  it('fails when the retired game address still serves the game (#332)', async () => {
    reset();
    retiredServes = true;
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    expect(problems).toEqual([
      "game address: answered 200; the game is reachable around the site's gate",
      'game address: the response carries the game',
    ]);
  });

  it('fails a page still serving an old commit after the last look, naming it (#581)', async () => {
    reset();
    stalePath = '/roadmap';
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    expect(problems).toEqual([
      notServed(3),
      `site /roadmap: serves commit ${OLD}, expected ${SHA}`,
    ]);
    expect(requests, 'three looks of nine probes').toBe(27);
  });

  it('waits while one page still serves the old commit, then judges it once (#581)', async () => {
    reset();
    stalePath = '/roadmap';
    stalePathLooks = 2;
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    // The exact count first: a floor that moved would otherwise stop the
    // test before it ran (measured on #332).
    // The roadmap's health is no longer among the last look's probes: its
    // own job judges it once a check after the deploy exists (#708).
    expect(requests, 'two looks of nine probes, then one of fifteen').toBe(33);
    expect(searched(problems, { of: requests, what: 'probes' })).toEqual([]);
    expect(
      floorBreach('verify-dev/stale-page-probes', requests),
    ).toBeUndefined();
  });

  it('fails at once when a page answers an error while the home page is current (#581)', async () => {
    reset();
    failPath = '/roadmap';
    expect(await verifyDev(target(), { polls: 3, pollMs: 0 })).toEqual([
      'site /roadmap: status 500 with the password, expected 200',
    ]);
    expect(requests, 'one look of nine probes').toBe(9);
  });

  it('fails a game the gate does not cover', async () => {
    reset();
    ungatedPath = '/play/';
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    expect(problems).toEqual([
      'game without credentials: answered 200, expected 401; the password gate is not in front of it',
      'game without credentials: no Basic WWW-Authenticate challenge',
      'game without credentials: the response carries app markup',
    ]);
  });

  it('fails a game script served as something other than JavaScript', async () => {
    reset();
    scriptType = 'text/html; charset=utf-8';
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    expect(problems).toEqual([
      `web ${SCRIPT}: Content-Type is "text/html; charset=utf-8", expected text/javascript`,
    ]);
  });

  it('fails a game shell that names no script', async () => {
    reset();
    noScript = true;
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    expect(problems).toEqual(['web /play/: no game script in the page']);
  });

  it('names the game shell and script served without the game’s policy (#123)', async () => {
    reset();
    policyServed = false;
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    const expected = JSON.stringify(CONTENT_SECURITY_POLICY);
    expect(problems).toEqual([
      `web /play/: Content-Security-Policy is null, expected ${expected}`,
      `web ${SCRIPT}: Content-Security-Policy is null, expected ${expected}`,
    ]);
  });

  it('fails at once, without another look, when the gate is gone', async () => {
    reset();
    gated = false;
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    expect(problems).toContain(
      'web without credentials: answered 200, expected 401; the password gate is not in front of it',
    );
    expect(problems).toContain(
      'web with a wrong password: answered 200, expected 401; the password gate is not in front of it',
    );
    expect(requests, 'the two gate probes of the first look').toBe(2);
  });

  it('waits for a stale deploy to turn current, then judges it once', async () => {
    reset();
    staleLooks = 2;
    const problems = await verifyDev(target(), { polls: 5, pollMs: 0 });
    // The exact count first: a floor that moved would otherwise stop the
    // test before it ran (measured on #332).
    expect(
      requests,
      'two stale looks of four probes, then one of fifteen',
    ).toBe(23);
    expect(searched(problems, { of: requests, what: 'probes' })).toEqual([]);
    expect(
      floorBreach('verify-dev/stale-site-probes', requests),
    ).toBeUndefined();
  });

  it('fails a deploy still stale after the last look, naming each host’s commit', async () => {
    reset();
    served = OLD;
    expect(await verifyDev(target(), { polls: 3, pollMs: 0 })).toEqual([
      notServed(3),
      `web: serves commit ${OLD}, expected ${SHA}`,
      `sync: /health serves commit ${OLD}, expected ${SHA}`,
    ]);
    expect(requests, 'three looks of four probes').toBe(12);
  });

  it('fails at once when the page answers an error while the deploy is stale', async () => {
    reset();
    staleLooks = 5;
    authorisedStatus = 500;
    expect(await verifyDev(target(), { polls: 3, pollMs: 0 })).toEqual([
      'web: status 500 with the password, expected 200',
    ]);
    expect(requests, 'one look of four probes').toBe(4);
  });

  it('fails at once on a leak while the deploy is still stale', async () => {
    reset();
    gated = false;
    served = OLD;
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    expect(problems).toContain(
      'web without credentials: answered 200, expected 401; the password gate is not in front of it',
    );
    expect(requests, 'the two gate probes of the first look').toBe(2);
  });

  it('fails a flaky gate that answers wrongly once, with no second look', async () => {
    reset();
    redirectGateOnce = true;
    expect(await verifyDev(target(), { polls: 3, pollMs: 0 })).toEqual([
      'web without credentials: answered 302, expected 401; the password gate is not in front of it',
      'web without credentials: no Basic WWW-Authenticate challenge',
    ]);
    expect(requests, 'one look of fifteen probes').toBe(15);
  });

  it('fails at once when a host that has answered drops a connection', async () => {
    reset();
    staleLooks = 1;
    dropAuthorisedAt = 2;
    const problems = await verifyDev(target(), { polls: 5, pollMs: 0 });
    expect(problems).toEqual([
      expect.stringMatching(new RegExp(`^web: request to ${base}/ failed: `)),
    ]);
    expect(requests, 'one stale look, then the look that dropped').toBe(8);
  });

  it('fails at once when robots.txt drops its connection, with no second look', async () => {
    reset();
    dropRobots = true;
    const problems = await verifyDev(target(), { polls: 3, pollMs: 0 });
    expect(problems).toEqual([
      expect.stringMatching(
        new RegExp(`^robots\\.txt: request to ${base}/robots\\.txt failed: `),
      ),
    ]);
    expect(requests, 'one look of fifteen probes').toBe(15);
  });

  it('fails when the noindex header is missing everywhere', async () => {
    reset();
    tagged = false;
    expect(await verifyDev(target(), { polls: 1, pollMs: 0 })).toEqual([
      'web: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"',
      'sync: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"',
      ...SITE_PAGES.map(
        (path) =>
          `web ${path}: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"`,
      ),
      ...PREVIEW_PAGES.map(
        (path) =>
          `site ${path}: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"`,
      ),
      `web ${STYLESHEET}: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"`,
      `web ${SCRIPT}: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"`,
    ]);
  });

  it('refuses a wait of no looks', async () => {
    await expect(verifyDev(target(), { polls: 0, pollMs: 0 })).rejects.toThrow(
      'polls must be a whole number of at least 1, got 0',
    );
  });

  /** An origin that refuses connections: a port that was free a moment ago. */
  async function closedOrigin(): Promise<string> {
    const closed = createServer();
    await new Promise<void>((resolve) =>
      closed.listen(0, '127.0.0.1', resolve),
    );
    const port = String((closed.address() as AddressInfo).port);
    await new Promise((resolve) => closed.close(resolve));
    return `http://127.0.0.1:${port}`;
  }

  it('waits on a host that has never answered, then names its failure', async () => {
    reset();
    const unreachable = `${await closedOrigin()}/`;
    const problems = await verifyDev(
      { ...target(), webUrl: unreachable },
      { polls: 2, pollMs: 0 },
    );
    expect(problems).toEqual([
      notServed(2),
      expect.stringMatching(
        new RegExp(`^web: request to ${unreachable} failed: `),
      ),
    ]);
    expect(requests, 'the sync host, looked at twice').toBe(2);
  });

  it('never puts the password in a problem', async () => {
    const once = { polls: 1, pollMs: 0 };
    reset();
    gated = false;
    const leaking = await verifyDev(target(), once);
    reset();
    served = OLD;
    const stale = await verifyDev(target(), once);
    reset();
    tagged = false;
    const untagged = await verifyDev(target(), once);
    const origin = await closedOrigin();
    const unreachable = await verifyDev(
      { ...target(), webUrl: `${origin}/`, syncUrl: origin },
      once,
    );
    // The roadmap's own job (#708): its ceiling, and a failed request.
    reset();
    const deployedAt = Date.now() + 60_000;
    const roadmapWaited = await verifyRoadmap(target(), deployedAt, once);
    const roadmapUnreachable = await verifyRoadmap(
      { ...target(), webUrl: `${origin}/` },
      deployedAt,
      once,
    );
    // Every kind of message: a judged leak, a wait, judged answers, failed requests.
    expect(leaking).toHaveLength(6);
    expect(stale).toHaveLength(3);
    expect(untagged).toHaveLength(9);
    expect(unreachable).toHaveLength(3);
    expect(roadmapWaited).toHaveLength(2);
    expect(roadmapUnreachable).toHaveLength(1);
    const reported = [
      ...leaking,
      ...stale,
      ...untagged,
      ...unreachable,
      ...roadmapWaited,
      ...roadmapUnreachable,
    ];
    const credential = basicAuthorization(PASSWORD).slice(6);
    const showingPassword = reported.filter((p) => p.includes(PASSWORD));
    const showingCredential = reported.filter((p) => p.includes(credential));
    expect(
      searched(showingPassword, { of: reported, what: 'reported problems' }),
    ).toEqual([]);
    expect(
      searched(showingCredential, { of: reported, what: 'reported problems' }),
    ).toEqual([]);
    expect(
      floorBreach('verify-dev/broken-site-problems', reported.length),
    ).toBeUndefined();
  });
});
