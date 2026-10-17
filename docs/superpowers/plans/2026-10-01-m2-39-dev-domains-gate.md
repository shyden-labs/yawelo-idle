# M2 #39: Dev on shyden.co.uk Custom Domains, Behind the Dev Password — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Wordfarer's dev web app at `https://dev.wordfarer.shyden.co.uk` and its sync API at `https://dev-api.wordfarer.shyden.co.uk`, with the web app behind the shared Shyden Labs dev password (HTTP Basic, ported from shyden.co.uk), then retire the `*.workers.dev` addresses and Cloudflare Access.

**Architecture:** A new workspace package, `packages/lockdown`, holds the gate: exact, case-insensitive production-hostname matching, a blocking `robots.txt`, Basic auth with a constant-time compare, and the noindex header. The dev web Worker gains a script that runs before its static assets (`run_worker_first`), so no asset is served without the password; the sync Worker marks non-prod responses noindex and asks for no password (operator decision). Both Workers are attached to their hostnames as Workers Custom Domains in `wrangler.jsonc`, and `scripts/verify-dev.ts` proves the gate live on every `develop` deploy.

**Tech Stack:** Node 24, npm workspaces, TypeScript 6.0, Vitest 4.1, wrangler 4.145 (`createTestHarness`, `unstable_readConfig`), `@cloudflare/vitest-pool-workers` 0.22 (sync Worker only), Cloudflare Workers static assets and Custom Domains, GitHub Actions environments.

**Spec:** issue #39 (story, context, operator decisions, 12 ACs) and its comment of 2026-10-01 13:33 UTC (measurements and the token decision); parent spec `docs/superpowers/specs/2026-10-01-wordfarer-design.md` D9 and §6.7, which Task 4 amends.

## Global Constraints

- Node `>=24`; npm workspaces. Zero warnings: Prettier, ESLint `--max-warnings 0`, `tsc` and `svelte-check --fail-on-warnings`, the build (spec §12).
- **The password value never appears** in the repo, an issue, a PR, a plan, a handover, a log or memory: the repo is public. Shyden types it into the two secret stores himself; the agent's GitHub App has no `secrets` permission (#39).
- The gate is ported from shyden.co.uk `functions/_lib/lockdown.js` and `functions/_middleware.js` at `26b80e2` and names that source. Read access to shyden.co.uk is authorised for this purpose only; never its board, ShyTalk's, or the ShyTalk roadmap.
- The web Worker's gate is tested **through Cloudflare's asset router** (wrangler's `createTestHarness`), never through vitest-pool-workers' `exports.default.fetch` or `SELF`: measured, both call the Worker below the router and stayed green with `run_worker_first: false` (Task 2).
- Tests are written first and seen red against stubs, each test failing on its own; every guard is mutation-verified with its result predicted in writing first.
- No new GitHub Action is added, so every `uses:` stays SHA-pinned as it is; Dependabot already covers npm and `github-actions` (`tests/unit/supply-chain.test.ts`).
- Commit messages and PR bodies say `Refs #39`; never put close/fix/resolve next to an issue number. Commits are authored as Shyden.

## Operator steps (Shyden), and when

The agent cannot do these: its App has no `secrets` permission, and the token belongs to Shyden's Cloudflare login. Each is needed **before PR A merges**, because the merge deploys and verifies at once.

1. **Widen the CI token** (decided 2026-10-01, #39 comment): in the Cloudflare dashboard, open My Profile → API Tokens, edit "wordfarer dev deploy (Workers+D1)", add the permission **Zone · Workers Routes · Edit** with its zone resources limited to **the `shyden.co.uk` zone only**, and save. Editing permissions is expected to keep the token's value (not measured here); if the dashboard shows a new value after saving, put it in the `dev` environment secret `CLOUDFLARE_API_TOKEN` as well.
2. **The Worker secret:** in **your own terminal**, not through a `!` command in the agent's session (whatever runs there lands in its transcript), from the repo root (it has no `wrangler.jsonc`, so wrangler takes the Worker from the flag), run `npx wrangler secret put DEV_PASSWORD --name wordfarer-web-dev` and paste the shared dev password at the prompt. Measured 2026-10-01: the secrets API already answers for this Worker (`wrangler secret list --name wordfarer-web-dev` returned `[]`).
3. **The GitHub secret:** repo Settings → Environments → `dev` → Environment secrets → Add environment secret, name `DEV_BASIC_AUTH_PASSWORD`, the same password. Environment-scoped, never repo-level (`tests/unit/workflow-secrets.test.ts` enforces it).

Each one missing at merge fails safe, and differently: without step 1, attaching the Custom Domains needs a permission the token lacks (Cloudflare's documentation; not measured here), so `wrangler deploy` is expected to fail and the `deploy` job to go red; without step 2, the gate answers 401 to everyone (it fails closed) and the verify reports `web: status 401 with the password`; without step 3, the verify stops at `DEV_BASIC_AUTH_PASSWORD is not set`. In every case `dev-verified` is not posted. Do the missing step and re-run the failed jobs.

## Review Focus

1. **The first deploy before the password is set.** A tester expects a locked site, not an open one. `basicAuthOk` rejects everything when `DEV_PASSWORD` is unset or empty (Task 1, M1.3), and the verify fails rather than passes (Task 4).
2. **A request for a real built file that skips the gate.** Cloudflare serves a matching asset without running a Worker unless `run_worker_first` is set; a tester would expect no game bytes before the password. Task 2 requests a built `/assets/*.js` through the asset router (M2.1), and Task 3's config guard pins the setting (M3.3).
3. **A hostname that looks like production.** `WORDFARER.shyden.co.uk`, `dev.wordfarer.shyden.co.uk`, `wordfarer.shyden.co.uk.evil.com`, `evilwordfarer.shyden.co.uk` and `api.wordfarer.shyden.co.uk` on the web gate: exactly one is production. Task 1 (M1.1, M1.2).
4. **A new Custom Domain's certificate not ready on the first deploy.** A tester expects the pipeline to wait, not fail. The verify makes up to 18 attempts, 10 s apart, retrying every check except a leak, which fails at once (Task 4: the dropped-connection and gate-gone tests, M4.1).
5. **The password in a CI log.** Every verify problem message is checked for the password and its base64 form across leaked, broken and unreachable runs (Task 4, M4.6); GitHub masks the secret as well.

## Acceptance criteria → tasks (#39)

| AC  | What                                                                | Task              | Proved by                                                                                           |
| --- | ------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| 1   | the `shyden.co.uk` zone read back on the deploy account             | Finishing         | read 2026-10-01 13:20 UTC (#39 comment); re-read and quoted in PR A                                 |
| 2   | both dev Workers on their Custom Domains with valid TLS             | 2, 3, Finishing   | `dev-config.test.ts`; the live verify fetches both over HTTPS                                       |
| 3   | the lockdown module and the web gate                                | 1, 2              | `lockdown.test.ts` (M1.1 to M1.11), `apps/web/test/gate.test.ts` (M2.1, M2.2)                       |
| 4   | the sync Worker marked noindex, not password-gated                  | 1, 3              | `markApiRequest` tests, `health.test.ts` (M3.1)                                                     |
| 5   | tests first; the edge list; no asset bytes without the password     | 1 to 5            | every red step; M2.1                                                                                |
| 6   | `verify-dev.ts` proves the gate, the commit, robots, D1 and noindex | 4, Finishing      | `verify-dev.test.ts` (M4.1 to M4.6); the first `develop` deploy                                     |
| 7   | the password only in two secret stores; no `vars` declare it        | 3, operator steps | `dev-config.test.ts` (M3.4)                                                                         |
| 8   | `workers_dev: false`; the old URLs no longer serve the app          | 5, Finishing      | `dev-config.test.ts` (M5.1, M5.2); a live probe after PR B deploys                                  |
| 9   | Access application, service token and `CF_ACCESS_*` secrets retired | 4, Finishing      | `deploy-dev.yml` stops reading them (Task 4); each deletion confirmed by a re-read                  |
| 10  | D9, §6.7, README and `HANDOVER.md` record hostnames, gate, secrets  | 4, Finishing      | the Task 4 doc changes; the handover at the end                                                     |
| 11  | prod hostnames are constants only                                   | 1                 | `PROD_HOSTNAME`, `PROD_API_HOSTNAME`; no prod route anywhere (`dev-config.test.ts` pins each route) |
| 12  | zero warnings; SHA-pinned; supply-chain green; develop deploys      | every task        | each stage's gate; CI on each PR                                                                    |

## How this plan was reviewed

A block labelled `(change)` is a unified diff against the previous task's tree, shown for reading: Prettier trims the single space that marks a blank context line, so make the change by hand rather than with `git apply`. A block labelled `(stub)` is the red-step file.

The plan was reviewed by **executing it**. The whole ticket was prototyped in a scratch worktree on `develop` `ac596ce`, then rebuilt as one cumulative commit per task (a stage), each taken file for file from the prototype with `package-lock.json` regenerated, and the last stage asserted identical to the prototype. Each stage was checked out on its own, installed with a clean `npm ci`, and run through every CI step; each task's final tests were run against its stubs; every guard was mutated at its own task's stage, with the result predicted in writing first. Every code block below is generated from those stage commits (`git show <stage>:<path>`) or the stub files, never typed, and checked byte for byte after Prettier.

- **Pass 1 (execution)** (2026-10-01). 13 found and fixed. **Measured facts that changed the design:** (1) a gate test on `@cloudflare/vitest-pool-workers` stayed 6/6 green with `run_worker_first: false`, through `exports.default.fetch` and again through `SELF`: both call the Worker below the asset router. wrangler's `createTestHarness` goes through it; with the setting off it served an unauthenticated built script (200, 22,882 bytes), with it on 401 and 111 bytes. The web gate test is a Node test on the harness, and the web app has no pool dependency; (2) `wrangler`'s `Config` type does not resolve (`TS2307 Cannot find module '@cloudflare/workers-utils'` under `--skipLibCheck false`), so `unstable_readConfig`'s result linted as an error type: the config guard narrows it from `unknown`; (3) the Workers types make `ignoreBOM` required in `TextDecoder` options: passed as its default, `false`; (4) the source compared the password with `===`, matched `Basic` case-sensitively and decoded the credentials as Latin-1: the port compares SHA-256 digests in constant time, follows RFC 7617 on the scheme, and decodes UTF-8, each pinned by a test (M1.5, M1.6, M1.7). **Tests that were wrong:** (5) the web gate test discovered the built script in `beforeAll`, and its red run reported `Tests 10 skipped (10)`: discovery moved into `builtScript()`, and the red run now fails all 10 on their own; (6) the password-leak test covered only judged messages, never the request-failure message built from the request's own inputs (found writing M4.6): it now runs a leaking, a broken and an unreachable site and counts each one's problems. **Tooling:** (7) the stage builder committed the prototype's generated `worker-configuration.d.ts` into Task 1, because `develop`'s `.gitignore` does not list it: the builder deletes it and asserts a clean base; Task 1's mutations had to run with it moved aside for the same reason; (8) `gate.sh` printed only the last `Tests` line, hiding the sync suite behind the web one: it prints every suite; (9) `red.py` read Vite's `✓ built in 94ms` as a test passing at red: excluded; (10) widening the D9 cell made Prettier re-pad the whole decisions table, a 40-line diff for one sentence: the amendment is a note below the table; (11) the unit count rose by one at Task 2 with no new root test file: measured by diffing the sorted test lists, it is `lint-ignores.test.ts` deriving a case from the new `.gitignore` line. **My own predictions:** (12) I wrote M4.7's prediction as 13 passed in the same command that first printed the file's total, 15: corrected to 14 before the run; (13) M4.4 and M4.5 were predicted before finding 6 made the password test count problems, so both caught one test more than predicted (recorded in the Task 4 table, not rewritten). **Mutations:** 26 run at their own stages, all caught, 24 as predicted. **Red runs:** 6, all as predicted (`red-predictions.txt`). **Gates, each stage alone after a clean `npm ci`:** format, lint, typecheck, unit (359, 360, 364, 381, 382), Worker (10 at Task 1; 10 sync and 10 web at Task 2; 14 and 10 from Task 3), build: all pass.
- **Pass 2** (2026-10-01). Mechanical: all 36 generated code blocks equal their stage or stub byte for byte, and the checker reports a planted one-character change (`apx.` for `api.` in Task 1's module: 1 differs, exit 1); every root `npm run` script named exists, and `test` and `types` exist in both Worker workspaces; every name in an Interfaces block is exported; no placeholders. Re-run to check a claim: Task 2's red run prints one shared `Error: not implemented` block under all 10 `FAIL` headers (`[1/10]`). A full read of the prose and tables found 9: (1) operator step 2 said to run `wrangler secret put` through a `!` command, which would put the password prompt through the agent's transcript: it is now Shyden's own terminal; (2) "if any of the three is missing … the gate answers 401" held only for the Worker secret: each missing step's failure is now stated, and the token one is marked as documented rather than measured; (3) a dashboard button label ("Add more") I had not seen: removed; (4) "3 minutes" for the verify's retries: now 18 attempts, 10 s apart; (5) the mutation tables showed file basenames, and M3.4's anchor (`"preview_urls": false,`) occurs in both `wrangler.jsonc` files: the tables show full paths; (6) Task 4's red text allowed a cause the run never reported: narrowed to `Error: not implemented`; (7) Finishing named a Zero Trust menu path I had not checked: it names the objects to delete; (8) a secret scanner refused to read the plan because M3.4's row set `DEV_PASSWORD` to a made-up literal: the mutation now sets it to an empty string, which tests the same name check, and was re-run (1 failed, 3 passed, as predicted); (9) nothing said where the plan is committed: Finishing step 2.
- **Pass 3** (2026-10-01). Mechanical checks re-run after regeneration: 36 blocks equal, Prettier clean. Read: every passage pass 2 changed, as rendered, and the rewritten table rows (full paths, `⏎` breaks). Found 1: operator step 1 asserted that editing a token's permissions keeps its value, which I had not measured; it now says what to do if the value changes.
- **Pass 4** (2026-10-01). Mechanical checks re-run: 36 blocks equal, Prettier clean. Read: a `diff` against the text pass 3 read shows only operator step 1 and pass 3's entry, both read in full; `CLOUDFLARE_API_TOKEN` is confirmed a `dev` environment secret (`deploy-dev.yml` reads it in a `dev`-environment job, which `workflow-secrets.test.ts` enforces). **No findings: plan approved** under the house rule.

---

### Task 1: The lockdown module

**Files:**

- Create: `packages/lockdown/package.json`, `packages/lockdown/tsconfig.json`, `packages/lockdown/src/index.ts`
- Test: `packages/lockdown/test/lockdown.test.ts` (the root suite already includes `packages/*/test/**/*.test.ts`)

**Interfaces:**

- Produces, from `@wordfarer/lockdown`: `PROD_HOSTNAME`, `PROD_API_HOSTNAME`, `NO_INDEX`, `REALM`, `BLOCKING_ROBOTS_TXT` (strings); `type Serve = (request: Request) => Promise<Response>`; `isProdHost(hostname: string, prodHostname: string): boolean`; `basicAuthOk(authorization: string | null, expected: string | undefined): Promise<boolean>`; `robotsResponse(): Response`; `challengeResponse(): Response`; `withNoIndex(response: Response): Response`; `gateWebRequest(request: Request, password: string | undefined, serve: Serve): Promise<Response>`; `markApiRequest(request: Request, serve: Serve): Promise<Response>`.

- [ ] **Step 1: Create the workspace**

`packages/lockdown/package.json`:

```json
{
  "name": "@wordfarer/lockdown",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

`packages/lockdown/tsconfig.json`:

```json
{
  // @wordfarer/lockdown runs in workerd (the dev Workers) and in Node (its
  // unit tests), so it sees only the web platform APIs both share: fetch
  // types, atob, TextEncoder/TextDecoder and crypto.subtle. `types: []` keeps
  // the hoisted @types/node out, so a Node-only API cannot typecheck here.
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "WebWorker"],
    "types": [],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Then `npm install` (no warnings), which links `node_modules/@wordfarer/lockdown`.

- [ ] **Step 2: Write the failing tests**

`packages/lockdown/test/lockdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BLOCKING_ROBOTS_TXT,
  NO_INDEX,
  PROD_API_HOSTNAME,
  PROD_HOSTNAME,
  basicAuthOk,
  gateWebRequest,
  isProdHost,
  markApiRequest,
  type Serve,
} from '../src/index';

const PASSWORD = 'correct horse';

/** `Basic <base64 of user:password>`, encoding the text as UTF-8 first. */
function basic(credentials: string): string {
  const bytes = new TextEncoder().encode(credentials);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

/** A `serve` that records each call and answers with a recognisable body. */
function recordingServe(): { serve: Serve; calls: string[] } {
  const calls: string[] = [];
  const serve: Serve = (request) => {
    calls.push(request.url);
    return Promise.resolve(
      new Response('<!doctype html><title>app bytes</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html', ETag: '"v1"' },
      }),
    );
  };
  return { serve, calls };
}

function request(url: string, authorization?: string): Request {
  return new Request(
    url,
    authorization === undefined ? {} : { headers: { authorization } },
  );
}

describe('isProdHost', () => {
  it('matches the production hostnames exactly', () => {
    expect(PROD_HOSTNAME).toBe('wordfarer.shyden.co.uk');
    expect(PROD_API_HOSTNAME).toBe('api.wordfarer.shyden.co.uk');
    expect(isProdHost('wordfarer.shyden.co.uk', PROD_HOSTNAME)).toBe(true);
    expect(isProdHost('api.wordfarer.shyden.co.uk', PROD_API_HOSTNAME)).toBe(
      true,
    );
  });

  it('ignores case, as DNS does', () => {
    expect(isProdHost('WordFarer.Shyden.CO.UK', PROD_HOSTNAME)).toBe(true);
  });

  it.each([
    'dev.wordfarer.shyden.co.uk',
    'wordfarer.shyden.co.uk.evil.com',
    'evilwordfarer.shyden.co.uk',
    'wordfarer.shyden.co',
    'api.wordfarer.shyden.co.uk',
    '',
  ])('refuses the near-miss %j', (hostname) => {
    expect(isProdHost(hostname, PROD_HOSTNAME)).toBe(false);
  });
});

describe('basicAuthOk', () => {
  it('accepts the right password with any username', async () => {
    expect(await basicAuthOk(basic(`tester:${PASSWORD}`), PASSWORD)).toBe(true);
    expect(await basicAuthOk(basic(`:${PASSWORD}`), PASSWORD)).toBe(true);
  });

  it('matches the Basic scheme case-insensitively (RFC 7617)', async () => {
    const token = basic(`u:${PASSWORD}`).slice('Basic '.length);
    expect(await basicAuthOk(`basic ${token}`, PASSWORD)).toBe(true);
    expect(await basicAuthOk(`BASIC ${token}`, PASSWORD)).toBe(true);
  });

  it('compares a password containing a colon intact', async () => {
    expect(await basicAuthOk(basic('u:a:b:c'), 'a:b:c')).toBe(true);
    expect(await basicAuthOk(basic('u:a:b:c'), 'b:c')).toBe(false);
  });

  it('decodes the credentials as UTF-8', async () => {
    expect(await basicAuthOk(basic('u:pässwörd ✓'), 'pässwörd ✓')).toBe(true);
  });

  it.each([
    ['a wrong password', basic('u:wrong')],
    ['the password with a trailing space', basic(`u:${PASSWORD} `)],
    ['a prefix of the password', basic(`u:${PASSWORD.slice(0, -1)}`)],
    ['the password as the username', basic(`${PASSWORD}:`)],
    ['no colon', basic(PASSWORD)],
    ['a non-Basic scheme', `Bearer ${basic(`u:${PASSWORD}`).slice(6)}`],
    ['a scheme with no token', 'Basic'],
    ['an empty token', 'Basic '],
    ['a whitespace token', 'Basic    '],
    ['invalid base64', 'Basic !!!not-base64!!!'],
    ['base64 of invalid UTF-8', `Basic ${btoa('u:\xff\xfe')}`],
  ])('rejects %s', async (_case, header) => {
    expect(await basicAuthOk(header, PASSWORD)).toBe(false);
  });

  it('rejects a missing header', async () => {
    expect(await basicAuthOk(null, PASSWORD)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['undefined', undefined],
  ])(
    'fails closed when the expected password is %s',
    async (_case, expected) => {
      expect(await basicAuthOk(basic('u:'), expected)).toBe(false);
      expect(await basicAuthOk(basic('u:anything'), expected)).toBe(false);
    },
  );
});

describe('gateWebRequest', () => {
  const dev = 'https://dev.wordfarer.shyden.co.uk';

  it('serves the production host untouched, without asking for a password', async () => {
    const { serve, calls } = recordingServe();
    const response = await gateWebRequest(
      request('https://WORDFARER.shyden.co.uk/index.html'),
      undefined,
      serve,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBeNull();
    expect(calls).toEqual(['https://wordfarer.shyden.co.uk/index.html']);
  });

  it.each([
    ['no credentials', undefined],
    ['a wrong password', basic('u:wrong')],
  ])(
    'challenges %s on a non-prod host and never serves',
    async (_case, authorization) => {
      const { serve, calls } = recordingServe();
      const response = await gateWebRequest(
        request(`${dev}/`, authorization),
        PASSWORD,
        serve,
      );
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Basic realm="Wordfarer Non-Prod"',
      );
      expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
      expect(await response.text()).not.toContain('app bytes');
      expect(calls).toEqual([]);
    },
  );

  it('challenges every request when the password is not configured', async () => {
    const { serve, calls } = recordingServe();
    const response = await gateWebRequest(
      request(`${dev}/`, basic('u:')),
      undefined,
      serve,
    );
    expect(response.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('serves blocking robots.txt on a non-prod host without credentials', async () => {
    const { serve, calls } = recordingServe();
    const response = await gateWebRequest(
      request(`${dev}/robots.txt`),
      PASSWORD,
      serve,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
    expect(BLOCKING_ROBOTS_TXT).toContain('User-agent: *\nDisallow: /\n');
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(calls).toEqual([]);
  });

  it('serves an authorised request with noindex added and the rest kept', async () => {
    const { serve, calls } = recordingServe();
    const response = await gateWebRequest(
      request(`${dev}/assets/app.js`, basic(`tester:${PASSWORD}`)),
      PASSWORD,
      serve,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(response.headers.get('ETag')).toBe('"v1"');
    expect(await response.text()).toContain('app bytes');
    expect(calls).toEqual([`${dev}/assets/app.js`]);
  });
});

describe('markApiRequest', () => {
  it('adds noindex to every response on a non-prod host, with no password', async () => {
    const { serve, calls } = recordingServe();
    const response = await markApiRequest(
      request('https://dev-api.wordfarer.shyden.co.uk/health'),
      serve,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(calls).toHaveLength(1);
  });

  it('serves blocking robots.txt on a non-prod host', async () => {
    const { serve, calls } = recordingServe();
    const response = await markApiRequest(
      request('https://dev-api.wordfarer.shyden.co.uk/robots.txt'),
      serve,
    );
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
    expect(calls).toEqual([]);
  });

  it('leaves the production API host untouched, robots.txt included', async () => {
    const { serve, calls } = recordingServe();
    for (const path of ['/health', '/robots.txt']) {
      const response = await markApiRequest(
        request(`https://api.wordfarer.shyden.co.uk${path}`),
        serve,
      );
      expect(response.headers.get('X-Robots-Tag')).toBeNull();
    }
    expect(calls).toHaveLength(2);
  });
});
```

- [ ] **Step 3: See them fail against the stub**

`packages/lockdown/src/index.ts` (stub):

```ts
// Red stub for T1: every export exists with its final type; every function
// throws and every constant is a value no test accepts.
export const PROD_HOSTNAME = 'stub';
export const PROD_API_HOSTNAME = 'stub';
export const NO_INDEX = 'stub';
export const REALM = 'stub';
export const BLOCKING_ROBOTS_TXT = 'stub';
export type Serve = (request: Request) => Promise<Response>;
const stub = (): never => {
  throw new Error('not implemented');
};
export function isProdHost(_hostname: string, _prodHostname: string): boolean {
  return stub();
}
export function basicAuthOk(
  _authorization: string | null,
  _expected: string | undefined,
): Promise<boolean> {
  return stub();
}
export function robotsResponse(): Response {
  return stub();
}
export function challengeResponse(): Response {
  return stub();
}
export function withNoIndex(_response: Response): Response {
  return stub();
}
export function gateWebRequest(
  _request: Request,
  _password: string | undefined,
  _serve: Serve,
): Promise<Response> {
  return stub();
}
export function markApiRequest(_request: Request, _serve: Serve): Promise<Response> {
  return stub();
}
```

Run: `npx vitest run packages/lockdown`
Expected (measured): `Tests 35 failed (35)`; every failure is `Error: not implemented` except `matches the production hostnames exactly`, which fails on `expected 'stub' to be 'wordfarer.shyden.co.uk'`.

- [ ] **Step 4: Implement**

`packages/lockdown/src/index.ts`:

```ts
/**
 * The non-prod lockdown for Wordfarer's Workers (#39).
 *
 * Ported from shyden.co.uk `functions/_lib/lockdown.js` and
 * `functions/_middleware.js` at 26b80e2, which ShyTalk shares. The behaviour
 * is the same: an exact, case-insensitive match on the production hostname
 * passes through untouched; every other host serves a blocking robots.txt
 * publicly and puts everything else behind HTTP Basic auth against one shared
 * password, failing closed when that password is not configured.
 *
 * Three deliberate differences from the source:
 * - the password is compared in constant time (SHA-256 both, then XOR-fold
 *   the digests), using only APIs that workerd and Node share;
 * - the `Basic` scheme is matched case-insensitively (RFC 7617 §2);
 * - the credentials are decoded as UTF-8, as browsers send them, so a
 *   password with non-ASCII characters can match.
 *
 * The sync API is not password-gated (operator decision, 2026-10-01): native
 * apps cannot answer a browser challenge. On non-prod hosts it carries the
 * noindex header and the blocking robots.txt only, as ShyTalk's API does.
 */

/** The production web hostname. Attaching it is the production pipeline's job. */
export const PROD_HOSTNAME = 'wordfarer.shyden.co.uk';

/** The production sync API hostname. */
export const PROD_API_HOSTNAME = 'api.wordfarer.shyden.co.uk';

/** Sent on every non-prod response: no index, no link crawl, no cached copy. */
export const NO_INDEX = 'noindex, nofollow, noarchive';

/** The realm a browser shows in its password prompt. */
export const REALM = 'Wordfarer Non-Prod';

/** The robots.txt every non-prod host serves, without credentials. */
export const BLOCKING_ROBOTS_TXT = [
  '# A non-prod Wordfarer environment, blocked from indexing.',
  '# The public robots.txt is served only on wordfarer.shyden.co.uk.',
  'User-agent: *',
  'Disallow: /',
  '',
].join('\n');

/** Serves a request once the gate has let it through. */
export type Serve = (request: Request) => Promise<Response>;

/**
 * True only when `hostname` is exactly `prodHostname`, ignoring case (DNS
 * does). Exact equality, never a prefix or suffix test, so neither
 * `dev.wordfarer.shyden.co.uk` nor `wordfarer.shyden.co.uk.evil.com` passes.
 */
export function isProdHost(hostname: string, prodHostname: string): boolean {
  return hostname.length > 0 && hostname.toLowerCase() === prodHostname;
}

/** Decodes standard base64 to UTF-8 text, or null if it is not both. */
function decodeBase64Utf8(encoded: string): string | null {
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    return null;
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
      bytes,
    );
  } catch {
    return null;
  }
}

/**
 * Compares two strings in time that depends on neither their contents nor
 * their lengths: both are hashed to 32 bytes, and every byte pair is folded
 * into one accumulator before the single comparison at the end.
 */
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [given, expected].map(
      async (text) =>
        new Uint8Array(
          await crypto.subtle.digest('SHA-256', encoder.encode(text)),
        ),
    ),
  );
  if (a === undefined || b === undefined) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return difference === 0;
}

/**
 * Whether an `Authorization` header carries Basic credentials whose password
 * is `expected`. The username is ignored (one shared secret), and the password
 * is everything after the FIRST colon, so a password containing `:` compares
 * intact.
 *
 * Fails closed: an unset or empty `expected` rejects every request, so a
 * deploy whose secret is missing stays locked rather than open.
 */
export async function basicAuthOk(
  authorization: string | null,
  expected: string | undefined,
): Promise<boolean> {
  if (expected === undefined || expected === '') return false;
  if (authorization === null) return false;
  const space = authorization.indexOf(' ');
  if (space < 0) return false;
  if (authorization.slice(0, space).toLowerCase() !== 'basic') return false;
  const token = authorization.slice(space + 1).trim();
  if (token === '') return false;
  const decoded = decodeBase64Utf8(token);
  if (decoded === null) return false;
  const colon = decoded.indexOf(':');
  if (colon < 0) return false;
  return sameSecret(decoded.slice(colon + 1), expected);
}

/** The blocking robots.txt, served on non-prod hosts without credentials. */
export function robotsResponse(): Response {
  return new Response(BLOCKING_ROBOTS_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': NO_INDEX,
    },
  });
}

/** The 401 that makes a browser show its password prompt. No app bytes. */
export function challengeResponse(): Response {
  return new Response(
    'This is a non-prod Wordfarer environment for authorised testers. ' +
      'The game is at https://wordfarer.shyden.co.uk.',
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Basic realm="${REALM}"`,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': NO_INDEX,
      },
    },
  );
}

/** A copy of `response` with the noindex header set; status and body kept. */
export function withNoIndex(response: Response): Response {
  const tagged = new Response(response.body, response);
  tagged.headers.set('X-Robots-Tag', NO_INDEX);
  return tagged;
}

/**
 * The web Worker's gate. On the production host the request is served
 * untouched. On any other host `/robots.txt` is public and blocking, a
 * request without the password gets the challenge (and never reaches
 * `serve`, so no asset bytes leave), and an authorised one is served with
 * the noindex header added.
 */
export async function gateWebRequest(
  request: Request,
  password: string | undefined,
  serve: Serve,
): Promise<Response> {
  const { hostname, pathname } = new URL(request.url);
  if (isProdHost(hostname, PROD_HOSTNAME)) return serve(request);
  if (pathname === '/robots.txt') return robotsResponse();
  if (!(await basicAuthOk(request.headers.get('Authorization'), password))) {
    return challengeResponse();
  }
  return withNoIndex(await serve(request));
}

/**
 * The sync Worker's marking, with no password (operator decision). On the
 * production API host the request is served untouched; on any other host
 * `/robots.txt` is blocking and every other response carries noindex.
 */
export async function markApiRequest(
  request: Request,
  serve: Serve,
): Promise<Response> {
  const { hostname, pathname } = new URL(request.url);
  if (isProdHost(hostname, PROD_API_HOSTNAME)) return serve(request);
  if (pathname === '/robots.txt') return robotsResponse();
  return withNoIndex(await serve(request));
}
```

- [ ] **Step 5: See them pass**

Run: `npx vitest run packages/lockdown`
Expected: `Tests 35 passed (35)`.

- [ ] **Step 6: Commit**

```bash
git add packages/lockdown package-lock.json
git commit -m "feat(lockdown): non-prod gate module, ported from shyden.co.uk (Refs #39)"
```

- [ ] **Step 7: Mutations**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run packages/lockdown` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `⏎` marks a line break and `(deleted)` means the line is removed.

| Id    | File                             | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Predicted (written first)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Result       |
| ----- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| M1.1  | `packages/lockdown/src/index.ts` | `hostname.toLowerCase() === prodHostname;` → `hostname.toLowerCase().endsWith(prodHostname);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 10 failed (refuses the near-miss "dev.wordfarer.shyden.co.uk"; refuses the near-miss "evilwordfarer.shyden.co.uk"; refuses the near-miss "api.wordfarer.shyden.co.uk"; challenges no credentials on a non-prod host; challenges a wrong password on a non-prod host; challenges every request when the password is not configured; serves blocking robots.txt on a non-prod host without credentials; serves an authorised request with noindex added; adds noindex to every response on a non-prod host; serves blocking robots.txt on a non-prod host), 25 passed | as predicted |
| M1.2  | `packages/lockdown/src/index.ts` | `hostname.toLowerCase() === prodHostname;` → `hostname === prodHostname;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 1 failed (ignores case, as DNS does), 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | as predicted |
| M1.3  | `packages/lockdown/src/index.ts` | `if (expected === undefined \|\| expected === '') return false;` → `if (expected === undefined) return false;`                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 1 failed (fails closed when the expected password is empty), 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | as predicted |
| M1.4  | `packages/lockdown/src/index.ts` | `return sameSecret(decoded.slice(colon + 1), expected);` → `return sameSecret(decoded.split(':')[1] ?? '', expected);`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 1 failed (compares a password containing a colon intact), 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | as predicted |
| M1.5  | `packages/lockdown/src/index.ts` | `if (authorization.slice(0, space).toLowerCase() !== 'basic') return false;` → `if (authorization.slice(0, space) !== 'Basic') return false;`                                                                                                                                                                                                                                                                                                                                                                                                                                | 1 failed (matches the Basic scheme case-insensitively), 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | as predicted |
| M1.6  | `packages/lockdown/src/index.ts` | `  try {⏎    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(⏎      bytes,⏎    );⏎  } catch {⏎    return null;⏎  }` → `  return bytes.length >= 0 ? binary : null;`                                                                                                                                                                                                                                                                                                                                                                                | 1 failed (decodes the credentials as UTF-8), 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | as predicted |
| M1.7  | `packages/lockdown/src/index.ts` | `  return difference === 0;` → `  return difference >= 0;`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 6 failed (rejects a wrong password; rejects the password with a trailing space; rejects a prefix of the password; rejects the password as the username; compares a password containing a colon intact; challenges a wrong password on a non-prod host), 29 passed                                                                                                                                                                                                                                                                                                   | as predicted |
| M1.8  | `packages/lockdown/src/index.ts` | `  if (isProdHost(hostname, PROD_HOSTNAME)) return serve(request);⏎  if (pathname === '/robots.txt') return robotsResponse();⏎  if (!(await basicAuthOk(request.headers.get('Authorization'), password))) {⏎    return challengeResponse();⏎  }⏎  return withNoIndex(await serve(request));⏎}` → `  if (isProdHost(hostname, PROD_HOSTNAME)) return serve(request);⏎  if (!(await basicAuthOk(request.headers.get('Authorization'), password))) {⏎    return challengeResponse();⏎  }⏎  return withNoIndex(await serve(request));⏎}`                                         | 1 failed (serves blocking robots.txt on a non-prod host without credentials), 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | as predicted |
| M1.9  | `packages/lockdown/src/index.ts` | `  if (isProdHost(hostname, PROD_HOSTNAME)) return serve(request);⏎  if (pathname === '/robots.txt') return robotsResponse();⏎  if (!(await basicAuthOk(request.headers.get('Authorization'), password))) {⏎    return challengeResponse();⏎  }⏎  return withNoIndex(await serve(request));⏎}` → `  if (isProdHost(hostname, PROD_HOSTNAME)) return serve(request);⏎  if (pathname === '/robots.txt') return robotsResponse();⏎  if (!(await basicAuthOk(request.headers.get('Authorization'), password))) {⏎    return challengeResponse();⏎  }⏎  return serve(request);⏎}` | 1 failed (serves an authorised request with noindex added), 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | as predicted |
| M1.10 | `packages/lockdown/src/index.ts` | `const tagged = new Response(response.body, response);` → `const tagged = new Response(response.body);`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 1 failed (serves an authorised request with noindex added), 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | as predicted |
| M1.11 | `packages/lockdown/src/index.ts` | `if (isProdHost(hostname, PROD_API_HOSTNAME)) return serve(request);` → `if (isProdHost(hostname, PROD_HOSTNAME)) return serve(request);`                                                                                                                                                                                                                                                                                                                                                                                                                                    | 1 failed (leaves the production API host untouched), 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | as predicted |

- [ ] **Step 8: Gate**

Run, in order: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:worker`, `npm run build`. Expected (measured at this stage after a clean `npm ci`): all pass; unit `Tests 359 passed (359)`, Worker `Tests 10 passed (10)`.

---

### Task 2: The gated dev web Worker

**Files:**

- Create: `apps/web/worker/index.ts`, `apps/web/worker/tsconfig.json`, `apps/web/vitest.gate.config.ts`, `apps/web/test/gate.test.ts`
- Modify: `apps/web/wrangler.jsonc`, `apps/web/package.json`, `apps/web/tsconfig.json`, `vitest.config.ts`, `package.json`, `.gitignore`, `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: `gateWebRequest`, `NO_INDEX`, `BLOCKING_ROBOTS_TXT` from Task 1.
- Produces: the `wordfarer-web-dev` Worker entry `apps/web/worker/index.ts`, reading the secret `DEV_PASSWORD` and the binding `ASSETS`; the web workspace's `test` script (build, then the gate tests); the root `test:worker` running both Workers' suites.

**Why a harness and not vitest-pool-workers:** the first version of this test used `exports.default.fetch` and then `SELF`; both stayed 6/6 green with `run_worker_first: false`, because they call the Worker's handler below the asset router. `createTestHarness` dispatches through the server, so the router decides whether the Worker runs, exactly as on Cloudflare. Measured with the setting off: an unauthenticated request for the built script got **200 and all 22,882 bytes**; with it on, 401 and 111 bytes.

- [ ] **Step 1: Configure the Worker, its types and the test runner**

`apps/web/wrangler.jsonc` (change):

```diff
diff --git a/apps/web/wrangler.jsonc b/apps/web/wrangler.jsonc
index 0bffc91..fef34ff 100644
--- a/apps/web/wrangler.jsonc
+++ b/apps/web/wrangler.jsonc
@@ -1,14 +1,25 @@
-// The DEV web app: a Worker with static assets and no script (spec D9, as
-// amended 2026-10-01: Cloudflare now folds Pages into Workers). Requests for
-// static assets are free and do not count as Worker invocations.
+// The DEV web app: a Worker with static assets (spec D9, as amended
+// 2026-10-01: Cloudflare now folds Pages into Workers), served at
+// dev.wordfarer.shyden.co.uk behind the shared dev password (#39).
+//
+// Cloudflare serves a matching asset WITHOUT invoking a Worker unless
+// `run_worker_first` is set, so the gate in worker/index.ts would never see
+// the request. Here it is set, and every request pays one invocation; the
+// future production config can stay script-less and keep asset requests free.
 {
   "$schema": "../../node_modules/wrangler/config-schema.json",
   "name": "wordfarer-web-dev",
+  "main": "worker/index.ts",
   "compatibility_date": "2026-09-30",
   "workers_dev": true,
   "preview_urls": false,
+  "routes": [
+    { "pattern": "dev.wordfarer.shyden.co.uk", "custom_domain": true },
+  ],
   "assets": {
     "directory": "./dist",
+    "binding": "ASSETS",
+    "run_worker_first": true,
     // A PWA routes on the client, so an unknown path serves index.html.
     "not_found_handling": "single-page-application",
   },
```

`apps/web/worker/tsconfig.json`:

```json
{
  // The dev web Worker. Separate from ../tsconfig.json, which types the Svelte
  // app for the browser: this one sees the Workers runtime (generated by
  // `wrangler types`) and nothing from the DOM.
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2024"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["./worker-configuration.d.ts"]
  },
  "include": ["*.ts"]
}
```

`apps/web/package.json` (change):

```diff
diff --git a/apps/web/package.json b/apps/web/package.json
index 4e90148..41dfb09 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -5,7 +5,9 @@
   "type": "module",
   "scripts": {
     "build": "vite build",
-    "typecheck": "svelte-check --tsconfig ./tsconfig.json --fail-on-warnings"
+    "typecheck": "svelte-check --tsconfig ./tsconfig.json --fail-on-warnings && tsc --noEmit -p worker",
+    "test": "vite build && vitest run -c vitest.gate.config.ts",
+    "types": "wrangler types worker/worker-configuration.d.ts --strict-vars=false"
   },
   "devDependencies": {
     "@sveltejs/vite-plugin-svelte": "^7.3.1",
@@ -13,5 +15,8 @@
     "svelte": "^5.57.1",
     "svelte-check": "^4.7.6",
     "vite": "^8.3.1"
+  },
+  "dependencies": {
+    "@wordfarer/lockdown": "*"
   }
 }
```

`apps/web/tsconfig.json` (change):

```diff
diff --git a/apps/web/tsconfig.json b/apps/web/tsconfig.json
index 578b193..2948e7b 100644
--- a/apps/web/tsconfig.json
+++ b/apps/web/tsconfig.json
@@ -13,5 +13,5 @@
     "allowImportingTsExtensions": true,
     "types": ["vite/client"]
   },
-  "include": ["src/**/*.ts", "src/**/*.svelte", "*.ts"]
+  "include": ["src/**/*.ts", "src/**/*.svelte", "test/**/*.ts", "*.ts"]
 }
```

`apps/web/vitest.gate.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

/**
 * The dev web Worker's gate tests (#39). They run in Node and drive wrangler's
 * test harness, which serves the Worker from the real wrangler.jsonc through
 * Cloudflare's asset router, the layer `run_worker_first` configures. The
 * assets are ./dist, so `npm run test` builds the app first.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    hookTimeout: 60_000,
  },
});
```

`vitest.config.ts` (change):

```diff
diff --git a/vitest.config.ts b/vitest.config.ts
index 8affcb9..a037810 100644
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@ -12,6 +12,8 @@ export default defineConfig({
       'apps/web/**/*.test.ts',
       'packages/*/test/**/*.test.ts',
     ],
-    exclude: ['**/node_modules/**', '**/dist/**'],
+    // apps/web/test drives the built dev Worker through wrangler's harness,
+    // so it runs after a build, under the web workspace's own config.
+    exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/test/**'],
   },
 });
```

`package.json` (change):

```diff
diff --git a/package.json b/package.json
index 5143b99..fd0792d 100644
--- a/package.json
+++ b/package.json
@@ -11,9 +11,9 @@
     "packages/*"
   ],
   "scripts": {
-    "postinstall": "npm run types --workspace @wordfarer/sync-worker",
+    "postinstall": "npm run types --workspace @wordfarer/sync-worker --workspace @wordfarer/web",
     "test:unit": "vitest run",
-    "test:worker": "npm run test --workspace @wordfarer/sync-worker",
+    "test:worker": "npm run test --workspace @wordfarer/sync-worker --workspace @wordfarer/web",
     "test:engines": "playwright test -c playwright.engines.config.ts",
     "lint": "eslint . --max-warnings 0",
     "typecheck": "tsc --noEmit && npm run typecheck --workspaces --if-present",
```

`.gitignore` (change):

```diff
diff --git a/.gitignore b/.gitignore
index d8ff855..e9b1f9c 100644
--- a/.gitignore
+++ b/.gitignore
@@ -15,6 +15,7 @@ test-results/
 .dev.vars
 # Generated on install by `wrangler types` (root postinstall)
 apps/sync-worker/worker-configuration.d.ts
+apps/web/worker/worker-configuration.d.ts

 # Session-local agent files (brainstorm mockups, SDD scratch)
 .superpowers/
```

`.github/workflows/ci.yml` (change):

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 35747c0..eab11de 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -34,7 +34,7 @@ jobs:
         run: npm run typecheck
       - name: Unit tests
         run: npm run test:unit
-      - name: Worker tests (workerd + local D1)
+      - name: Worker tests (sync in workerd + local D1, web gate through the asset router)
         run: npm run test:worker
       - name: Browsers for the cross-engine check
         run: npx playwright install --with-deps chromium firefox webkit
```

Then `npm install` (no warnings): its `postinstall` now also runs `wrangler types` for the web Worker, writing the git-ignored `apps/web/worker/worker-configuration.d.ts`.

- [ ] **Step 2: Write the failing tests**

`apps/web/test/gate.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from 'wrangler';
import { BLOCKING_ROBOTS_TXT, NO_INDEX } from '@wordfarer/lockdown';

/**
 * The dev web Worker, served by wrangler's test harness from the real
 * wrangler.jsonc and the built ./dist. Requests go through the server, so
 * Cloudflare's asset router decides whether the Worker runs at all: this is
 * the layer `run_worker_first` configures, and the only one where its absence
 * shows. (vitest-pool-workers' `exports.default.fetch` and `SELF` call the
 * Worker directly, below the router; measured 2026-10-01, both stayed green
 * with `run_worker_first: false`.)
 *
 * Absolute URLs set the hostname the Worker sees.
 */
const DEV = 'https://dev.wordfarer.shyden.co.uk';
const PROD = 'https://wordfarer.shyden.co.uk';
const PASSWORD = 'test-only-password';

const authorised = { Authorization: `Basic ${btoa(`tester:${PASSWORD}`)}` };
const wrong = { Authorization: `Basic ${btoa('tester:not-it')}` };

const server = createTestHarness({
  root: new URL('..', import.meta.url).pathname,
  workers: [
    { configPath: './wrangler.jsonc', secrets: { DEV_PASSWORD: PASSWORD } },
  ],
});

const get = (url: string, headers: Record<string, string> = {}) =>
  server.fetch(url, { headers });

beforeAll(async () => {
  await server.listen();
});

/**
 * The built script dist/index.html loads, read through the gate with the
 * password. Found once and shared, but inside the tests that need it, so a
 * broken Worker fails each test on its own instead of skipping them all.
 */
let script: Promise<{ path: string; body: string }> | undefined;
function builtScript(): Promise<{ path: string; body: string }> {
  script ??= (async () => {
    const html = await (await get(`${DEV}/`, authorised)).text();
    const path =
      /<script[^>]+src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1] ?? '';
    const body = await (await get(`${DEV}${path}`, authorised)).text();
    return { path, body };
  })();
  return script;
}

afterAll(async () => {
  await server.close();
});

describe('the dev web Worker gate, through the asset router', () => {
  it('found a real built script to probe (liveness)', async () => {
    const { path, body } = await builtScript();
    expect(path).toMatch(/^\/assets\/.+\.js$/);
    expect(body.length).toBeGreaterThan(1000);
  });

  it('serves the app with the password, noindex added', async () => {
    const response = await get(`${DEV}/`, authorised);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
    expect(await response.text()).toContain('<meta name="wordfarer-commit"');
  });

  it.each([
    ['without credentials', {}],
    ['with a wrong password', wrong],
  ])(
    'refuses a real built asset %s and sends none of its bytes',
    async (_case, headers) => {
      const { path, body: scriptBody } = await builtScript();
      const response = await get(`${DEV}${path}`, headers);
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Basic realm="Wordfarer Non-Prod"',
      );
      expect(response.headers.get('X-Robots-Tag')).toBe(NO_INDEX);
      const body = await response.text();
      expect(body).not.toContain(scriptBody.slice(0, 200));
      expect(body.length).toBeLessThan(200);
    },
  );

  it.each(['/', '/index.html', '/some/client/route'])(
    'refuses the page %s without credentials',
    async (path) => {
      const response = await get(`${DEV}${path}`);
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain('<');
    },
  );

  it('serves blocking robots.txt without credentials', async () => {
    const response = await get(`${DEV}/robots.txt`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(BLOCKING_ROBOTS_TXT);
  });

  it('serves index.html for a client route once authorised', async () => {
    const response = await get(`${DEV}/some/client/route`, authorised);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<meta name="wordfarer-commit"');
  });

  it('passes the production host through untouched', async () => {
    const { path, body } = await builtScript();
    const response = await get(`${PROD}${path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBeNull();
    expect(await response.text()).toBe(body);
  });
});
```

- [ ] **Step 3: See them fail against the stub**

`apps/web/worker/index.ts` (stub):

```ts
// Red stub for T2: the Worker exists, and every request throws.
export default {
  fetch(): Promise<Response> {
    throw new Error('not implemented');
  },
} satisfies ExportedHandler<Env>;
```

Run: `npm test --workspace @wordfarer/web`
Expected (measured): `Tests 10 failed (10)`, each test on its own (none skipped). Vitest prints one shared error block under all 10 `FAIL` headers: `Error: not implemented`, thrown by the stub Worker. A first version discovered the built script in `beforeAll`; against this stub that reported `Tests 10 skipped (10)`, so discovery moved into `builtScript()`, which each test awaits.

- [ ] **Step 4: Implement**

`apps/web/worker/index.ts`:

```ts
/**
 * The dev web Worker: every request passes the non-prod gate (#39) before the
 * static assets are served. `DEV_PASSWORD` is a Worker secret, set by Shyden
 * with `wrangler secret put`; when it is missing the gate fails closed.
 */
import { gateWebRequest } from '@wordfarer/lockdown';

interface GateEnv extends Env {
  /** A secret, so `wrangler types` cannot see it; absent means locked. */
  readonly DEV_PASSWORD?: string;
}

export default {
  fetch(request, env): Promise<Response> {
    return gateWebRequest(request, env.DEV_PASSWORD, (allowed) =>
      env.ASSETS.fetch(allowed),
    );
  },
} satisfies ExportedHandler<GateEnv>;
```

- [ ] **Step 5: See them pass**

Run: `npm test --workspace @wordfarer/web`
Expected: `Tests 10 passed (10)`.

- [ ] **Step 6: Commit**

```bash
git add apps/web vitest.config.ts package.json package-lock.json .gitignore .github/workflows/ci.yml
git commit -m "feat(web): gate the dev web Worker before its assets (Refs #39)"
```

- [ ] **Step 7: Mutations**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npm test --workspace @wordfarer/web` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `⏎` marks a line break and `(deleted)` means the line is removed.

| Id   | File                       | Change                                                                             | Predicted (written first)                                                                                                                                                                                                                                                                       | Result       |
| ---- | -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| M2.1 | `apps/web/wrangler.jsonc`  | `"run_worker_first": true,` → `"run_worker_first": false,`                         | 2 failed (refuses a real built asset without credentials; refuses a real built asset with a wrong password), 8 passed                                                                                                                                                                           | as predicted |
| M2.2 | `apps/web/worker/index.ts` | `gateWebRequest(request, env.DEV_PASSWORD,` → `gateWebRequest(request, undefined,` | 6 failed (found a real built script to probe; serves the app with the password; refuses a real built asset without credentials; refuses a real built asset with a wrong password; serves index.html for a client route once authorised; passes the production host through untouched), 4 passed | as predicted |

M2.1 is the one that matters most: it is the defect the pool-based test could not see. The page-path tests (`/`, `/index.html`, a client route) stay green under it; measured, the router still sent those to the Worker, so only a built asset path tells the setting's absence apart.

- [ ] **Step 8: Gate**

As Task 1. Expected (measured): unit `Tests 360 passed (360)`, Worker `Tests 10 passed (10)` (sync) and `Tests 10 passed (10)` (web). The one new unit test is generated by `lint-ignores.test.ts` from the new `.gitignore` line.

---

### Task 3: The sync Worker's marking, and the config guard

**Files:**

- Modify: `apps/sync-worker/src/index.ts`, `apps/sync-worker/wrangler.jsonc`, `apps/sync-worker/package.json`
- Test: `apps/sync-worker/test/health.test.ts`, `tests/unit/dev-config.test.ts` (new)

**Interfaces:**

- Consumes: `markApiRequest` from Task 1.
- Produces: `readDeployConfig(path)` and `wranglerConfigs()` local to `tests/unit/dev-config.test.ts`, which Task 5 extends with `workers_dev`.

`unstable_readConfig` reads a config the way `wrangler deploy` does, so a comment can neither satisfy nor trip these guards. Its return type does not resolve (wrangler bundles `@cloudflare/workers-utils` without its declarations: `tsc --skipLibCheck false` reports `TS2307 Cannot find module '@cloudflare/workers-utils'`), so the test narrows it from `unknown` to a local shape.

- [ ] **Step 1: Write the failing tests**

`apps/sync-worker/test/health.test.ts` (change):

```diff
diff --git a/apps/sync-worker/test/health.test.ts b/apps/sync-worker/test/health.test.ts
index 56761cc..7748880 100644
--- a/apps/sync-worker/test/health.test.ts
+++ b/apps/sync-worker/test/health.test.ts
@@ -82,3 +82,43 @@ describe('GET /health', () => {
     },
   );
 });
+
+describe('non-prod marking (#39)', () => {
+  const host = (origin: string, path: string) =>
+    exports.default.fetch(new Request(`${origin}${path}`));
+
+  it.each(['/health', '/missing'])(
+    'marks %s noindex on the dev API host, with no password asked',
+    async (path) => {
+      const response = await host(
+        'https://dev-api.wordfarer.shyden.co.uk',
+        path,
+      );
+      expect(response.status).not.toBe(401);
+      expect(response.headers.get('x-robots-tag')).toBe(
+        'noindex, nofollow, noarchive',
+      );
+    },
+  );
+
+  it('serves blocking robots.txt on the dev API host', async () => {
+    const response = await host(
+      'https://dev-api.wordfarer.shyden.co.uk',
+      '/robots.txt',
+    );
+    expect(response.status).toBe(200);
+    expect(await response.text()).toContain('User-agent: *\nDisallow: /\n');
+  });
+
+  it('leaves the production API host unmarked, robots.txt included', async () => {
+    const health = await host('https://api.wordfarer.shyden.co.uk', '/health');
+    expect(health.status).toBe(200);
+    expect(health.headers.get('x-robots-tag')).toBeNull();
+    const robots = await host(
+      'https://api.wordfarer.shyden.co.uk',
+      '/robots.txt',
+    );
+    expect(robots.status).toBe(404);
+    expect(robots.headers.get('x-robots-tag')).toBeNull();
+  });
+});
```

`tests/unit/dev-config.test.ts`:

```ts
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig } from 'wrangler';

/**
 * The dev Workers' deploy configs, read the way `wrangler deploy` reads them
 * (comments stripped, defaults applied), so no comment can satisfy or trip a
 * guard (#39 AC2, AC7).
 */
const ROOT = new URL('../..', import.meta.url).pathname;

/**
 * The fields these guards read, declared here rather than imported: wrangler's
 * own `Config` type comes from `@cloudflare/workers-utils`, which it bundles
 * without shipping its declarations, so it does not resolve.
 */
interface DeployConfig {
  name: string;
  main: string | undefined;
  routes: unknown;
  assets: Record<string, unknown> | undefined;
  vars: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readDeployConfig(path: string): DeployConfig {
  const raw: unknown = unstable_readConfig({ config: path });
  if (!isRecord(raw)) throw new Error(`${path}: not a config object`);
  const { name, main, routes, assets, vars } = raw;
  if (typeof name !== 'string') throw new Error(`${path}: no name`);
  if (main !== undefined && typeof main !== 'string')
    throw new Error(`${path}: main is not a path`);
  if (assets !== undefined && !isRecord(assets))
    throw new Error(`${path}: assets is not an object`);
  if (!isRecord(vars)) throw new Error(`${path}: vars is not an object`);
  return { name, main, routes, assets, vars };
}

/** Every wrangler config in the repo, found on disk rather than listed. */
function wranglerConfigs(dir = ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return wranglerConfigs(path);
    return /^wrangler\.(jsonc?|toml)$/.test(entry.name) ? [path] : [];
  });
}

const configs = wranglerConfigs().map((path) => ({
  file: relative(ROOT, path),
  config: readDeployConfig(path),
}));

function byName(name: string): DeployConfig {
  const found = configs.find(({ config }) => config.name === name);
  if (found === undefined) throw new Error(`no wrangler config named ${name}`);
  return found.config;
}

describe('the dev Workers’ deploy configs', () => {
  it('finds both dev Workers on disk (liveness)', () => {
    expect(configs.map(({ file }) => file).sort()).toEqual([
      'apps/sync-worker/wrangler.jsonc',
      'apps/web/wrangler.jsonc',
    ]);
  });

  it('serves the web Worker at its dev Custom Domain, gate first', () => {
    const web = byName('wordfarer-web-dev');
    expect(web.routes).toEqual([
      { pattern: 'dev.wordfarer.shyden.co.uk', custom_domain: true },
    ]);
    expect(web.main).toMatch(/apps\/web\/worker\/index\.ts$/);
    expect(web.assets).toMatchObject({
      binding: 'ASSETS',
      run_worker_first: true,
    });
  });

  it('serves the sync Worker at its dev Custom Domain', () => {
    expect(byName('wordfarer-sync-dev').routes).toEqual([
      { pattern: 'dev-api.wordfarer.shyden.co.uk', custom_domain: true },
    ]);
  });

  it('declares no secret as a plain var (the password is a Worker secret)', () => {
    const declared = configs.flatMap(({ file, config }) =>
      Object.keys(config.vars).map((name) => ({ file, name })),
    );
    expect(declared).toContainEqual({
      file: 'apps/sync-worker/wrangler.jsonc',
      name: 'COMMIT',
    });
    expect(
      declared.filter(({ name }) => /PASSWORD|SECRET|TOKEN|KEY/i.test(name)),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: See them fail**

The "stubs" are `develop`'s own files, before this task:

`apps/sync-worker/src/index.ts` (stub):

```ts
/**
 * The Wordfarer sync Worker. In M0 it serves one route, `GET /health`, which
 * the dev deploy's verify job reads to prove two things about the live Worker:
 * it is the commit that was just deployed, and its D1 binding answers a query.
 */

const json = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...headers },
  });

async function health(env: Env): Promise<Response> {
  try {
    await env.DB.prepare('SELECT 1').run();
  } catch (error) {
    // The response says only `unreachable`; the cause goes to the Worker logs.
    console.error('health: D1 query failed', error);
    return json({ ok: false, commit: env.COMMIT, db: 'unreachable' }, 503);
  }
  return json({ ok: true, commit: env.COMMIT, db: 'ok' }, 200);
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== '/health') {
      return json({ error: 'not_found' }, 404);
    }
    if (request.method !== 'GET') {
      return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
    }
    return health(env);
  },
} satisfies ExportedHandler<Env>;
```

`apps/sync-worker/wrangler.jsonc` (stub):

```
// The DEV sync Worker (spec §6.7). Production gets its own config when the
// production pipeline is built; until then this file describes dev only.
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "wordfarer-sync-dev",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-30",
  "workers_dev": true,
  "preview_urls": false,
  "vars": {
    // Overwritten at deploy time with `--var COMMIT:<sha>`, so /health can
    // prove which commit is live. "local" never matches a SHA.
    "COMMIT": "local",
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "wordfarer-dev",
      "database_id": "7ef754ed-f21e-4524-ac11-eac9bde28cc0",
      "migrations_dir": "migrations",
    },
  ],
}
```

Run: `npm test --workspace @wordfarer/sync-worker`
Expected (measured): `Tests 3 failed | 11 passed (14)`. The three are the two `marks … noindex on the dev API host` cases and `serves blocking robots.txt on the dev API host`. `leaves the production API host unmarked, robots.txt included` passes at red by design: `develop` already leaves every host unmarked, and M1.11 guards the prod pass-through.

Run: `npx vitest run tests/unit/dev-config.test.ts`
Expected (measured): `Tests 1 failed | 3 passed (4)`: `serves the sync Worker at its dev Custom Domain` fails on `expected undefined to deeply equal [ { … } ]`; the web route (Task 2), liveness and vars hold already.

- [ ] **Step 3: Implement**

`apps/sync-worker/src/index.ts` (change):

```diff
diff --git a/apps/sync-worker/src/index.ts b/apps/sync-worker/src/index.ts
index a7cf83b..855fd2c 100644
--- a/apps/sync-worker/src/index.ts
+++ b/apps/sync-worker/src/index.ts
@@ -2,7 +2,12 @@
  * The Wordfarer sync Worker. In M0 it serves one route, `GET /health`, which
  * the dev deploy's verify job reads to prove two things about the live Worker:
  * it is the commit that was just deployed, and its D1 binding answers a query.
+ *
+ * On any host but the production API host, every response carries the
+ * noindex header and `/robots.txt` blocks crawlers (#39). There is no password:
+ * native apps cannot answer a browser challenge (operator decision 2026-10-01).
  */
+import { markApiRequest } from '@wordfarer/lockdown';

 const json = (
   body: unknown,
@@ -25,15 +30,19 @@ async function health(env: Env): Promise<Response> {
   return json({ ok: true, commit: env.COMMIT, db: 'ok' }, 200);
 }

+async function route(request: Request, env: Env): Promise<Response> {
+  const { pathname } = new URL(request.url);
+  if (pathname !== '/health') {
+    return json({ error: 'not_found' }, 404);
+  }
+  if (request.method !== 'GET') {
+    return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
+  }
+  return health(env);
+}
+
 export default {
-  async fetch(request, env): Promise<Response> {
-    const { pathname } = new URL(request.url);
-    if (pathname !== '/health') {
-      return json({ error: 'not_found' }, 404);
-    }
-    if (request.method !== 'GET') {
-      return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
-    }
-    return health(env);
+  fetch(request, env): Promise<Response> {
+    return markApiRequest(request, (marked) => route(marked, env));
   },
 } satisfies ExportedHandler<Env>;
```

`apps/sync-worker/wrangler.jsonc` (change):

```diff
diff --git a/apps/sync-worker/wrangler.jsonc b/apps/sync-worker/wrangler.jsonc
index 72ae7d0..61ba0b8 100644
--- a/apps/sync-worker/wrangler.jsonc
+++ b/apps/sync-worker/wrangler.jsonc
@@ -7,6 +7,11 @@
   "compatibility_date": "2026-09-30",
   "workers_dev": true,
   "preview_urls": false,
+  // The sync API at dev-api.wordfarer.shyden.co.uk (#39). Not password-gated:
+  // the Worker marks non-prod responses noindex instead (src/index.ts).
+  "routes": [
+    { "pattern": "dev-api.wordfarer.shyden.co.uk", "custom_domain": true },
+  ],
   "vars": {
     // Overwritten at deploy time with `--var COMMIT:<sha>`, so /health can
     // prove which commit is live. "local" never matches a SHA.
```

`apps/sync-worker/package.json` (change):

```diff
diff --git a/apps/sync-worker/package.json b/apps/sync-worker/package.json
index 73cb0e0..18e274b 100644
--- a/apps/sync-worker/package.json
+++ b/apps/sync-worker/package.json
@@ -10,5 +10,8 @@
   },
   "devDependencies": {
     "@cloudflare/vitest-pool-workers": "^0.22.0"
+  },
+  "dependencies": {
+    "@wordfarer/lockdown": "*"
   }
 }
```

Then `npm install` (no warnings).

- [ ] **Step 4: See them pass**

Run: `npm test --workspace @wordfarer/sync-worker` → `Tests 14 passed (14)`; `npx vitest run tests/unit/dev-config.test.ts` → `Tests 4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
git add apps/sync-worker tests/unit/dev-config.test.ts package-lock.json
git commit -m "feat(sync): mark non-prod API responses noindex; dev Custom Domains guarded (Refs #39)"
```

- [ ] **Step 6: Mutations**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npm test --workspace @wordfarer/sync-worker` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `⏎` marks a line break and `(deleted)` means the line is removed.

| Id   | File                              | Change                                                                                                                                                        | Predicted (written first)                                                                                                                                   | Result       |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| M3.1 | `apps/sync-worker/src/index.ts`   | `return markApiRequest(request, (marked) => route(marked, env));` → `return route(request, env);`                                                             | 3 failed (marks /health noindex on the dev API host; marks /missing noindex on the dev API host; serves blocking robots.txt on the dev API host), 11 passed | as predicted |
| M3.2 | `apps/sync-worker/wrangler.jsonc` | `{ "pattern": "dev-api.wordfarer.shyden.co.uk", "custom_domain": true },` → `{ "pattern": "dev-api.wordfarer.shyden.co.uk/*", "zone_name": "shyden.co.uk" },` | `npx vitest run tests/unit/dev-config.test.ts`: 1 failed (serves the sync Worker at its dev Custom Domain), 3 passed                                        | as predicted |
| M3.3 | `apps/web/wrangler.jsonc`         | `"run_worker_first": true,` → `"run_worker_first": false,`                                                                                                    | `npx vitest run tests/unit/dev-config.test.ts`: 1 failed (serves the web Worker at its dev Custom Domain, gate first), 3 passed                             | as predicted |
| M3.4 | `apps/web/wrangler.jsonc`         | `  "preview_urls": false,` → `  "preview_urls": false,⏎  "vars": { "DEV_PASSWORD": "" },`                                                                     | `npx vitest run tests/unit/dev-config.test.ts`: 1 failed (declares no secret as a plain var), 3 passed                                                      | as predicted |

- [ ] **Step 7: Gate**

As Task 1. Expected (measured): unit `Tests 364 passed (364)`, Worker `Tests 14 passed (14)` and `Tests 10 passed (10)`.

---

### Task 4: Verify through the gate, deploy to the Custom Domains, document

**Files:**

- Modify: `scripts/verify-dev.ts` (rewritten), `.github/workflows/deploy-dev.yml`, `docs/superpowers/specs/2026-10-01-wordfarer-design.md`, `README.md`
- Test: `tests/unit/verify-dev.test.ts` (rewritten), `tests/unit/workflow-secrets.test.ts`

**Interfaces:**

- Produces, from `scripts/verify-dev.ts`: `interface Probe { status: number; headers: Headers; body: string }`, `interface Target { webUrl; syncUrl; sha; password: string }`, `NO_INDEX`, `basicAuthorization(password)`, `gateProblems(label, probe)`, `leaked(probe)`, `robotsProblems(probe)`, `webProblems(probe, sha)`, `healthProblems(probe, sha)`, `verifyDev(target, { attempts, delayMs }): Promise<string[]>`. It reads `DEV_WEB_URL`, `DEV_SYNC_URL`, `EXPECTED_SHA` and `DEV_BASIC_AUTH_PASSWORD`.

`deploy-dev.yml` stops reading `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` here, because nothing reads them any more: a secret reference nothing uses is dead config. Access itself stays in front of the `workers.dev` hostnames until Task 5 and the Finishing steps retire both.

- [ ] **Step 1: Write the failing tests**

`tests/unit/verify-dev.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  NO_INDEX,
  basicAuthorization,
  gateProblems,
  healthProblems,
  leaked,
  robotsProblems,
  verifyDev,
  webProblems,
  type Probe,
} from '../../scripts/verify-dev';

const SHA = 'd547bd669678987eb85b5807d1a26ea55eaeb987';
const OLD = '1f660b30f75d081ae6559d175e5c0c3e26acb84c';
const PASSWORD = 'pä:ss';
const ROBOTS = '# blocked\nUser-agent: *\nDisallow: /\n';
const page = (sha: string) =>
  `<!doctype html><html><head><meta name="wordfarer-commit" content="${sha}" /></head></html>`;
const probe = (
  status: number,
  body = '',
  headers: Record<string, string> = {},
): Probe => ({ status, body, headers: new Headers(headers) });
const challenge = { 'www-authenticate': 'Basic realm="Wordfarer Non-Prod"' };
const noindex = { 'x-robots-tag': NO_INDEX };

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
    expect(gateProblems('web', probe(401, 'testers only', challenge))).toEqual(
      [],
    );
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
    expect(robotsProblems(probe(200, ROBOTS))).toEqual([]);
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
    expect(webProblems(probe(200, page(SHA), noindex), SHA)).toEqual([]);
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
      'web: no wordfarer-commit meta tag in the page',
    ]);
    expect(webProblems(probe(401, '', noindex), SHA)).toEqual([
      'web: status 401 with the password, expected 200',
    ]);
  });
});

describe('healthProblems', () => {
  const healthy = JSON.stringify({ ok: true, commit: SHA, db: 'ok' });

  it('accepts ok, the commit, db ok and noindex', () => {
    expect(healthProblems(probe(200, healthy, noindex), SHA)).toEqual([]);
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

/**
 * verifyDev end to end over real HTTP: a local server stands in for both dev
 * hosts. `/health` is the ungated sync API; every other path is the web host,
 * which answers the Basic challenge unless the password is right, except
 * robots.txt. The `let`s below switch it between healthy and broken states.
 */
describe('verifyDev', () => {
  let server: Server;
  let base = '';
  let served = SHA;
  let gated = true;
  let tagged = true;
  let requests = 0;
  let dropAuthorised = 0;
  const seenAuthorization: string[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      requests += 1;
      const tag: Record<string, string> = tagged
        ? { 'x-robots-tag': NO_INDEX }
        : {};
      const authorization = req.headers.authorization ?? '';
      seenAuthorization.push(authorization);
      const authorised = authorization === basicAuthorization(PASSWORD);
      if (authorised && dropAuthorised > 0) {
        dropAuthorised -= 1;
        req.socket.destroy();
        return;
      }
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json', ...tag });
        res.end(JSON.stringify({ ok: true, commit: served, db: 'ok' }));
        return;
      }
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain', ...tag });
        res.end(ROBOTS);
        return;
      }
      if (gated && !authorised) {
        res.writeHead(401, { ...challenge, ...tag });
        res.end('testers only');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html', ...tag });
      res.end(page(served));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });

  afterAll(() => {
    server.close();
  });

  const target = () => ({
    webUrl: `${base}/`,
    syncUrl: base,
    sha: SHA,
    password: PASSWORD,
  });

  const reset = () => {
    served = SHA;
    gated = true;
    tagged = true;
    requests = 0;
    dropAuthorised = 0;
    seenAuthorization.length = 0;
  };

  it('passes a gated site serving the expected commit', async () => {
    reset();
    expect(await verifyDev(target(), { attempts: 1, delayMs: 0 })).toEqual([]);
    expect(
      requests,
      'no credentials, wrong password, robots, web, health',
    ).toBe(5);
    expect(seenAuthorization).toEqual([
      '',
      basicAuthorization(`${PASSWORD}x`),
      '',
      basicAuthorization(PASSWORD),
      '',
    ]);
  });

  it('fails at once, without retrying, when the gate is gone', async () => {
    reset();
    gated = false;
    const problems = await verifyDev(target(), { attempts: 3, delayMs: 0 });
    expect(problems).toContain(
      'web without credentials: answered 200, expected 401; the password gate is not in front of it',
    );
    expect(problems).toContain(
      'web with a wrong password: answered 200, expected 401; the password gate is not in front of it',
    );
    expect(requests, 'the two gate probes of one attempt').toBe(2);
  });

  it('retries a stale deploy, then reports both stale hosts', async () => {
    reset();
    served = OLD;
    const problems = await verifyDev(target(), { attempts: 3, delayMs: 0 });
    expect(problems).toEqual([
      `web: serves commit ${OLD}, expected ${SHA}`,
      `sync: /health returned ${JSON.stringify({ ok: true, commit: OLD, db: 'ok' })}, expected ${JSON.stringify({ ok: true, commit: SHA, db: 'ok' })}`,
    ]);
    expect(requests, 'three attempts of five probes').toBe(15);
  });

  it('fails when the noindex header is missing everywhere', async () => {
    reset();
    tagged = false;
    expect(await verifyDev(target(), { attempts: 1, delayMs: 0 })).toEqual([
      'web: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"',
      'sync: X-Robots-Tag is null, expected "noindex, nofollow, noarchive"',
    ]);
  });

  it('retries through a dropped connection instead of giving up', async () => {
    reset();
    dropAuthorised = 1;
    expect(await verifyDev(target(), { attempts: 3, delayMs: 0 })).toEqual([]);
    expect(requests, 'one attempt with a dropped web probe, one clean').toBe(
      10,
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

  it('reports an unreachable host as a problem, never a crash', async () => {
    reset();
    const unreachable = `${await closedOrigin()}/`;
    const problems = await verifyDev(
      { ...target(), webUrl: unreachable },
      { attempts: 1, delayMs: 0 },
    );
    expect(problems).toEqual([
      expect.stringMatching(
        new RegExp(
          `^web without credentials: request to ${unreachable} failed: `,
        ),
      ),
      expect.stringMatching(
        new RegExp(
          `^web with a wrong password: request to ${unreachable} failed: `,
        ),
      ),
      expect.stringMatching(/^robots\.txt: request to .+ failed: /),
      expect.stringMatching(
        new RegExp(`^web: request to ${unreachable} failed: `),
      ),
    ]);
  });

  it('never puts the password in a problem', async () => {
    const once = { attempts: 1, delayMs: 0 };
    reset();
    gated = false;
    const leaking = await verifyDev(target(), once);
    reset();
    served = OLD;
    tagged = false;
    const broken = await verifyDev(target(), once);
    const origin = await closedOrigin();
    const unreachable = await verifyDev(
      { ...target(), webUrl: `${origin}/`, syncUrl: origin },
      once,
    );
    // Every kind of message: a judged leak, judged answers, failed requests.
    expect(leaking).toHaveLength(6);
    expect(broken).toHaveLength(4);
    expect(unreachable).toHaveLength(5);
    for (const problem of [...leaking, ...broken, ...unreachable]) {
      expect(problem).not.toContain(PASSWORD);
      expect(problem).not.toContain(basicAuthorization(PASSWORD).slice(6));
    }
  });
});
```

`tests/unit/workflow-secrets.test.ts` (change):

```diff
diff --git a/tests/unit/workflow-secrets.test.ts b/tests/unit/workflow-secrets.test.ts
index f437cf2..cbecd0d 100644
--- a/tests/unit/workflow-secrets.test.ts
+++ b/tests/unit/workflow-secrets.test.ts
@@ -151,8 +151,8 @@ describe('this repo’s workflows keep every secret inside an environment', () =
     );
     expect(
       references,
-      'deploy-dev.yml reads four Cloudflare secrets',
-    ).toBeGreaterThanOrEqual(4);
+      'deploy-dev.yml reads two Cloudflare secrets and the dev password',
+    ).toBeGreaterThanOrEqual(3);
   });

   it('no secret is read outside a protected environment', () => {
```

- [ ] **Step 2: See them fail against the stub**

`scripts/verify-dev.ts` (stub):

```ts
// Red stub for T4: the final exports and types; every function throws.
export interface Probe {
  status: number;
  headers: Headers;
  body: string;
}
export interface Target {
  webUrl: string;
  syncUrl: string;
  sha: string;
  password: string;
}
export const NO_INDEX = 'stub';
const stub = (): never => {
  throw new Error('not implemented');
};
export function basicAuthorization(_password: string): string {
  return stub();
}
export function gateProblems(_label: string, _probe: Probe): string[] {
  return stub();
}
export function leaked(_probe: Probe): boolean {
  return stub();
}
export function robotsProblems(_probe: Probe): string[] {
  return stub();
}
export function webProblems(_probe: Probe, _sha: string): string[] {
  return stub();
}
export function healthProblems(_probe: Probe, _sha: string): string[] {
  return stub();
}
export function verifyDev(
  _target: Target,
  _options: { attempts: number; delayMs: number },
): Promise<string[]> {
  return stub();
}
```

Run: `npx vitest run tests/unit/verify-dev.test.ts`
Expected (measured): `Tests 36 failed (36)`, every failure on `Error: not implemented` (the only cause the run reports).

- [ ] **Step 3: Implement**

`scripts/verify-dev.ts`:

```ts
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
 * 3. With the password, the page carries `wordfarer-commit` = the expected SHA
 *    and the noindex header.
 * 4. The sync API's /health reports ok, that SHA and db "ok", with the
 *    noindex header (the API is not password-gated, by operator decision).
 *
 * Every check retries, because the previous deploy can be served for a few
 * seconds after an upload and a new Custom Domain's DNS and certificate can
 * take a minute on the first deploy. One thing never retries: a web response
 * that serves content WITHOUT the password. That is a leak, not a delay.
 *
 * The password is sent, never printed: no problem message carries a header.
 */

export interface Probe {
  status: number;
  headers: Headers;
  body: string;
}

export interface Target {
  webUrl: string;
  syncUrl: string;
  sha: string;
  password: string;
}

export const NO_INDEX = 'noindex, nofollow, noarchive';

const COMMIT_STAMP = /<meta name="wordfarer-commit" content="([^"]*)"/;

/** Any sign that a response carries the app rather than a challenge. */
const APP_MARKUP = /<(?:!doctype|html|meta|script)\b/i;

export function basicAuthorization(password: string): string {
  const bytes = new TextEncoder().encode(`verify-dev:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

/** Problems with a response that should be the password challenge. */
export function gateProblems(label: string, probe: Probe): string[] {
  const problems: string[] = [];
  if (probe.status !== 401) {
    problems.push(
      `${label}: answered ${String(probe.status)}, expected 401; the password gate is not in front of it`,
    );
  }
  if (!/^Basic /i.test(probe.headers.get('www-authenticate') ?? '')) {
    problems.push(`${label}: no Basic WWW-Authenticate challenge`);
  }
  if (APP_MARKUP.test(probe.body)) {
    problems.push(`${label}: the response carries app markup`);
  }
  return problems;
}

/** A gate probe that came back 2xx served content without the password. */
export function leaked(probe: Probe): boolean {
  return probe.status >= 200 && probe.status < 300;
}

export function robotsProblems(probe: Probe): string[] {
  if (probe.status !== 200)
    return [
      `robots.txt: status ${String(probe.status)} without credentials, expected 200`,
    ];
  return /^User-agent: \*\nDisallow: \/$/m.test(probe.body)
    ? []
    : ['robots.txt: does not block every crawler'];
}

function noIndexProblems(label: string, probe: Probe): string[] {
  const tag = probe.headers.get('x-robots-tag');
  return tag === NO_INDEX
    ? []
    : [
        `${label}: X-Robots-Tag is ${JSON.stringify(tag)}, expected "${NO_INDEX}"`,
      ];
}

export function webProblems(probe: Probe, sha: string): string[] {
  if (probe.status !== 200)
    return [
      `web: status ${String(probe.status)} with the password, expected 200`,
    ];
  const stamp = COMMIT_STAMP.exec(probe.body)?.[1];
  return [
    ...(stamp === undefined
      ? ['web: no wordfarer-commit meta tag in the page']
      : stamp === sha
        ? []
        : [`web: serves commit ${stamp}, expected ${sha}`]),
    ...noIndexProblems('web', probe),
  ];
}

export function healthProblems(probe: Probe, sha: string): string[] {
  if (probe.status !== 200)
    return [`sync: /health status ${String(probe.status)}, expected 200`];
  let body: unknown;
  try {
    body = JSON.parse(probe.body);
  } catch {
    return ['sync: /health did not return JSON'];
  }
  const expected = { ok: true, commit: sha, db: 'ok' };
  return [
    ...(JSON.stringify(body) === JSON.stringify(expected)
      ? []
      : [
          `sync: /health returned ${JSON.stringify(body)}, expected ${JSON.stringify(expected)}`,
        ]),
    ...noIndexProblems('sync', probe),
  ];
}

async function probe(
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

interface Outcome {
  problems: string[];
  /** The probe, or null when the request failed outright. */
  answer: Probe | null;
}

/**
 * Probes `url` and judges the answer. A request that fails outright (a dropped
 * connection, DNS not yet resolving a new hostname) is a problem like any other,
 * so the retry loop retries it and the report names it instead of crashing.
 */
async function check(
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

export async function verifyDev(
  target: Target,
  { attempts, delayMs }: { attempts: number; delayMs: number },
): Promise<string[]> {
  const healthUrl = new URL('/health', target.syncUrl).href;
  const robotsUrl = new URL('/robots.txt', target.webUrl).href;
  const right = { Authorization: basicAuthorization(target.password) };
  // Appending to the real password guarantees a different one.
  const wrong = { Authorization: basicAuthorization(`${target.password}x`) };

  let problems: string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const gate = [
      await check('web without credentials', target.webUrl, {}, (p) =>
        gateProblems('web without credentials', p),
      ),
      await check('web with a wrong password', target.webUrl, wrong, (p) =>
        gateProblems('web with a wrong password', p),
      ),
    ];
    const gateProblemsFound = gate.flatMap((outcome) => outcome.problems);
    if (gate.some(({ answer }) => answer !== null && leaked(answer))) {
      return gateProblemsFound;
    }
    const rest = [
      await check('robots.txt', robotsUrl, {}, robotsProblems),
      await check('web', target.webUrl, right, (p) =>
        webProblems(p, target.sha),
      ),
      await check('sync', healthUrl, {}, (p) => healthProblems(p, target.sha)),
    ];
    problems = [
      ...gateProblemsFound,
      ...rest.flatMap((outcome) => outcome.problems),
    ];
    if (problems.length === 0) return [];
    if (attempt < attempts)
      await new Promise((resolve) => setTimeout(resolve, delayMs));
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
  const problems = await verifyDev(
    {
      webUrl: required('DEV_WEB_URL'),
      syncUrl: required('DEV_SYNC_URL'),
      sha: required('EXPECTED_SHA'),
      password: required('DEV_BASIC_AUTH_PASSWORD'),
    },
    { attempts: 18, delayMs: 10_000 },
  );
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    process.exit(1);
  }
  console.log(
    '✓ dev is password-gated, blocks crawlers, serves the expected commit, and D1 answers',
  );
}
```

`.github/workflows/deploy-dev.yml` (change):

```diff
diff --git a/.github/workflows/deploy-dev.yml b/.github/workflows/deploy-dev.yml
index 887122a..6dd641c 100644
--- a/.github/workflows/deploy-dev.yml
+++ b/.github/workflows/deploy-dev.yml
@@ -1,6 +1,7 @@
 # Deploys develop to the dev environment on every merge (spec §13): D1
-# migrations, then the sync Worker, then the web app (a static-assets Worker,
-# spec D9), then a verify that reads all three back from the live URLs.
+# migrations, then the sync Worker, then the web app (a static-assets Worker
+# with the password gate in front, spec D9 and #39), then a verify that reads
+# all three back from the live Custom Domains.
 #
 # Every Cloudflare secret is a `dev` ENVIRONMENT secret, and `dev` admits only
 # the develop branch, so a fork PR or any other branch cannot reach them
@@ -28,7 +29,7 @@ jobs:
     runs-on: ubuntu-latest
     environment:
       name: dev
-      url: https://wordfarer-web-dev.shyden1988uk.workers.dev
+      url: https://dev.wordfarer.shyden.co.uk
     env:
       CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
       CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
@@ -59,7 +60,7 @@ jobs:
     runs-on: ubuntu-latest
     environment:
       name: dev
-      url: https://wordfarer-web-dev.shyden1988uk.workers.dev
+      url: https://dev.wordfarer.shyden.co.uk
     permissions:
       contents: read
       statuses: write
@@ -68,13 +69,12 @@ jobs:
       - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
         with:
           node-version-file: '.nvmrc'
-      - name: Verify dev is gated, serves this commit, and D1 answers
+      - name: Verify dev is password-gated, serves this commit, and D1 answers
         env:
-          DEV_WEB_URL: https://wordfarer-web-dev.shyden1988uk.workers.dev/
-          DEV_SYNC_URL: https://wordfarer-sync-dev.shyden1988uk.workers.dev
+          DEV_WEB_URL: https://dev.wordfarer.shyden.co.uk/
+          DEV_SYNC_URL: https://dev-api.wordfarer.shyden.co.uk
           EXPECTED_SHA: ${{ github.sha }}
-          CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}
-          CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
+          DEV_BASIC_AUTH_PASSWORD: ${{ secrets.DEV_BASIC_AUTH_PASSWORD }}
         run: node scripts/verify-dev.ts
       - name: Post dev-verified on the deployed commit
         env:
@@ -82,5 +82,5 @@ jobs:
         run: >-
           gh api "repos/${GITHUB_REPOSITORY}/statuses/${GITHUB_SHA}"
           -f state=success -f context=dev-verified
-          -f description="Live on dev: gated, this commit, D1 answers"
+          -f description="Live on dev: password-gated, this commit, D1 answers"
           -f target_url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
```

- [ ] **Step 4: Document**

`docs/superpowers/specs/2026-10-01-wordfarer-design.md` (change):

```diff
diff --git a/docs/superpowers/specs/2026-10-01-wordfarer-design.md b/docs/superpowers/specs/2026-10-01-wordfarer-design.md
index cd6aee0..f02f180 100644
--- a/docs/superpowers/specs/2026-10-01-wordfarer-design.md
+++ b/docs/superpowers/specs/2026-10-01-wordfarer-design.md
@@ -49,6 +49,8 @@ The operator's choices from brainstorming, recorded so no later session re-litig
 | D16 | Name                  | **Wordfarer** (trademark clearance is a pre-launch task)                                                                                                                                                                                                                                                                                                                                                                                           |
 | D17 | Openness and licences | **Public, open-source repository** (operator 2026-10-01 01:01 UTC: "all new repos will usually be open-source and public and transparent"). Code **Apache-2.0**. Content is licensed **per item** (01:03 and 02:59 UTC): adapted from CC BY-SA sources → **CC BY-SA 4.0**; original writing and art (story, culture cards, motifs, original examples) → **CC BY-NC-SA 4.0**. The Wordfarer name and logo are **reserved trademarks**, not licensed |

+**D9 amended 2026-10-01 (#39):** dev is served at `dev.wordfarer.shyden.co.uk` (web) and `dev-api.wordfarer.shyden.co.uk` (sync) as Workers Custom Domains, behind the shared Shyden Labs dev password, which replaced Cloudflare Access. See §6.7.
+
 ## 3. Core loop

 Numbers are **starting values for balance testing**, not commitments (operator: "approve, tweak numbers later"). Every one lives in a single `balance.ts` table, and the pacing bots (§12.2) guard the outcomes rather than the constants.
@@ -247,6 +249,8 @@ A single `Platform` interface: `storage`, `notifications`, `achievements`, `enti

 `players`, `devices`, `saves` (+ `save_versions`, max 5), `pairings`, `ranked_batches`, `ranked_state` (server-replayed checkpoint per player and course), `leaderboard_entries`, `names` (+ `name_holds`), `reports`, `flags`, `grants`, `staff`, `audit_log`, `deletion_requests`. Migrations are SQL files under `apps/sync-worker/migrations`.

+**Hostnames and the dev gate (#39).** Production is `wordfarer.shyden.co.uk` (web) and `api.wordfarer.shyden.co.uk` (sync), attached by the production pipeline. Dev is `dev.wordfarer.shyden.co.uk` and `dev-api.wordfarer.shyden.co.uk`, Workers Custom Domains on the `shyden.co.uk` zone, declared in each `wrangler.jsonc`. `packages/lockdown` (ported from shyden.co.uk's `functions/_lib/lockdown.js`, which ShyTalk shares) passes the production hostnames through untouched. On any other host the web Worker serves a blocking `robots.txt` publicly and demands HTTP Basic auth against one shared password (`run_worker_first`, so no asset is served without it), failing closed when the password is unset; the sync API is not password-gated, because native apps cannot answer a browser challenge, and carries `X-Robots-Tag: noindex, nofollow, noarchive` only. The password lives in two places only, both entered by the operator: the Worker secret `DEV_PASSWORD` on `wordfarer-web-dev`, and the GitHub `dev` environment secret `DEV_BASIC_AUTH_PASSWORD`, which the deploy's verify job reads.
+
 **Plan note:** server replay needs more CPU than the Workers Free plan's 10 ms per request, so the **Workers Paid plan** (about $5/month) is a launch prerequisite.

 ## 7. Art direction: Batik night (D7)
```

`README.md` (change):

```diff
diff --git a/README.md b/README.md
index 857bf67..2bd70a2 100644
--- a/README.md
+++ b/README.md
@@ -30,7 +30,7 @@ npm run build

 Every change follows test-driven development, and each ticket gets its own branch with a PR into `develop`. Third-party GitHub Actions are pinned to full commit SHAs, Dependabot opens its PRs against `develop`, and `tests/unit/supply-chain.test.ts` enforces both.

-Every merge to `develop` deploys dev (web and sync Workers, D1) behind Cloudflare Access, and is verified live before it is marked `dev-verified`.
+Every merge to `develop` deploys dev (web and sync Workers, D1) and verifies it live before marking it `dev-verified`. Dev is at `https://dev.wordfarer.shyden.co.uk`, behind the shared Shyden Labs dev password, with the sync API at `https://dev-api.wordfarer.shyden.co.uk`.

 ## Licences

```

- [ ] **Step 5: See them pass**

Run: `npx vitest run tests/unit/verify-dev.test.ts tests/unit/workflow-secrets.test.ts` → `Tests 51 passed (51)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-dev.ts tests/unit .github/workflows/deploy-dev.yml docs README.md
git commit -m "feat(deploy): verify dev through the password gate on its Custom Domains (Refs #39)"
```

- [ ] **Step 7: Mutations**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run tests/unit/verify-dev.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `⏎` marks a line break and `(deleted)` means the line is removed.

| Id   | File                               | Change                                                                                                                                                                                             | Predicted (written first)                                                                                                                                                                                                                    | Result                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M4.1 | `scripts/verify-dev.ts`            | `return probe.status >= 200 && probe.status < 300;` → `return probe.status >= 200 && probe.status < 200;`                                                                                          | 4 failed (status 200 leaked: true; status 204 leaked: true; status 299 leaked: true; fails at once, without retrying, when the gate is gone), 32 passed                                                                                      | as predicted                                                                                                                                                                                                                                                                                                                                 |
| M4.2 | `scripts/verify-dev.ts`            | `if (APP_MARKUP.test(probe.body)) {` → `if (APP_MARKUP.test(probe.body) && probe.status !== 401) {`                                                                                                | 1 failed (fails a 401 that still carries the page), 35 passed                                                                                                                                                                                | as predicted                                                                                                                                                                                                                                                                                                                                 |
| M4.3 | `scripts/verify-dev.ts`            | `return /^User-agent: \*\nDisallow: \/$/m.test(probe.body)` → `return /Disallow: \//.test(probe.body)`                                                                                             | 2 failed (fails one that blocks one crawler only; fails one that blocks a path only), 34 passed                                                                                                                                              | as predicted                                                                                                                                                                                                                                                                                                                                 |
| M4.4 | `scripts/verify-dev.ts`            | ``basicAuthorization(`${target.password}x`)`` → `basicAuthorization(target.password)`                                                                                                              | 4 failed (passes a gated site serving the expected commit; retries a stale deploy, then reports both stale hosts; fails when the noindex header is missing everywhere; retries through a dropped connection instead of giving up), 32 passed | 5 failed, 31 passed: stronger than predicted. `never puts the password in a problem` fails too: its broken-site run expects exactly 4 problems, and with the wrong password equal to the right one the second gate probe is served (200), so the run stops at the gate with 3. The prediction was written before that test counted problems. |
| M4.5 | `scripts/verify-dev.ts`            | `    ...noIndexProblems('sync', probe),` → (deleted)                                                                                                                                               | 2 failed (fails a healthy answer without the noindex header; fails when the noindex header is missing everywhere), 34 passed                                                                                                                 | 3 failed, 33 passed: stronger than predicted. `never puts the password in a problem` fails too: its broken-site run expects exactly 4 problems and, without the sync noindex check, gets 3. The prediction was written before that test counted problems.                                                                                    |
| M4.6 | `scripts/verify-dev.ts`            | ``problems: [`${label}: request to ${url} failed: ${reason}`],`` → ``problems: [`${label}: request to ${url} failed: ${reason} ${JSON.stringify(headers)}`],``                                     | 1 failed (never puts the password in a problem), 35 passed                                                                                                                                                                                   | as predicted                                                                                                                                                                                                                                                                                                                                 |
| M4.7 | `.github/workflows/deploy-dev.yml` | `  verify:⏎    needs: deploy⏎    runs-on: ubuntu-latest⏎    environment:⏎      name: dev⏎      url: https://dev.wordfarer.shyden.co.uk` → `  verify:⏎    needs: deploy⏎    runs-on: ubuntu-latest` | `npx vitest run tests/unit/workflow-secrets.test.ts`: 1 failed (no secret is read outside a protected environment), 14 passed                                                                                                                | as predicted                                                                                                                                                                                                                                                                                                                                 |

- [ ] **Step 8: Gate**

As Task 1. Expected (measured): unit `Tests 381 passed (381)`, Worker `Tests 14 passed (14)` and `Tests 10 passed (10)`.

PR A is Tasks 1 to 4. Its merge needs the three operator steps above.

---

### Task 5 (PR B, after PR A is verified live): Custom Domains only

**Files:**

- Modify: `apps/web/wrangler.jsonc`, `apps/sync-worker/wrangler.jsonc`
- Test: `tests/unit/dev-config.test.ts`

Start this only once `develop`'s deploy of PR A has posted `dev-verified` (AC8 and AC9 both say "once AC6 is green on `develop`").

- [ ] **Step 1: Write the failing test**

`tests/unit/dev-config.test.ts` (change):

```diff
diff --git a/tests/unit/dev-config.test.ts b/tests/unit/dev-config.test.ts
index 39b7987..d99e551 100644
--- a/tests/unit/dev-config.test.ts
+++ b/tests/unit/dev-config.test.ts
@@ -18,6 +18,7 @@ const ROOT = new URL('../..', import.meta.url).pathname;
 interface DeployConfig {
   name: string;
   main: string | undefined;
+  workers_dev: unknown;
   routes: unknown;
   assets: Record<string, unknown> | undefined;
   vars: Record<string, unknown>;
@@ -29,14 +30,14 @@ const isRecord = (value: unknown): value is Record<string, unknown> =>
 function readDeployConfig(path: string): DeployConfig {
   const raw: unknown = unstable_readConfig({ config: path });
   if (!isRecord(raw)) throw new Error(`${path}: not a config object`);
-  const { name, main, routes, assets, vars } = raw;
+  const { name, main, workers_dev, routes, assets, vars } = raw;
   if (typeof name !== 'string') throw new Error(`${path}: no name`);
   if (main !== undefined && typeof main !== 'string')
     throw new Error(`${path}: main is not a path`);
   if (assets !== undefined && !isRecord(assets))
     throw new Error(`${path}: assets is not an object`);
   if (!isRecord(vars)) throw new Error(`${path}: vars is not an object`);
-  return { name, main, routes, assets, vars };
+  return { name, main, workers_dev, routes, assets, vars };
 }

 /** Every wrangler config in the repo, found on disk rather than listed. */
@@ -86,6 +87,15 @@ describe('the dev Workers’ deploy configs', () => {
     ]);
   });

+  it('serves each dev Worker at its Custom Domain only, never on workers.dev', () => {
+    expect(
+      configs.map(({ config }) => [config.name, config.workers_dev]).sort(),
+    ).toEqual([
+      ['wordfarer-sync-dev', false],
+      ['wordfarer-web-dev', false],
+    ]);
+  });
+
   it('declares no secret as a plain var (the password is a Worker secret)', () => {
     const declared = configs.flatMap(({ file, config }) =>
       Object.keys(config.vars).map((name) => ({ file, name })),
```

- [ ] **Step 2: See it fail**

The "stubs" are Task 4's configs:

`apps/web/wrangler.jsonc` (stub):

```
// The DEV web app: a Worker with static assets (spec D9, as amended
// 2026-10-01: Cloudflare now folds Pages into Workers), served at
// dev.wordfarer.shyden.co.uk behind the shared dev password (#39).
//
// Cloudflare serves a matching asset WITHOUT invoking a Worker unless
// `run_worker_first` is set, so the gate in worker/index.ts would never see
// the request. Here it is set, and every request pays one invocation; the
// future production config can stay script-less and keep asset requests free.
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "wordfarer-web-dev",
  "main": "worker/index.ts",
  "compatibility_date": "2026-09-30",
  "workers_dev": true,
  "preview_urls": false,
  "routes": [
    { "pattern": "dev.wordfarer.shyden.co.uk", "custom_domain": true },
  ],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": true,
    // A PWA routes on the client, so an unknown path serves index.html.
    "not_found_handling": "single-page-application",
  },
}
```

`apps/sync-worker/wrangler.jsonc` (stub):

```
// The DEV sync Worker (spec §6.7). Production gets its own config when the
// production pipeline is built; until then this file describes dev only.
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "wordfarer-sync-dev",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-30",
  "workers_dev": true,
  "preview_urls": false,
  // The sync API at dev-api.wordfarer.shyden.co.uk (#39). Not password-gated:
  // the Worker marks non-prod responses noindex instead (src/index.ts).
  "routes": [
    { "pattern": "dev-api.wordfarer.shyden.co.uk", "custom_domain": true },
  ],
  "vars": {
    // Overwritten at deploy time with `--var COMMIT:<sha>`, so /health can
    // prove which commit is live. "local" never matches a SHA.
    "COMMIT": "local",
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "wordfarer-dev",
      "database_id": "7ef754ed-f21e-4524-ac11-eac9bde28cc0",
      "migrations_dir": "migrations",
    },
  ],
}
```

Run: `npx vitest run tests/unit/dev-config.test.ts`
Expected (measured): `Tests 1 failed | 4 passed (5)`: `serves each dev Worker at its Custom Domain only, never on workers.dev` fails on its `toEqual`, both configs reading `true`.

- [ ] **Step 3: Implement**

`apps/web/wrangler.jsonc` (change):

```diff
diff --git a/apps/web/wrangler.jsonc b/apps/web/wrangler.jsonc
index fef34ff..ae519c5 100644
--- a/apps/web/wrangler.jsonc
+++ b/apps/web/wrangler.jsonc
@@ -11,7 +11,9 @@
   "name": "wordfarer-web-dev",
   "main": "worker/index.ts",
   "compatibility_date": "2026-09-30",
-  "workers_dev": true,
+  // Served only at its Custom Domain (#39): the *.workers.dev address would
+  // be a second way in, outside the hostname the gate and the verify know.
+  "workers_dev": false,
   "preview_urls": false,
   "routes": [
     { "pattern": "dev.wordfarer.shyden.co.uk", "custom_domain": true },
```

`apps/sync-worker/wrangler.jsonc` (change):

```diff
diff --git a/apps/sync-worker/wrangler.jsonc b/apps/sync-worker/wrangler.jsonc
index 61ba0b8..ac9a9e4 100644
--- a/apps/sync-worker/wrangler.jsonc
+++ b/apps/sync-worker/wrangler.jsonc
@@ -5,7 +5,9 @@
   "name": "wordfarer-sync-dev",
   "main": "src/index.ts",
   "compatibility_date": "2026-09-30",
-  "workers_dev": true,
+  // Served only at its Custom Domain (#39): the *.workers.dev address would
+  // be a second way in, outside the hostname the gate and the verify know.
+  "workers_dev": false,
   "preview_urls": false,
   // The sync API at dev-api.wordfarer.shyden.co.uk (#39). Not password-gated:
   // the Worker marks non-prod responses noindex instead (src/index.ts).
```

- [ ] **Step 4: See it pass, and commit**

Run: `npx vitest run tests/unit/dev-config.test.ts` → `Tests 5 passed (5)`.

```bash
git add apps/web/wrangler.jsonc apps/sync-worker/wrangler.jsonc tests/unit/dev-config.test.ts
git commit -m "feat(deploy): dev Workers serve on their Custom Domains only (Refs #39)"
```

- [ ] **Step 5: Mutations**

The task is committed first (previous step), so `git checkout -- <file>` returns each mutated file to that commit. For each row: make the change, run `npx vitest run tests/unit/dev-config.test.ts` unless the row's prediction names another command, compare with the prediction, then `git checkout -- <file>` and confirm `git status --porcelain` is empty. In the Change column, `⏎` marks a line break and `(deleted)` means the line is removed.

| Id   | File                              | Change                                           | Predicted (written first)                                             | Result       |
| ---- | --------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- | ------------ |
| M5.1 | `apps/web/wrangler.jsonc`         | `"workers_dev": false,` → `"workers_dev": true,` | 1 failed (serves each dev Worker at its Custom Domain only), 4 passed | as predicted |
| M5.2 | `apps/sync-worker/wrangler.jsonc` | `"workers_dev": false,` → `"workers_dev": true,` | 1 failed (serves each dev Worker at its Custom Domain only), 4 passed | as predicted |

- [ ] **Step 6: Gate**

As Task 1. Expected (measured): unit `Tests 382 passed (382)`, Worker `Tests 14 passed (14)` and `Tests 10 passed (10)`.

---

## Finishing

**PR A (Tasks 1 to 4):**

1. Re-read the zone for AC1 and quote it in the PR body: `GET /zones?name=shyden.co.uk` → zone name, account id, status (no token printed).
2. Commit this plan to `docs/superpowers/plans/2026-10-01-m2-39-dev-domains-gate.md` on the branch with Tasks 1 to 4. Push it, open the PR into `develop`, and wait for `build-and-test` green on the PR's head SHA (read the steps by name, match the SHA to `headRefOid`).
3. Confirm the three operator steps are done (ask Shyden; the agent cannot read either secret store).
4. Merge into `develop` (no permission needed). Watch `deploy-dev` on the merge commit: `deploy` attaches both Custom Domains; `verify` must pass and `dev-verified` must appear on the commit.
5. Post the AC evidence on #39: the verify log's success line, `curl -sI https://dev.wordfarer.shyden.co.uk/` (401, `WWW-Authenticate`, `X-Robots-Tag`), `curl -s https://dev.wordfarer.shyden.co.uk/robots.txt`, `curl -sI https://dev-api.wordfarer.shyden.co.uk/health`, and the certificate issuer of each host.

**PR B (Task 5), then the retirements:**

6. Branch from the new `develop`, apply Task 5, PR, CI, merge, and watch `deploy-dev` verify again.
7. AC8 probe: `curl -s -o /dev/null -w '%{http_code}' https://wordfarer-web-dev.shyden1988uk.workers.dev/` and the same for `wordfarer-sync-dev`: neither may serve the app or `/health` (record the codes).
8. AC9: delete the Access application `wordfarer-dev` and the service token `wordfarer-dev-ci` in Cloudflare Zero Trust (team `shyden`), and the `dev` environment secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` (GitHub, Shyden's login). Confirm each by a re-read: the Access application and service token lists, and the environment's secret list.
9. Update `HANDOVER.md` (hostnames, the gate, where each secret lives by name), post the AC evidence comment, and move #39 to Done.
