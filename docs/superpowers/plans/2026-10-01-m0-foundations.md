# M0 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Wordfarer monorepo toolchain, its CI quality gates, the environment-only secrets guard, a tested sync Worker on D1, and a dev deploy that proves itself live behind Cloudflare Access on every `develop` merge.

**Architecture:** npm workspaces: `apps/web` (Svelte 5 + Vite, served as a Worker with static assets) and `apps/sync-worker` (a Worker on D1). One root CI job runs Prettier, ESLint, `tsc`/`svelte-check`, the root Vitest suite, the Worker suite inside workerd, and the build, and fails on any warning. `deploy-dev.yml` re-runs that job through `workflow_call`. It then applies D1 migrations, deploys both Workers stamped with the commit SHA, and runs `scripts/verify-dev.ts`. The verifier checks from outside that both hostnames refuse anonymous requests, serve this commit, and that D1 answers. Only then does it post a `dev-verified` status.

**Tech Stack:** Node 24, npm 11 workspaces, TypeScript 6.0.3, Svelte 5.57, Vite 8.3, ESLint 10 + typescript-eslint 8.71 (`strictTypeChecked`) + eslint-plugin-svelte 3.23, Prettier 3.9, Vitest 4.1, `@cloudflare/vitest-pool-workers` 0.22, wrangler 4.145, `yaml` 2.9.

**Spec:** `docs/superpowers/specs/2026-10-01-wordfarer-design.md` (§6.1, §6.7, §12.9, §13; D9 as amended in Task 4).

## Global Constraints

- Node `>=24` (`.nvmrc` = 24, `engine-strict=true`). npm workspaces only.
- Zero warnings across lint, `svelte-check`, `tsc` and Prettier (spec §12), and in `npm ci` and `npm run build` output (`scripts/fail-on-warnings.sh`).
- TypeScript stays `~6.0.3` and Vitest `^4.1.11`: typescript-eslint and svelte-check declare `typescript <6.1`, and `@cloudflare/vitest-pool-workers` 0.22 declares `vitest ^4.1`. Dependabot ignores the newer ranges, and the reason is written in `dependabot.yml`.
- Every third-party action is pinned to a 40-hex SHA with a `# vX.Y.Z` comment. Dependabot targets `develop`.
- Deploy secrets are `dev` **environment** secrets only. No job outside `dev`/`production` may reference `secrets.*` other than `GITHUB_TOKEN` (spec §12.9).
- Prettier: `singleQuote: true`, with the Svelte plugin.
- Every Svelte component has `<script lang="ts">` (`svelte/block-lang`). A component without it is compiled as JavaScript and imports as `any` (measured).
- Commit messages and PR bodies say `Refs #N`, never close/fix/resolve next to a number. Commits are authored as Shyden.
- Cloudflare account `9315582c39b627dca58dfa83602db385`, workers.dev subdomain `shyden1988uk`. Dev names: web Worker `wordfarer-web-dev`, sync Worker `wordfarer-sync-dev`, D1 `wordfarer-dev` (id `7ef754ed-f21e-4524-ac11-eac9bde28cc0`, created 2026-10-01 04:38 UTC).

## Review Focus

1. **The Access gate silently disappears** (a toggled-off app, a renamed Worker on a new hostname). A tester expects dev to stay private. `verifyDev` probes both hostnames **without** the token first and fails on a 200 or a redirect anywhere but `*.cloudflareaccess.com` (Task 4, `gateProblems` tests and the "gate is gone" end-to-end test).
2. **The previous deploy is still served** for a few seconds after upload. A "verified" status must mean _this_ commit. The verifier compares the stamped SHA on both hostnames and retries before failing (Task 4, the stale-deploy test with exact retry counts).
3. **A secret reachable by a fork or any branch.** Possible shapes: a secret moved to workflow-level `env`, read with bracket syntax, passed by `secrets: inherit`, used in a job whose environment is computed by an expression, or exposed through a `pull_request_target` trigger. Each is a fixture in Task 2.
4. **The tests run on a different workerd from the one that deploys** after a Dependabot wrangler bump. The test pool pins its own wrangler and miniflare. The lock must hold exactly one wrangler, miniflare and workerd (Task 3, `worker-runtime.test.ts`).
5. **A build or install that warns but exits 0.** The zero-warnings policy needs CI to fail it. `fail-on-warnings.sh` catches CamelCase tokens such as Node's `DeprecationWarning`, reads stderr, and passes a failing command's own status through (Task 1).

## Operator setup (Shyden, before Task 4 merges)

The agent App has no `secrets` or `environments` permission and no Cloudflare Zero Trust scope, so these are Shyden's. Tasks 1–3 do not depend on them.

1. **Cloudflare API token** (dash → My Profile → API Tokens → Create Token → Custom). Account `Shyden1988uk@gmail.com's Account` only. Permissions: _Account · Workers Scripts · Edit_, _Account · D1 · Edit_, _Account · Account Settings · Read_. Whether this exact set is enough is proven by the first deploy; if wrangler reports a missing permission, add that permission alone.
2. **Cloudflare Access** (Zero Trust → Access → Applications → Add → Self-hosted). One application covering both hostnames `wordfarer-web-dev.shyden1988uk.workers.dev` and `wordfarer-sync-dev.shyden1988uk.workers.dev`. Policy 1: _Allow_ emails `Shyden1988uk@gmail.com` (plus any tester). Policy 2: _Service Auth_ with a new service token `wordfarer-dev-ci` (Access → Service Auth → Create; copy the Client ID and Secret once). If the Worker must exist before Access accepts its hostname, enable Access after Task 4's first deploy. That first verify run then goes red on the gate check, and goes green on a re-run once Access is on.
3. **GitHub `dev` environment secrets** (repo → Settings → Environments → dev → Add secret): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` = `9315582c39b627dca58dfa83602db385`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`. Do not create repository-level secrets.

## Board (filed 2026-10-01 05:07 UTC, read back)

Board `PVT_kwDOEOcG584BlRWb` (project 4, title read back as **Wordfarer Stories**). Epics: M0 #5, M1 #6, M2 #17, M3 #7, M4 #8, M5 #9, M6 #10, M7 #11, M8 #12. M0 stories, sub-issues of #5, each carrying its task's AC verbatim: Task 1 → **#13**, Task 2 → **#14**, Task 3 → **#15**, Task 4 → **#16**. All are Todo. Move a story to In Progress when its branch starts, and to Done when its AC evidence is posted.

---

### Task 1: Monorepo toolchain and CI quality gates

**Story AC:**

1. npm workspaces (`apps/*`, `packages/*`), with `apps/web` a Svelte 5 + Vite shell that renders the wordmark only.
2. Root scripts `format`, `format:check`, `lint` (`--max-warnings 0`), `typecheck` (root `tsc` and every workspace's own), `test:unit`, `build`.
3. ESLint flat config with `strictTypeChecked` and `svelte/block-lang` (`script: 'ts'`). Prettier config with `singleQuote` committed.
4. `scripts/fail-on-warnings.sh` wraps `npm ci` and `npm run build` in CI. A warning or a deprecation on stdout or stderr fails the step, and the command's own exit status passes through.
5. The existing guards are lint-clean under the strict rules. The two unused helpers in `tests/unit/source-text.ts` are deleted.
6. Dependabot ignores `typescript >=6.1.0` and `vitest >=5.0.0`, with the reason beside each.
7. CI runs Format, Lint, Typecheck, Unit tests and Build. The PR is green with no warnings in any step log.

**Files:**

- Create: `.prettierrc.json`, `.prettierignore`, `eslint.config.js`, `tsconfig.json`, `vitest.config.ts`, `scripts/fail-on-warnings.sh`, `tests/unit/fail-on-warnings.test.ts`, `apps/web/package.json`, `apps/web/index.html`, `apps/web/svelte.config.js`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/main.ts`, `apps/web/src/App.svelte`
- Modify: `package.json`, `package-lock.json` (regenerated), `.github/workflows/ci.yml`, `.github/dependabot.yml`, `tests/unit/source-text.ts`, `tests/unit/supply-chain.test.ts`, `tests/unit/licences.test.ts`, `README.md`, `HANDOVER.md` (the pending edit), plus this plan file

**Interfaces:**

- Produces: root scripts `format:check`, `lint`, `typecheck`, `test:unit`, `build`, which CI calls in that order. Every workspace may add its own `build` and `typecheck`, which the root runs with `--workspaces --if-present`. `scripts/fail-on-warnings.sh <command…>`.

- [ ] **Step 1: Branch.** `git switch -c m0/toolchain origin/develop`. This plan file and the pending `HANDOVER.md` edit are already in the working tree on `develop`, and they move with the switch.

- [ ] **Step 2: Root toolchain.** Write these files exactly. Then run `npm install`, which regenerates `package-lock.json` (npm 11, Node 24). Expect no `npm warn` lines and `found 0 vulnerabilities`.

`package.json`:

```json
{
  "name": "wordfarer",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "test:unit": "vitest run",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit && npm run typecheck --workspaces --if-present",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "@types/node": "^24.0.0",
    "eslint": "^10.11.0",
    "eslint-plugin-svelte": "^3.23.0",
    "globals": "^17.0.0",
    "prettier": "^3.9.9",
    "prettier-plugin-svelte": "^4.1.1",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.71.0",
    "vitest": "^4.1.11"
  },
  "allowScripts": {
    "esbuild": true,
    "fsevents": false,
    "workerd": true
  }
}
```

`.prettierrc.json`:

```json
{
  "singleQuote": true,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [
    { "files": "*.svelte", "options": { "parser": "svelte" } },
    {
      "files": "*.md",
      "options": { "embeddedLanguageFormatting": "off" }
    }
  ]
}
```

`.prettierignore`:

```
package-lock.json
LICENSES/
LICENSE
```

`tsconfig.json`:

```json
{
  // The root project: repo guards under tests/ and root config files. Each
  // workspace under apps/ and packages/ has its own tsconfig.json and is
  // checked by its own `typecheck` script.
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["tests/**/*.ts", "vitest.config.ts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

/**
 * The root suite: repo guards (tests/) and every workspace that runs in plain
 * Node.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'apps/web/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
```

`eslint.config.js`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './apps/web/svelte.config.js';

/**
 * One flat config for the whole monorepo. `--max-warnings 0` in the lint
 * script makes every warning a failure (zero-warnings policy, spec §12).
 *
 * Type-aware rules (`strictTypeChecked`) use the TypeScript project service,
 * which finds the nearest tsconfig.json for each file, so every workspace is
 * linted against its own compiler options.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'reports/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { parser: tseslint.parser, svelteConfig },
    },
    rules: {
      // A component without <script lang="ts"> is compiled as JavaScript and
      // imports as `any` under strict TypeScript (measured while planning M0).
      'svelte/block-lang': ['error', { script: 'ts' }],
    },
  },
  {
    files: ['apps/web/src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
```

- [ ] **Step 3: The web shell.**

`apps/web/package.json`:

```json
{
  "name": "@wordfarer/web",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "typecheck": "svelte-check --tsconfig ./tsconfig.json --fail-on-warnings"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^7.3.1",
    "@tsconfig/svelte": "^5.0.0",
    "svelte": "^5.57.1",
    "svelte-check": "^4.7.6",
    "vite": "^8.3.1"
  }
}
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Wordfarer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`apps/web/svelte.config.js`:

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
```

`apps/web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
});
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "*.ts"]
}
```

`apps/web/src/main.ts`:

```ts
import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app');
if (target === null) {
  throw new Error('index.html has no #app element to mount into');
}

export default mount(App, { target });
```

`apps/web/src/App.svelte`:

```svelte
<script lang="ts">
  // The M0 shell renders the wordmark only. "Wordfarer" is a proper noun and
  // the same in every locale, so it needs no catalogue key (spec §6.3); the
  // first translatable string arrives with the i18n catalogues in M3.
</script>

<main>
  <h1>Wordfarer</h1>
</main>
```

- [ ] **Step 4: Run lint red on the existing guards.** `npm run lint`. Expected: **16 errors**, all in `tests/unit/{licences,source-text,supply-chain}`: 7 `no-unsafe-member-access`, 4 `restrict-template-expressions`, 2 `restrict-plus-operands`, and one each of `no-unsafe-assignment`, `no-unsafe-return` and `no-non-null-assertion`. These are real defects that the stricter rules expose.

- [ ] **Step 5: Fix them.** Replace the three files with these exact versions. `source-text.ts` loses `withoutCommentLines` and `withoutTsComments`: nothing imports either, and `withoutTsComments` is the version without regex-literal and template-substitution lexing. Then `npm run lint` exits 0.

`tests/unit/source-text.ts`:

```ts
/**
 * Comment stripping for the guards that assert against source text. #24.
 *
 * Several suites in this repo read a file as TEXT and assert that something
 * appears in it, or does not. Every one of them is exposed to the same defect,
 * and this repo has now shipped it three times:
 *
 * 1. #23 — `supply-chain.test.ts` asserted `dependabot.yml` contained
 *    `"actions/cache*"`, and the file's own explanatory NOTE spelled that
 *    pattern out verbatim. No group was configured at all; the suite was
 *    green.
 * 2. #21 Stage 4 — `pipeline-wiring.test.ts`'s first dev-sanity check searched
 *    raw text, and pointing the run step at a different config left it green,
 *    because that file's own comment explaining the fix contained the filename
 *    it was looking for.
 * 3. #35 — the pre-push hook guard asserted the hook source contained
 *    `npm run test:unit`. It passed while the hook did NOT run it: the string
 *    survived inside the failure hint the hook prints telling you how to run
 *    it by hand.
 *
 * All three read as obviously correct. None was found by review; each was
 * found by mutation, which is why the standing rule pairs the two: assert on
 * the stripped text, and watch it fail.
 *
 * THE INVERSE IS ALSO A DEFECT and is easier to miss, because nothing goes
 * red. `dead-copy.test.ts` asserts ABSENCE — a key is dead if nothing
 * references it — so a comment naming a key keeps a dead key looking alive and
 * SUPPRESSES a finding rather than satisfying an assertion. Same cause, no
 * symptom.
 */

/**
 * YAML with comments removed, inline ones included, and blank lines dropped.
 *
 * `# vX.Y.Z` beside a pinned action SHA is meaningful data, not prose, so
 * anything checking those version comments must read the RAW text — this is
 * for config bodies where a `#` is always commentary.
 */
export const withoutYamlComments = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.replace(/(^|\s)#.*$/, ''))
    .filter((line) => line.trim() !== '')
    .join('\n');

/**
 * YAML with its scalar quote characters removed.
 *
 * Quoting in YAML is a STYLE, not a meaning: `'actions/cache*'` and
 * `"actions/cache*"` are the same scalar. A guard that greps for one spelling
 * reports a correct config as missing, which is a false ALARM rather than a
 * false pass -- the safe direction, but it reddens CI on config that is right
 * and sends whoever hits it hunting a problem that does not exist.
 *
 * Found by building the org template repository against this repo's own
 * supply-chain guard. The template configured the sub-path group in this
 * repo's own house style (single quotes, as `'npm'` and `'develop'` are
 * written) and the guard called it ungrouped.
 *
 * Only the quote characters go; separators and structure stay, so `['a','b']`
 * becomes `[a,b]` and two scalars cannot merge into one.
 */
export const withoutYamlQuotes = (text: string): string =>
  text.replace(/['"]/g, '');
```

`tests/unit/supply-chain.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { withoutYamlComments, withoutYamlQuotes } from './source-text';

/**
 * The CI supply chain is pinned, and something keeps it current.
 *
 * Two failure modes, and they pull in opposite directions:
 *
 * 1. A MUTABLE TAG is not a version. `actions/checkout@v4` resolves to
 *    whatever the tag points at today, and a tag can be repointed by anyone
 *    who can push to that repo. A compromised or coerced maintainer moves the
 *    tag and every workflow in this repo runs their code, with our secrets,
 *    on the next push. Pinning to a full commit SHA is the only form of this
 *    reference that cannot be changed underneath us.
 *
 * 2. A PIN THAT NOBODY BUMPS rots. shyden.co.uk sat three majors behind on
 *    both of its actions with no mechanism to notice. So the SHA is only half
 *    the control — Dependabot is the other half, and the version comment
 *    beside each SHA is what makes a bump reviewable by a human instead of an
 *    opaque hex swap.
 *
 * SOURCE TEXT, not YAML parsing: no YAML parser is available here and none is
 * worth adding ("no new npm dependencies"), matching pipeline-wiring.test.ts.
 */

const WORKFLOWS = '.github/workflows';
const DEPENDABOT = '.github/dependabot.yml';

const workflowFiles = () =>
  readdirSync(WORKFLOWS).filter(
    (f) => f.endsWith('.yml') || f.endsWith('.yaml'),
  );

/**
 * Every `uses:` naming a THIRD-PARTY action.
 *
 * Local references (`./.github/actions/x`, `./.github/workflows/y.yml`) are
 * excluded deliberately: they are this repo's own code, already reviewed at
 * the commit that introduced them, and have no upstream SHA to pin.
 */
const externalUses = () =>
  workflowFiles().flatMap((file) =>
    readFileSync(join(WORKFLOWS, file), 'utf8')
      .split('\n')
      .map((text, i) => ({
        where: `${file}:${String(i + 1)}`,
        text: text.trim(),
      }))
      .filter(({ text }) => /^(-\s*)?uses:\s*[^.\s]/.test(text)),
  );

const dependabot = () =>
  existsSync(DEPENDABOT) ? readFileSync(DEPENDABOT, 'utf8') : '';

/**
 * The config with its YAML comments removed. ASSERT ON THIS, never on the
 * raw text.
 *
 * These checks read source text, and this file DOCUMENTS the very patterns it
 * is checked for — the sub-path note spells out `patterns: ["actions/cache*"]`
 * verbatim. Matched against the raw text, that prose SATISFIES the sub-path
 * guard on its own: the repo could reference `actions/cache` at three
 * sub-paths with no group whatsoever and still go green, and the position of
 * the comment (above the groups) makes the ordering check pass too. Caught by
 * mutation while adding that ordering check.
 */
const configBody = () => withoutYamlComments(dependabot());

/**
 * The config split into one text block per `package-ecosystem:` entry, so a
 * group's position is judged against the catch-all of ITS OWN ecosystem
 * rather than whichever one happens to appear first in the file.
 */
const ecosystemBlocks = () =>
  configBody()
    .split(/(?=^\s*-\s*package-ecosystem:)/m)
    .filter((block) => /package-ecosystem:/.test(block));

/**
 * Every `owner/repo` referenced at MORE THAN ONE sub-path, with the distinct
 * refs seen for it — the ones Dependabot would otherwise bump one sub-path at
 * a time, leaving the siblings behind.
 */
const subPathRepos = (): [string, Set<string>][] => {
  const refs = new Map<string, Set<string>>();
  for (const { text } of externalUses()) {
    const ref = text.match(/uses:\s*([^@\s]+)@/)?.[1];
    if (!ref) continue;
    const [owner = '', repo = ''] = ref.split('/');
    const key = `${owner}/${repo}`;
    const seen = refs.get(key) ?? new Set<string>();
    seen.add(ref);
    refs.set(key, seen);
  }
  return [...refs.entries()].filter(([, seen]) => seen.size > 1);
};

describe('the CI supply chain is pinned', () => {
  it('there is something to check', () => {
    expect(externalUses().length).toBeGreaterThan(0);
  });

  it('every third-party action is pinned to a full commit SHA', () => {
    const unpinned = externalUses()
      .filter(({ text }) => !/@[0-9a-f]{40}(?=\s|$)/.test(text))
      .map(({ where, text }) => `${where} ${text}`);

    expect(unpinned, 'a mutable tag can be repointed under us').toEqual([]);
  });

  it('every pinned action names the version its SHA resolves to', () => {
    const opaque = externalUses()
      .filter(({ text }) => !/@[0-9a-f]{40}\s+#\s*v\d/.test(text))
      .map(({ where, text }) => `${where} ${text}`);

    expect(opaque, 'a bare SHA bump is unreviewable by a human').toEqual([]);
  });
});

describe('Dependabot keeps the pins from rotting', () => {
  /**
   * ShyTalk shipped this bug, so it is guarded here before it can happen.
   *
   * Dependabot treats `actions/cache`, `actions/cache/restore` and
   * `actions/cache/save` as three SEPARATE dependencies. Ungrouped, they
   * arrive as three PRs, each moving one sub-path's SHA while its siblings
   * lag — a one-SHA-per-repo violation by construction, and for codeql-action
   * a runtime version mismatch ("Loaded a configuration file for version
   * '4.36.3', but running version '4.37.1'"). ShyTalk's SHY-0226.
   *
   * Dormant today: this repo uses no sub-path actions. It fails the moment
   * one is added without a matching Dependabot group. Verified by mutation,
   * not by watching it pass.
   */
  it('an action repo used at more than one sub-path is grouped into one PR', () => {
    const config = configBody();
    const ungrouped = subPathRepos()
      .filter(([key]) => !withoutYamlQuotes(config).includes(`${key}*`))
      .map(
        ([key, refs]) =>
          `${key} used at ${String(refs.size)} sub-paths, ungrouped`,
      );

    expect(
      ungrouped,
      'separate PRs per sub-path break the one-SHA-per-repo invariant',
    ).toEqual([]);
  });

  /**
   * Declaring the group is not enough — it has to WIN.
   *
   * Dependabot assigns a dependency to the FIRST group whose patterns match
   * and then stops looking. `patch-updates` is a catch-all keyed on
   * update-type, so it swallows a patch bump of `actions/cache/restore`
   * before an `actions/cache*` group declared BELOW it is ever consulted.
   * The group is present, the config reads correct, and the sub-paths still
   * arrive in separate PRs — SHY-0226 all over again. Order is the control,
   * not presence, so the presence test above cannot stand alone.
   *
   * Dormant today (this repo uses no sub-path actions) and verified by
   * mutation, not by watching it pass.
   */
  it('a sub-path group is declared before the catch-all that would swallow it', () => {
    const misordered = subPathRepos().flatMap(([key]) =>
      ecosystemBlocks()
        .filter((block) => withoutYamlQuotes(block).includes(`${key}*`))
        .filter((block) => {
          const catchAll = block.indexOf('patch-updates:');
          return (
            catchAll !== -1 &&
            catchAll < withoutYamlQuotes(block).indexOf(`${key}*`)
          );
        })
        .map(() => `${key} grouped after patch-updates`),
    );

    expect(
      misordered,
      'Dependabot assigns to the FIRST matching group and stops',
    ).toEqual([]);
  });

  it('a Dependabot config exists', () => {
    expect(existsSync(DEPENDABOT)).toBe(true);
  });

  it('watches npm AND the GitHub Actions themselves', () => {
    const config = configBody();

    expect(config, 'npm dependencies unwatched').toMatch(
      /package-ecosystem:\s*["']?npm["']?/,
    );
    expect(config, 'the actions that run CI are unwatched').toMatch(
      /package-ecosystem:\s*["']?github-actions["']?/,
    );
  });

  it('opens every PR against develop, never straight at main', () => {
    const config = configBody();
    const ecosystems = (config.match(/package-ecosystem:/g) ?? []).length;
    const onDevelop = config.match(/target-branch:\s*["']?develop["']?/g) ?? [];

    expect(ecosystems, 'no ecosystems declared').toBeGreaterThan(0);
    expect(
      onDevelop.length,
      'an ecosystem defaults to the default branch, bypassing the develop gate',
    ).toBe(ecosystems);
    expect(config).not.toMatch(/target-branch:\s*["']?main["']?/);
  });
});

/**
 * The install is reproducible (Refs #1).
 *
 * The first CI run on develop died in `actions/setup-node` before a single
 * test ran: `cache: 'npm'` needs a lock file, and the template shipped none.
 * Without one, `npm ci` refuses too, and every install would resolve the
 * ranges afresh. The template also tracked a Vitest cache under
 * `node_modules/`, so a clean checkout carried build state.
 */
interface PackageJson {
  name: string;
  devDependencies: Record<string, string>;
}

interface PackageLock {
  lockfileVersion: number;
  name: string;
  packages: Record<string, { devDependencies?: Record<string, string> }>;
}

describe('the install is reproducible', () => {
  const pkg = () =>
    JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;

  it('the package is named for this repo, not the template', () => {
    expect(pkg().name).toBe('wordfarer');
  });

  it('a lock file is committed and agrees with package.json', () => {
    expect(
      existsSync('package-lock.json'),
      'npm ci and the CI cache need it',
    ).toBe(true);
    const lock = JSON.parse(
      readFileSync('package-lock.json', 'utf8'),
    ) as PackageLock;
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.name).toBe(pkg().name);
    expect(lock.packages['']?.devDependencies).toEqual(pkg().devDependencies);
  });

  it('nothing under node_modules is tracked', () => {
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n')
      .filter((path) => path !== '');
    expect(tracked, 'positive control: git ls-files sees this repo').toContain(
      'package.json',
    );
    expect(tracked.filter((path) => path.startsWith('node_modules/'))).toEqual(
      [],
    );
  });
});
```

`tests/unit/licences.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

/**
 * The licence set promised by spec D17 is present and is the real text
 * (Refs #2).
 *
 * The repository is public. A missing or wrong licence file is a legal fact
 * about every copy already cloned, so these files are guarded like code. Each
 * check reads the file's own opening line, never a filename alone: an empty
 * file or a pasted MIT text would otherwise pass.
 */

const firstLine = (path: string) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '');

describe('the licence set (D17)', () => {
  it('the code is Apache-2.0, with the canonical text', () => {
    const text = readFileSync('LICENSE', 'utf8');
    expect(firstLine('LICENSE')).toBe('Apache License');
    expect(text).toContain('Version 2.0, January 2004');
    expect(text).toContain('END OF TERMS AND CONDITIONS');
  });

  it('package.json declares the same code licence', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      license?: string;
    };
    expect(pkg.license).toBe('Apache-2.0');
  });

  it('both content licences ship as full legal code', () => {
    expect(firstLine('LICENSES/CC-BY-SA-4.0.txt')).toBe(
      'Attribution-ShareAlike 4.0 International',
    );
    expect(firstLine('LICENSES/CC-BY-NC-SA-4.0.txt')).toBe(
      'Attribution-NonCommercial-ShareAlike 4.0 International',
    );
  });

  it('the content rule names exactly the two allowed licences', () => {
    const rule = readFileSync('LICENSE-CONTENT.md', 'utf8');
    const ids = [...rule.matchAll(/`(CC-[A-Z-]+-4\.0)`/g)].map(
      (match) => match[1],
    );
    expect([...new Set(ids)].sort()).toEqual([
      'CC-BY-NC-SA-4.0',
      'CC-BY-SA-4.0',
    ]);
  });

  it('the notice and the trademark reservation are present', () => {
    expect(existsSync('NOTICE'), 'Apache-2.0 section 4(d)').toBe(true);
    expect(firstLine('NOTICE')).toBe('Wordfarer');
    expect(firstLine('TRADEMARKS.md')).toBe('# Trademarks');
  });
});
```

- [ ] **Step 6: Write the failing test for the warnings wrapper.**

`tests/unit/fail-on-warnings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

/**
 * scripts/fail-on-warnings.sh, run for real: each case is a shell command
 * whose output the wrapper must judge.
 */
const run = (command: string) =>
  spawnSync('scripts/fail-on-warnings.sh', ['sh', '-c', command], {
    encoding: 'utf8',
  });

describe('fail-on-warnings.sh', () => {
  it.each([
    ['npm warn deprecated x@1'],
    ['(!) Your Vite config uses features that are unsupported'],
    ['WARNING: something'],
    ['found 2 warnings'],
    ['DeprecationWarning: x'],
    ['a deprecation notice'],
  ])('fails a clean exit that printed "%s"', (line) => {
    const result = run(`echo '${line}'`);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('zero-warnings policy');
  });

  it.each([['all good'], ['swarm of bees']])('passes "%s"', (line) => {
    const result = run(`echo '${line}'`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(line);
  });

  it('passes the command’s own failure through, status intact', () => {
    expect(run('exit 3').status).toBe(3);
  });

  it('reads stderr as well as stdout', () => {
    expect(run('echo "npm warn x" >&2').status).toBe(1);
  });
});
```

- [ ] **Step 7: Run it red.** Create `scripts/fail-on-warnings.sh` as a stub that exits 0 without running anything (`#!/usr/bin/env bash` then `exit 0`), then `chmod +x scripts/fail-on-warnings.sh`.
      Run: `npx vitest run tests/unit/fail-on-warnings.test.ts`
      Expected: **10 failed**, each on its own assertion. The six warning cases and the stderr case expect status 1 and the stub returns 0; the two clean cases expect their line on stdout and the stub prints nothing; the exit-3 case expects 3.

- [ ] **Step 8: Implement the wrapper.**

`scripts/fail-on-warnings.sh`:

```bash
#!/usr/bin/env bash
# Runs a command and fails if it fails OR prints a warning. A build or install
# that warns still exits 0, so without this the zero-warnings policy (spec §12)
# holds only for the tools that have a --max-warnings flag.
set -uo pipefail

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

"$@" 2>&1 | tee "$log"
status="${PIPESTATUS[0]}"
if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi

# A plain substring match, so CamelCase tokens such as Node's DeprecationWarning
# are caught. It will also flag a word like "forewarned"; that false alarm is
# the safe direction, where a word-boundary match let real warnings through.
pattern='warn|deprecat|\(!\)'
if grep -Eiq "$pattern" "$log"; then
  echo "::error::'$*' printed a warning (zero-warnings policy, spec §12):"
  grep -Ei "$pattern" "$log"
  exit 1
fi
```

- [ ] **Step 9: Run it green.** `npx vitest run tests/unit/fail-on-warnings.test.ts` → 10 passed.

- [ ] **Step 10: CI and Dependabot.**

`.github/workflows/ci.yml`:

```yaml
# Every third-party `uses:` is a full 40-hex commit SHA with a trailing
# `# vX.Y.Z` comment. A tag is mutable and can be repointed by anyone who can
# push to that action's repo; the SHA is the only immutable reference. The
# comment is what makes a Dependabot bump reviewable by a human rather than an
# opaque hex swap -- so never remove it, and never let it drift from the SHA.
name: build-and-test
on:
  pull_request:
  push:
    branches: [develop]

permissions:
  contents: read

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - name: Install (a warning fails it)
        run: scripts/fail-on-warnings.sh npm ci
      - name: Format
        run: npm run format:check
      - name: Lint (zero warnings)
        run: npm run lint
      - name: Typecheck (tsc, svelte-check)
        run: npm run typecheck
      - name: Unit tests
        run: npm run test:unit
      - name: Build (a warning fails it)
        run: scripts/fail-on-warnings.sh npm run build
```

`.github/dependabot.yml`:

```yaml
# Dependency updates for every ecosystem this repo carries, plus the Actions
# themselves. Version updates are NOT inheritable org-wide -- only SECURITY
# updates are -- so this file is mandatory in every repo and must be created
# deliberately each time. Never assume an org setting covers it.
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    # Never `main`. A PR opened against a protected default branch either
    # cannot merge or bypasses the dev gate entirely.
    target-branch: 'develop'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
    ignore:
      # typescript-eslint and svelte-check both declare typescript <6.1.
      # Remove when both accept TypeScript 7.
      - dependency-name: 'typescript'
        versions: ['>=6.1.0']
      # @cloudflare/vitest-pool-workers 0.22 declares vitest ^4.1.
      # Remove when it accepts Vitest 5.
      - dependency-name: 'vitest'
        versions: ['>=5.0.0']
    groups:
      patch-updates:
        update-types:
          - 'patch'

  - package-ecosystem: 'github-actions'
    directory: '/'
    target-branch: 'develop'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
    groups:
      # CONFIGURED, not described. Dependabot treats actions/cache,
      # actions/cache/restore and actions/cache/save as three dependencies, so
      # ungrouped they arrive as three PRs, each moving one SHA while its
      # siblings lag behind. ShyTalk shipped that bug as SHY-0226.
      #
      # This group sits ABOVE patch-updates deliberately: Dependabot assigns a
      # dependency to the FIRST group whose patterns match and then stops
      # looking, so a catch-all keyed on update-type would swallow a patch bump
      # of a sub-path before this group was ever consulted. Order is the
      # control, not presence.
      #
      # It is declared here even though a new repo uses no sub-path actions
      # yet, because the failure is silent on the day someone adds one. The
      # guard in tests/unit/supply-chain.test.ts is dormant until then and
      # fires the moment it matters.
      actions-subpaths:
        patterns:
          - 'actions/cache*'
      patch-updates:
        update-types:
          - 'patch'
```

- [ ] **Step 11: README.** Replace the `## Development` code block with:

```sh
npm ci                # Node 24 (see .nvmrc); engine-strict is on
npm run format:check  # Prettier
npm run lint          # ESLint, zero warnings
npm run typecheck     # tsc and svelte-check
npm run test:unit
npm run build
```

- [ ] **Step 12: Run the whole gate.** In order: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`. Expected: each exits 0. Unit: **26 passed** (licences 5, supply-chain 11, fail-on-warnings 10). `svelte-check` reports `0 ERRORS 0 WARNINGS`. Then `scripts/fail-on-warnings.sh npm ci` and `scripts/fail-on-warnings.sh npm run build` both exit 0.

- [ ] **Step 13: Commit.** `ci: workspaces, lint, typecheck, format and zero-warnings gates (Refs #13)`.

- [ ] **Step 14: Mutate (watch each apply; restore with `git checkout -- <file>`).** M12: replace `if grep -Eiq "$pattern" "$log"; then` with `if false; then` → **7 failed / 26**. M13: `<script lang="ts">` → `<script>` in `App.svelte` → `npm run lint` exits 1 on `svelte/block-lang`.

- [ ] **Step 15: PR and merge.** Push, then open a PR into `develop` whose body lists the AC and the gate output. Merge on green `build-and-test`, after reading every step BY NAME on the PR head SHA (matched to `headRefOid`).

---

### Task 2: Environment-only secrets guard (spec §12.9)

**Story AC:**

1. `tests/unit/workflow-secrets.ts` parses each workflow as YAML, so comments never reach the check. It reports every reference to the secrets context other than `secrets.GITHUB_TOKEN` (`secrets.X`, `secrets['X']`, `toJSON(secrets)`, a `secrets:` key) that sits outside a job whose `environment` is `dev` or `production` (string or `{ name }` form).
2. A secret in workflow-level `env`, or anywhere outside `jobs`, is a finding.
3. A `pull_request_target` trigger is a finding on its own.
4. Fixture tests pin each shape, including a commented-out `environment:` that must not satisfy the guard. A real-repo test scans every workflow, requires each to have jobs, and requires zero findings.

**Files:**

- Create: `tests/unit/workflow-secrets.ts`, `tests/unit/workflow-secrets.test.ts`
- Modify: `package.json` (`yaml` devDependency), `package-lock.json`

**Interfaces:**

- Produces: `scanWorkflow(file: string, source: string): Scan`, where `Scan = { jobs: number; secretReferences: number; findings: Finding[] }` and `Finding = { where: string; problem: string }`. Also `PROTECTED_ENVIRONMENTS = ['dev', 'production'] as const`. Task 4 adds a liveness test that reads `secretReferences`.

- [ ] **Step 1: Branch and dependency.** `git switch -c m0/secrets-guard origin/develop`, then `npm install -D yaml@^2.9.1`.

- [ ] **Step 2: Write the failing tests.**

`tests/unit/workflow-secrets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanWorkflow } from './workflow-secrets';

/**
 * Deploy secrets live only in environments (spec §12.9). The fixtures pin the
 * scanner's behaviour on each shape a secret reference can take; the last
 * block runs it over this repo's real workflows.
 */

const workflow = (jobs: string, top = '') =>
  `name: x\non:\n  push:\n${top}jobs:\n${jobs}`;

const job = (body: string) =>
  `  deploy:\n    runs-on: ubuntu-latest\n${body}    steps:\n      - run: wrangler deploy\n        env:\n          TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}\n`;

const problems = (source: string) =>
  scanWorkflow('w.yml', source).findings.map((f) => f.problem);

describe('scanWorkflow', () => {
  it('accepts a secret in a job that declares the dev environment', () => {
    const scan = scanWorkflow('w.yml', workflow(job('    environment: dev\n')));
    expect(scan.secretReferences).toBe(1);
    expect(scan.findings).toEqual([]);
  });

  it('accepts the long form, environment: { name: production, url }', () => {
    const scan = scanWorkflow(
      'w.yml',
      workflow(
        job(
          '    environment:\n      name: production\n      url: https://x.test\n',
        ),
      ),
    );
    expect(scan.secretReferences).toBe(1);
    expect(scan.findings).toEqual([]);
  });

  it('flags a secret in a job with no environment', () => {
    expect(problems(workflow(job('')))).toEqual([
      'secrets.CLOUDFLARE_API_TOKEN in a job that declares no environment; it must be one of dev, production',
    ]);
  });

  it('flags a secret in a job whose environment is not a protected one', () => {
    expect(problems(workflow(job('    environment: scratch\n')))).toEqual([
      'secrets.CLOUDFLARE_API_TOKEN in a job that declares environment "scratch"; it must be one of dev, production',
    ]);
  });

  it('flags an environment chosen by expression, since nothing can check it', () => {
    const findings = problems(
      workflow(job('    environment: ${{ inputs.target }}\n')),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain(
      'declares environment "${{ inputs.target }}"',
    );
  });

  it.each([
    [
      'bracket syntax',
      "${{ secrets['CLOUDFLARE_API_TOKEN'] }}",
      "secrets['CLOUDFLARE_API_TOKEN']",
    ],
    ['the whole context', '${{ toJSON(secrets) }}', 'secrets'],
  ])('sees %s', (_label, expression, reported) => {
    const source = workflow(
      `  leak:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "${expression}"\n`,
    );
    expect(problems(source)).toEqual([
      `${reported} in a job that declares no environment; it must be one of dev, production`,
    ]);
  });

  it('sees secrets: inherit on a reusable-workflow call', () => {
    const source = workflow(
      '  call:\n    uses: ./.github/workflows/deploy.yml\n    secrets: inherit\n',
    );
    expect(problems(source)).toEqual([
      'secrets in a job that declares no environment; it must be one of dev, production',
    ]);
  });

  it('flags a secret in workflow-level env, which no environment can guard', () => {
    const source = workflow(
      '  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n',
      'env:\n  TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n',
    );
    expect(problems(source)).toEqual([
      'secrets.CLOUDFLARE_API_TOKEN outside any job, so no environment can protect it',
    ]);
  });

  it('ignores GITHUB_TOKEN, which GitHub mints per run', () => {
    const source = workflow(
      '  status:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gh api x\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n',
    );
    const scan = scanWorkflow('w.yml', source);
    expect(scan.secretReferences).toBe(0);
    expect(scan.findings).toEqual([]);
  });

  it('is not satisfied or tripped by a comment', () => {
    const source = workflow(
      '  test:\n    runs-on: ubuntu-latest\n    # environment: dev  -- reads ${{ secrets.CLOUDFLARE_API_TOKEN }}\n    steps:\n      - run: npm test\n',
    );
    const scan = scanWorkflow('w.yml', source);
    expect(scan.secretReferences).toBe(0);
    expect(scan.findings).toEqual([]);
  });

  it('refuses pull_request_target outright', () => {
    const source =
      'on:\n  pull_request_target:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n';
    expect(problems(source)).toEqual([
      'pull_request_target runs fork code with this repo’s secrets and a write token',
    ]);
  });
});

describe('this repo’s workflows keep every secret inside an environment', () => {
  // Read inside each test, not in the describe body: a throw at collection
  // time fails the file as "no tests" instead of naming the broken assertion.
  const dir = '.github/workflows';
  const scanAll = () =>
    readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .map((file) => ({
        file,
        scan: scanWorkflow(file, readFileSync(join(dir, file), 'utf8')),
      }));

  it('scans every workflow, and every one has jobs', () => {
    const scans = scanAll();
    expect(scans.length, 'positive control: workflows found').toBeGreaterThan(
      0,
    );
    expect(
      scans.filter(({ scan }) => scan.jobs === 0).map(({ file }) => file),
    ).toEqual([]);
  });

  it('no secret is read outside a protected environment', () => {
    expect(scanAll().flatMap(({ scan }) => scan.findings)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run red against a stub.** Create `tests/unit/workflow-secrets.ts` exporting the `Finding`/`Scan` types, `PROTECTED_ENVIRONMENTS`, and `export function scanWorkflow(file: string, source: string): Scan { throw new Error('not implemented'); }`.
      Run: `npx vitest run tests/unit/workflow-secrets.test.ts`
      Expected: **14 failed**, each on `not implemented`. If any test passes, that is a finding: stop and fix the test.

- [ ] **Step 4: Implement.**

`tests/unit/workflow-secrets.ts`:

```ts
import { parse } from 'yaml';

/**
 * Where a workflow may read a secret (spec §12.9).
 *
 * The agent App has `workflows: write`, and this repo is public, so anyone can
 * open a fork PR that runs workflows. That is safe only while every secret is
 * an ENVIRONMENT secret: GitHub hands those to a job only if the job names the
 * environment, and `dev` and `production` each admit one branch. A secret read
 * outside such a job can only be a repository secret, which any workflow on
 * any branch can read, so the rule this enforces is "no secret reference
 * outside a job that declares one of the protected environments".
 *
 * The workflow is PARSED, not grepped. Comments never reach the parsed tree,
 * so a comment naming `secrets.X` can neither satisfy nor trip this guard
 * (the source-text rule, applied by construction).
 */

export const PROTECTED_ENVIRONMENTS = ['dev', 'production'] as const;

/** The token GitHub mints per run. It is not a stored secret. */
const RUN_TOKEN = 'secrets.GITHUB_TOKEN';

export interface Finding {
  where: string;
  problem: string;
}

export interface Scan {
  jobs: number;
  secretReferences: number;
  findings: Finding[];
}

type Yaml = unknown;

const isRecord = (value: Yaml): value is Record<string, Yaml> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every string in a parsed YAML value, keys included. */
function strings(value: Yaml): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) => [
      key,
      ...strings(child),
    ]);
  }
  return [];
}

/**
 * Each reference to the secrets context in a string, minus the run token.
 * Matches `secrets.X`, `secrets['X']`, `toJSON(secrets)` and a bare
 * `secrets` key (a reusable-workflow call's `secrets: inherit` or map).
 */
function secretReferences(text: string): string[] {
  return (
    text.match(/\bsecrets\b(?:\.[A-Za-z_][A-Za-z0-9_]*|\s*\[[^\]]*\])?/g) ?? []
  ).filter((ref) => ref !== RUN_TOKEN);
}

function environmentName(environment: Yaml): string | undefined {
  if (typeof environment === 'string') return environment;
  if (isRecord(environment) && typeof environment.name === 'string') {
    return environment.name;
  }
  return undefined;
}

export function scanWorkflow(file: string, source: string): Scan {
  const doc: Yaml = parse(source);
  if (!isRecord(doc)) {
    return {
      jobs: 0,
      secretReferences: 0,
      findings: [{ where: file, problem: 'not a YAML mapping' }],
    };
  }
  const findings: Finding[] = [];
  let references = 0;

  const triggers = isRecord(doc.on)
    ? Object.keys(doc.on)
    : typeof doc.on === 'string'
      ? [doc.on]
      : Array.isArray(doc.on)
        ? doc.on.filter((t): t is string => typeof t === 'string')
        : [];
  if (triggers.includes('pull_request_target')) {
    findings.push({
      where: `${file}: on`,
      problem:
        'pull_request_target runs fork code with this repo’s secrets and a write token',
    });
  }

  for (const key of Object.keys(doc).filter((k) => k !== 'jobs')) {
    const refs = secretReferences(strings(doc[key]).join('\n'));
    references += refs.length;
    for (const ref of refs) {
      findings.push({
        where: `${file}: ${key}`,
        problem: `${ref} outside any job, so no environment can protect it`,
      });
    }
  }

  const jobs = isRecord(doc.jobs) ? Object.entries(doc.jobs) : [];
  for (const [id, job] of jobs) {
    const refs = secretReferences(strings(job).join('\n'));
    references += refs.length;
    if (refs.length === 0) continue;
    const name = isRecord(job) ? environmentName(job.environment) : undefined;
    const isProtected = (PROTECTED_ENVIRONMENTS as readonly string[]).includes(
      name ?? '',
    );
    if (!isProtected) {
      const declared =
        name === undefined
          ? 'declares no environment'
          : `declares environment "${name}"`;
      for (const ref of refs) {
        findings.push({
          where: `${file}: jobs.${id}`,
          problem: `${ref} in a job that ${declared}; it must be one of ${PROTECTED_ENVIRONMENTS.join(', ')}`,
        });
      }
    }
  }

  return { jobs: jobs.length, secretReferences: references, findings };
}
```

- [ ] **Step 5: Run green.** `npx vitest run tests/unit/workflow-secrets.test.ts` → 14 passed. Then the whole gate: unit **40 passed**, and lint, typecheck, format and build exit 0.

- [ ] **Step 6: Commit (`test: secrets live only in protected environments (Refs #14)`), then mutate.** M2: in `ci.yml`, directly under `    runs-on: ubuntu-latest`, insert `    # environment: dev`, `    env:`, `      LEAK: ${{ secrets.CLOUDFLARE_API_TOKEN }}` → **1 failed / 40** (the comment must not satisfy the guard). M4: `  pull_request:` → `  pull_request_target:` → **1 failed / 40**. Restore with `git checkout -- .github/workflows/ci.yml` after each, then PR and merge as in Task 1.

---

### Task 3: Sync Worker on D1, tested inside workerd

**Story AC:**

1. `apps/sync-worker` serves `GET /health`: 200 `{ ok: true, commit, db: 'ok' }` after `SELECT 1` runs on D1. When D1 throws, it serves 503 `{ ok: false, commit, db: 'unreachable' }`. Every response is `cache-control: no-store`.
2. Any other method on `/health` gets 405 with `allow: GET`. Any other path, including `/health/` and `/HEALTH`, gets 404 `{ error: 'not_found' }`.
3. Tests run inside workerd against real local D1 via `@cloudflare/vitest-pool-workers`, with bindings read from `wrangler.jsonc`.
4. `wrangler.jsonc` binds D1 `wordfarer-dev` (`7ef754ed-f21e-4524-ac11-eac9bde28cc0`) as `DB`, with `COMMIT` defaulting to `"local"` and `migrations_dir` `migrations`.
5. Worker types are generated on install (`postinstall`) and git-ignored, so a wrangler bump never needs a hand-regenerated file.
6. The lock holds exactly one wrangler, one miniflare and one workerd. The test pool's pinned wrangler and miniflare are overridden to the patched ones, and `npm audit` reports 0 vulnerabilities.
7. CI runs the Worker tests.

**Files:**

- Create: `apps/sync-worker/{package.json,wrangler.jsonc,tsconfig.json,vitest.config.ts,src/index.ts,test/health.test.ts,migrations/README.md}`, `tests/unit/worker-runtime.test.ts`
- Modify: `package.json` (wrangler, overrides, `postinstall`, `test:worker`), `package-lock.json`, `.gitignore`, `eslint.config.js`, `vitest.config.ts`, `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: the root scripts from Task 1.
- Produces: the default export `{ fetch(request: Request, env: Env): Promise<Response> }`, where `Env = { DB: D1Database; COMMIT: string }` (generated). The deployed `/health` contract that Task 4's `healthProblems` checks is exactly `{"ok":true,"commit":"<sha>","db":"ok"}`.

- [ ] **Step 1: Branch.** `git switch -c m0/sync-worker origin/develop`.

- [ ] **Step 2: Workspace and config.** Write these, then `npm install`. Expected: no warnings, and `found 0 vulnerabilities`. Without the `overrides` block, `npm audit` reports 5 high (sharp, undici) through `@cloudflare/vitest-pool-workers@0.22.0`'s pinned wrangler 4.124.0 and miniflare 5.20260815.0-alpha. `postinstall` writes `apps/sync-worker/worker-configuration.d.ts`.

`package.json`:

```json
{
  "name": "wordfarer",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "postinstall": "npm run types --workspace @wordfarer/sync-worker",
    "test:unit": "vitest run",
    "test:worker": "npm run test --workspace @wordfarer/sync-worker",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit && npm run typecheck --workspaces --if-present",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "@types/node": "^24.0.0",
    "eslint": "^10.11.0",
    "eslint-plugin-svelte": "^3.23.0",
    "globals": "^17.0.0",
    "prettier": "^3.9.9",
    "prettier-plugin-svelte": "^4.1.1",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.71.0",
    "vitest": "^4.1.11",
    "wrangler": "^4.145.0",
    "yaml": "^2.9.1"
  },
  "allowScripts": {
    "esbuild": true,
    "fsevents": false,
    "workerd": true
  },
  "overrides": {
    "@cloudflare/vitest-pool-workers": {
      "wrangler": "$wrangler",
      "miniflare": "5.20260930.0-alpha"
    }
  }
}
```

`apps/sync-worker/package.json`:

```json
{
  "name": "@wordfarer/sync-worker",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "types": "wrangler types --strict-vars=false",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.22.0"
  }
}
```

`apps/sync-worker/wrangler.jsonc`:

```jsonc
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

`apps/sync-worker/tsconfig.json`:

```json
{
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
    "types": [
      "./worker-configuration.d.ts",
      "@cloudflare/vitest-pool-workers/types"
    ]
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "*.ts"]
}
```

`apps/sync-worker/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

/**
 * Tests run INSIDE workerd against real local D1 (Miniflare), spec §12.4,
 * with the bindings read from wrangler.jsonc so a test can never pass against
 * a binding the deployed Worker does not have.
 */
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  test: {
    include: ['test/**/*.test.ts'],
  },
});
```

`apps/sync-worker/migrations/README.md`:

```markdown
# D1 migrations

SQL files applied in order by `wrangler d1 migrations apply`, which the dev
deploy runs against `wordfarer-dev` BEFORE it deploys the Worker, so new code
never meets an old schema. Name each one `NNNN_what_it_does.sql`
(`wrangler d1 migrations create wordfarer-dev <what_it_does>` does this).
The first arrives with the data model in M4 (spec §6.7).
```

`.gitignore`:

```
# Dependencies and builds
node_modules/
dist/
build/
.vite/
coverage/
reports/mutation/

# Test output
playwright-report/
test-results/

# Cloudflare local state
.wrangler/
.dev.vars
# Generated on install by `wrangler types` (root postinstall)
apps/sync-worker/worker-configuration.d.ts

# Session-local agent files (brainstorm mockups, SDD scratch)
.superpowers/

# OS
.DS_Store
```

`eslint.config.js`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './apps/web/svelte.config.js';

/**
 * One flat config for the whole monorepo. `--max-warnings 0` in the lint
 * script makes every warning a failure (zero-warnings policy, spec §12).
 *
 * Type-aware rules (`strictTypeChecked`) use the TypeScript project service,
 * which finds the nearest tsconfig.json for each file, so every workspace is
 * linted against its own compiler options.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.wrangler/**',
      'apps/sync-worker/worker-configuration.d.ts',
      'coverage/**',
      'reports/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { parser: tseslint.parser, svelteConfig },
    },
    rules: {
      // A component without <script lang="ts"> is compiled as JavaScript and
      // imports as `any` under strict TypeScript (measured while planning M0).
      'svelte/block-lang': ['error', { script: 'ts' }],
    },
  },
  {
    files: ['apps/web/src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

/**
 * The root suite: repo guards (tests/) and every workspace that runs in plain
 * Node. apps/sync-worker is excluded because its tests run INSIDE workerd via
 * @cloudflare/vitest-pool-workers, under its own config (npm run test:worker).
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'apps/web/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
```

- [ ] **Step 3: Write the failing tests.**

`apps/sync-worker/test/health.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import worker from '../src/index';

const call = (path: string, init?: RequestInit) =>
  exports.default.fetch(new Request(`https://sync.test${path}`, init));

describe('GET /health', () => {
  it('reports ok, the commit and a D1 that answers', async () => {
    const response = await call('/health');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      ok: true,
      commit: 'local',
      db: 'ok',
    });
  });

  it('reports the commit it was deployed with', async () => {
    const sha = 'd547bd669678987eb85b5807d1a26ea55eaeb987';
    const response = await worker.fetch(
      new Request('https://sync.test/health'),
      { ...env, COMMIT: sha },
    );
    expect(await response.json()).toMatchObject({ commit: sha });
  });

  it('answers 503, not 200, when D1 throws', async () => {
    const broken = {
      prepare: () => {
        throw new Error('D1_ERROR: no such database');
      },
    } as unknown as D1Database;
    const response = await worker.fetch(
      new Request('https://sync.test/health'),
      { ...env, DB: broken },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      commit: 'local',
      db: 'unreachable',
    });
  });

  it('refuses every method but GET, naming the one it allows', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const response = await call('/health', { method });
      expect(response.status, method).toBe(405);
      expect(response.headers.get('allow'), method).toBe('GET');
    }
  });

  it.each(['/', '/healthz', '/health/', '/HEALTH', '/health/extra'])(
    'answers 404 for %s',
    async (path) => {
      const response = await call(path);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
    },
  );
});
```

`tests/unit/worker-runtime.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The Worker tests run on the same runtime that deploys.
 *
 * @cloudflare/vitest-pool-workers pins its own wrangler and miniflare, and
 * 0.22.0 pinned versions carrying five high advisories (sharp, undici). The
 * root `overrides` points it at the root wrangler and a patched miniflare.
 * When Dependabot bumps wrangler, the miniflare override goes stale and the
 * lock grows a second copy: the tests would then run on one workerd while
 * `wrangler deploy` ships for another. This fails that bump until the
 * override is updated to the miniflare the new wrangler depends on.
 */

interface PackageLock {
  packages: Record<string, { version?: string }>;
}

const versionsOf = (name: string) => {
  const lock = JSON.parse(
    readFileSync('package-lock.json', 'utf8'),
  ) as PackageLock;
  const suffix = `node_modules/${name}`;
  return [
    ...new Set(
      Object.entries(lock.packages)
        .filter(([path]) => path === suffix || path.endsWith(`/${suffix}`))
        .map(([, entry]) => entry.version ?? '(none)'),
    ),
  ];
};

describe('one Workers runtime in the lock', () => {
  it.each(['wrangler', 'miniflare', 'workerd'])(
    'exactly one version of %s',
    (name) => {
      expect(versionsOf(name)).toHaveLength(1);
    },
  );
});
```

- [ ] **Step 4: Run red.** Create `apps/sync-worker/src/index.ts` as `export default { fetch(): Promise<Response> { throw new Error('not implemented'); } } satisfies ExportedHandler<Env>;`.
      Run: `npm run test:worker` → **9 failed**. Then `npx vitest run tests/unit/worker-runtime.test.ts` → 3 passed. That test is a lock invariant, not new behaviour, and its red is shown by M16 in Step 7.

- [ ] **Step 5: Implement.**

`apps/sync-worker/src/index.ts`:

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
  } catch {
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

- [ ] **Step 6: Run green.** `npm run test:worker` → **9 passed**. Then add the CI step and run the whole gate: unit **43 passed**, worker 9 passed, and every other step exits 0.

`.github/workflows/ci.yml`:

```yaml
# Every third-party `uses:` is a full 40-hex commit SHA with a trailing
# `# vX.Y.Z` comment. A tag is mutable and can be repointed by anyone who can
# push to that action's repo; the SHA is the only immutable reference. The
# comment is what makes a Dependabot bump reviewable by a human rather than an
# opaque hex swap -- so never remove it, and never let it drift from the SHA.
name: build-and-test
on:
  pull_request:
  push:
    branches: [develop]

permissions:
  contents: read

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - name: Install (a warning fails it)
        run: scripts/fail-on-warnings.sh npm ci
      - name: Format
        run: npm run format:check
      - name: Lint (zero warnings)
        run: npm run lint
      - name: Typecheck (tsc, svelte-check)
        run: npm run typecheck
      - name: Unit tests
        run: npm run test:unit
      - name: Worker tests (workerd + local D1)
        run: npm run test:worker
      - name: Build (a warning fails it)
        run: scripts/fail-on-warnings.sh npm run build
```

README: add `npm run test:worker   # the sync Worker, inside workerd with local D1` after `test:unit`, and a line under the block: "`npm ci` also generates the Worker's types (`apps/sync-worker/worker-configuration.d.ts`, git-ignored)."

- [ ] **Step 7: Commit (`feat(sync-worker): /health on D1, tested in workerd (Refs #15)`), then mutate.** M10: the D1 catch returns `200 { ok: true, … db: 'ok' }` → 1 failed / 9. M11: `pathname !== '/health'` → `!pathname.toLowerCase().startsWith('/health')` → 4 failed / 9. M17: delete the `await env.DB.prepare('SELECT 1').run();` line → 1 failed / 9 (a health check that never touches D1). M16: insert a lock entry `node_modules/@cloudflare/vitest-pool-workers/node_modules/miniflare` at version `5.20260815.0-alpha` → 1 failed / 43. Restore after each, then PR and merge.

---

### Task 4: Dev deploy pipeline, verified live behind Access

**Story AC:**

1. The web build stamps `<meta name="wordfarer-commit">` with `WORDFARER_COMMIT`. A full 40-hex SHA is written. An unset value becomes `local`. Anything else fails the build, and so does a page carrying the placeholder zero times or more than once.
2. `apps/web` deploys as the Worker `wordfarer-web-dev` with static assets (`not_found_handling: single-page-application`). Spec D9, §6.1, §13 and `CLAUDE.md` say so (operator decision 2026-10-01).
3. `deploy-dev.yml` runs on every push to `develop`, in order: CI via `workflow_call`, D1 migrations, the sync Worker (`--var COMMIT:<sha>`), the web build and deploy, and verify. The deploy and verify jobs declare the `dev` environment. Concurrency is `deploy-dev` without cancellation.
4. `ci.yml` drops its own `push: develop` trigger and gains `workflow_call`, so a develop push runs CI once, inside the deploy.
5. `scripts/verify-dev.ts` fails unless all three hold: both hostnames refuse anonymous requests (401/403, or a redirect to `*.cloudflareaccess.com`); with the service token, the page carries this SHA; and `/health` returns exactly `{ok:true, commit: sha, db:'ok'}`. The token checks retry 12 × 10 s and the gate check does not retry. It is tested over real HTTP against a local server that stands in for Access.
6. On success, verify posts a `dev-verified` commit status on the deployed SHA.
7. The secrets guard proves its own liveness by finding the four Cloudflare secrets in `deploy-dev.yml`.
8. After merge, the run is green with every job read BY NAME. `dev-verified` is read off the commit. Both URLs, opened in a browser without logging in, land on the Access login.

**Files:**

- Create: `apps/web/commit-stamp.ts`, `apps/web/commit-stamp.test.ts`, `apps/web/wrangler.jsonc`, `scripts/verify-dev.ts`, `tests/unit/verify-dev.test.ts`, `.github/workflows/deploy-dev.yml`
- Modify: `apps/web/{vite.config.ts,index.html,tsconfig.json}`, `tsconfig.json`, `.github/workflows/ci.yml`, `tests/unit/workflow-secrets.test.ts`, `docs/superpowers/specs/2026-10-01-wordfarer-design.md`, `CLAUDE.md`, `README.md`

**Interfaces:**

- Consumes: `scanWorkflow` (Task 2) and the `/health` contract (Task 3).
- Produces: `stampCommit(html: string, commit: string | undefined): string`, `commitStamp(commit: string | undefined): Plugin`, `gateProblems(label: string, probe: Probe): string[]`, `webProblems(probe: Probe, sha: string): string[]`, `healthProblems(probe: Probe, sha: string): string[]`, and `verifyDev(target: Target, { attempts, delayMs }): Promise<string[]>`, where `Probe = { status: number; location: string | null; body: string }` and `Target = { webUrl; syncUrl; sha; clientId; clientSecret }`.

- [ ] **Step 1: Branch.** `git switch -c m0/deploy-dev origin/develop`. Confirm the operator setup is done (ask Shyden). Without it the PR can still merge, but its deploy goes red at the first wrangler call.

- [ ] **Step 2: Write the failing tests.**

`apps/web/commit-stamp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stampCommit } from './commit-stamp';

const SHA = 'd547bd669678987eb85b5807d1a26ea55eaeb987';
const page = '<meta name="wordfarer-commit" content="%WORDFARER_COMMIT%" />';

describe('stampCommit', () => {
  it('writes a full SHA into the placeholder', () => {
    expect(stampCommit(page, SHA)).toBe(
      `<meta name="wordfarer-commit" content="${SHA}" />`,
    );
  });

  it('marks a build with no commit as local, never as a SHA', () => {
    expect(stampCommit(page, undefined)).toContain('content="local"');
    expect(stampCommit(page, '')).toContain('content="local"');
  });

  it.each([
    ['a short SHA', SHA.slice(0, 7)],
    ['an uppercase SHA', SHA.toUpperCase()],
    ['41 characters', `${SHA}0`],
    ['a branch name', 'develop'],
  ])('refuses %s', (_label, commit) => {
    expect(() => stampCommit(page, commit)).toThrow(/full 40-hex SHA/);
  });

  it('refuses a page with no placeholder, so a renamed meta tag cannot ship unstamped', () => {
    expect(() => stampCommit('<title>x</title>', SHA)).toThrow(/exactly once/);
  });

  it('refuses a page with two placeholders', () => {
    expect(() => stampCommit(page + page, SHA)).toThrow(/found 2/);
  });
});
```

`tests/unit/verify-dev.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  gateProblems,
  healthProblems,
  verifyDev,
  webProblems,
  type Probe,
} from '../../scripts/verify-dev';

const SHA = 'd547bd669678987eb85b5807d1a26ea55eaeb987';
const OLD = '1f660b30f75d081ae6559d175e5c0c3e26acb84c';
const page = (sha: string) =>
  `<html><head><meta name="wordfarer-commit" content="${sha}" /></head></html>`;
const probe = (
  status: number,
  body = '',
  location: string | null = null,
): Probe => ({
  status,
  body,
  location,
});

describe('gateProblems', () => {
  it.each([401, 403])('accepts a %i refusal', (status) => {
    expect(gateProblems('web', probe(status))).toEqual([]);
  });

  it('accepts a redirect to the Access login', () => {
    expect(
      gateProblems(
        'web',
        probe(
          302,
          '',
          'https://shyden.cloudflareaccess.com/cdn-cgi/access/login/x',
        ),
      ),
    ).toEqual([]);
  });

  it('refuses a redirect anywhere else, including a look-alike host', () => {
    expect(
      gateProblems(
        'web',
        probe(302, '', 'https://cloudflareaccess.com.evil.test/'),
      ),
    ).toEqual([
      'web: redirects to https://cloudflareaccess.com.evil.test/, not to Cloudflare Access',
    ]);
  });

  it('fails when the site answers 200 to an anonymous request', () => {
    expect(gateProblems('sync', probe(200))).toEqual([
      'sync: answered 200 without a service token; the Access gate is not in front of it',
    ]);
  });
});

describe('webProblems', () => {
  it('accepts the expected commit', () => {
    expect(webProblems(probe(200, page(SHA)), SHA)).toEqual([]);
  });

  it('names the stale commit when the previous deploy is still served', () => {
    expect(webProblems(probe(200, page(OLD)), SHA)).toEqual([
      `web: serves commit ${OLD}, expected ${SHA}`,
    ]);
  });

  it('fails a page with no stamp, and a non-200', () => {
    expect(webProblems(probe(200, '<html></html>'), SHA)).toEqual([
      'web: no wordfarer-commit meta tag in the page',
    ]);
    expect(webProblems(probe(500, page(SHA)), SHA)).toEqual([
      'web: status 500, expected 200',
    ]);
  });
});

describe('healthProblems', () => {
  const healthy = JSON.stringify({ ok: true, commit: SHA, db: 'ok' });

  it('accepts ok, the commit and db ok', () => {
    expect(healthProblems(probe(200, healthy), SHA)).toEqual([]);
  });

  it.each([
    ['a stale commit', { ok: true, commit: OLD, db: 'ok' }],
    ['a D1 failure', { ok: false, commit: SHA, db: 'unreachable' }],
    ['an extra field', { ok: true, commit: SHA, db: 'ok', debug: 1 }],
  ])('fails %s', (_label, body) => {
    expect(healthProblems(probe(200, JSON.stringify(body)), SHA)).toHaveLength(
      1,
    );
  });

  it('fails a non-JSON body and a non-200', () => {
    expect(healthProblems(probe(200, 'oops'), SHA)).toEqual([
      'sync: /health did not return JSON',
    ]);
    expect(healthProblems(probe(503, healthy), SHA)).toEqual([
      'sync: /health status 503, expected 200',
    ]);
  });
});

/**
 * verifyDev end to end over real HTTP: a local server stands in for Access,
 * answering a 302 to the login host without the service-token headers and
 * the site with them. `served` is the commit it currently serves.
 */
describe('verifyDev', () => {
  let server: Server;
  let base = '';
  let served = SHA;
  let gated = true;
  let requests = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      requests += 1;
      const authorised =
        req.headers['cf-access-client-id'] === 'id' &&
        req.headers['cf-access-client-secret'] === 'secret';
      if (gated && !authorised) {
        res.writeHead(302, {
          location: 'https://team.cloudflareaccess.com/cdn-cgi/access/login',
        });
        res.end();
        return;
      }
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, commit: served, db: 'ok' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
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
    clientId: 'id',
    clientSecret: 'secret',
  });

  it('passes a gated site serving the expected commit', async () => {
    served = SHA;
    gated = true;
    requests = 0;
    expect(await verifyDev(target(), { attempts: 1, delayMs: 0 })).toEqual([]);
    expect(
      requests,
      'two anonymous probes, then web and health with the token',
    ).toBe(4);
  });

  it('fails, without retrying, when the gate is gone', async () => {
    served = SHA;
    gated = false;
    requests = 0;
    expect(await verifyDev(target(), { attempts: 3, delayMs: 0 })).toEqual([
      'web: answered 200 without a service token; the Access gate is not in front of it',
      'sync: answered 200 without a service token; the Access gate is not in front of it',
    ]);
    expect(requests).toBe(2);
    gated = true;
  });

  it('retries a stale deploy, then reports both stale hosts', async () => {
    served = OLD;
    requests = 0;
    const problems = await verifyDev(target(), { attempts: 3, delayMs: 0 });
    expect(problems).toEqual([
      `web: serves commit ${OLD}, expected ${SHA}`,
      `sync: /health returned ${JSON.stringify({ ok: true, commit: OLD, db: 'ok' })}, expected ${JSON.stringify({ ok: true, commit: SHA, db: 'ok' })}`,
    ]);
    expect(requests, 'two gate probes plus three attempts of two').toBe(8);
    served = SHA;
  });
});
```

- [ ] **Step 3: Run red against stubs.** Create `apps/web/commit-stamp.ts` and `scripts/verify-dev.ts` with the exported signatures above, each body `throw new Error('not implemented');` (and `export const commitStamp = () => ({ name: 'stub' })`). Add `"scripts/**/*.ts"` to the root `tsconfig.json` `include`.
      Run: `npx vitest run apps/web tests/unit/verify-dev.test.ts`
      Expected: **24 failed** (commit-stamp 8, verify-dev 16), and none passing. `toThrow(/full 40-hex SHA/)` and `toThrow(/exactly once/)` match the message, so the stub's own throw cannot satisfy them.

- [ ] **Step 4: Implement.**

`apps/web/commit-stamp.ts`:

```ts
import type { Plugin } from 'vite';

/**
 * Stamps the commit a build came from into index.html, so the dev deploy's
 * verify job can prove the bytes it serves are the bytes this commit built.
 *
 * `wrangler pages deploy` exiting 0 only says an upload happened. A verify that
 * reads this stamp back off the live URL and compares it to `github.sha` is
 * the only check that the live site is THIS commit, not the previous one.
 */

const PLACEHOLDER = '%WORDFARER_COMMIT%';
const LOCAL = 'local';

export function stampCommit(html: string, commit: string | undefined): string {
  const value = commit === undefined || commit === '' ? LOCAL : commit;
  if (value !== LOCAL && !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(
      `WORDFARER_COMMIT must be a full 40-hex SHA, got ${JSON.stringify(value)}`,
    );
  }
  const occurrences = html.split(PLACEHOLDER).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `index.html must carry ${PLACEHOLDER} exactly once, found ${String(occurrences)}`,
    );
  }
  return html.replace(PLACEHOLDER, value);
}

export const commitStamp = (commit: string | undefined): Plugin => ({
  name: 'wordfarer-commit-stamp',
  transformIndexHtml: (html) => stampCommit(html, commit),
});
```

`scripts/verify-dev.ts`:

```ts
/**
 * Verifies a dev deploy from the outside, the way a tester's browser sees it.
 *
 * `wrangler deploy` exiting 0 says an upload happened. It does not say the
 * live URL serves THIS commit, that D1 answers, or that the Access gate still
 * keeps the public out. Each of those is checked here, and the run fails on
 * the first that does not hold:
 *
 * 1. Without a service token, both hostnames refuse (Access redirect or 401/403).
 *    A gate that has quietly gone away fails this, not just a broken site.
 * 2. With the token, the web page carries `wordfarer-commit` = the expected SHA.
 * 3. With the token, the Worker's /health reports ok, that SHA, and db "ok".
 *
 * Checks 2 and 3 retry, because the previous deploy can be served for a few
 * seconds after the upload finishes. Check 1 does not need to.
 */

export interface Probe {
  status: number;
  location: string | null;
  body: string;
}

export interface Target {
  webUrl: string;
  syncUrl: string;
  sha: string;
  clientId: string;
  clientSecret: string;
}

const ACCESS_LOGIN_HOST = /\.cloudflareaccess\.com$/;

export function gateProblems(label: string, probe: Probe): string[] {
  if (probe.status === 401 || probe.status === 403) return [];
  if (probe.status === 302 || probe.status === 303) {
    const host =
      probe.location === null ? '' : new URL(probe.location).hostname;
    return ACCESS_LOGIN_HOST.test(host)
      ? []
      : [
          `${label}: redirects to ${probe.location ?? 'nowhere'}, not to Cloudflare Access`,
        ];
  }
  return [
    `${label}: answered ${String(probe.status)} without a service token; the Access gate is not in front of it`,
  ];
}

export function webProblems(probe: Probe, sha: string): string[] {
  if (probe.status !== 200)
    return [`web: status ${String(probe.status)}, expected 200`];
  const stamp = /<meta name="wordfarer-commit" content="([^"]*)"/.exec(
    probe.body,
  )?.[1];
  if (stamp === undefined)
    return ['web: no wordfarer-commit meta tag in the page'];
  return stamp === sha ? [] : [`web: serves commit ${stamp}, expected ${sha}`];
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
  return JSON.stringify(body) === JSON.stringify(expected)
    ? []
    : [
        `sync: /health returned ${JSON.stringify(body)}, expected ${JSON.stringify(expected)}`,
      ];
}

async function probe(
  url: string,
  headers: Record<string, string> = {},
): Promise<Probe> {
  const response = await fetch(url, { headers, redirect: 'manual' });
  return {
    status: response.status,
    location: response.headers.get('location'),
    body: await response.text(),
  };
}

export async function verifyDev(
  target: Target,
  { attempts, delayMs }: { attempts: number; delayMs: number },
): Promise<string[]> {
  const healthUrl = new URL('/health', target.syncUrl).href;
  const gate = [
    ...gateProblems('web', await probe(target.webUrl)),
    ...gateProblems('sync', await probe(healthUrl)),
  ];
  if (gate.length > 0) return gate;

  const token = {
    'CF-Access-Client-Id': target.clientId,
    'CF-Access-Client-Secret': target.clientSecret,
  };
  let problems: string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    problems = [
      ...webProblems(await probe(target.webUrl, token), target.sha),
      ...healthProblems(await probe(healthUrl, token), target.sha),
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
      clientId: required('CF_ACCESS_CLIENT_ID'),
      clientSecret: required('CF_ACCESS_CLIENT_SECRET'),
    },
    { attempts: 12, delayMs: 10_000 },
  );
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    process.exit(1);
  }
  console.log('✓ dev is gated, serves the expected commit, and D1 answers');
}
```

`apps/web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { commitStamp } from './commit-stamp.ts';

export default defineConfig({
  plugins: [svelte(), commitStamp(process.env.WORDFARER_COMMIT)],
});
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="wordfarer-commit" content="%WORDFARER_COMMIT%" />
    <title>Wordfarer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "*.ts"]
}
```

`tsconfig.json`:

```json
{
  // The root project: repo guards under tests/ and root config files. Each
  // workspace under apps/ and packages/ has its own tsconfig.json and is
  // checked by its own `typecheck` script.
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["tests/**/*.ts", "scripts/**/*.ts", "vitest.config.ts"]
}
```

`vite.config.ts` imports `./commit-stamp.ts` with its extension, which is why `allowImportingTsExtensions` and `noEmit` are set. Without the extension, Vite 8 prints a `configLoader: 'native'` warning, and `fail-on-warnings.sh` fails the build on it (measured).

- [ ] **Step 5: Run green.** `npx vitest run apps/web tests/unit/verify-dev.test.ts` → 24 passed.

- [ ] **Step 6: Deploy config and workflows.**

`apps/web/wrangler.jsonc`:

```jsonc
// The DEV web app: a Worker with static assets and no script (spec D9, as
// amended 2026-10-01: Cloudflare now folds Pages into Workers). Requests for
// static assets are free and do not count as Worker invocations.
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "wordfarer-web-dev",
  "compatibility_date": "2026-09-30",
  "workers_dev": true,
  "preview_urls": false,
  "assets": {
    "directory": "./dist",
    // A PWA routes on the client, so an unknown path serves index.html.
    "not_found_handling": "single-page-application",
  },
}
```

`.github/workflows/ci.yml`:

```yaml
# Every third-party `uses:` is a full 40-hex commit SHA with a trailing
# `# vX.Y.Z` comment. A tag is mutable and can be repointed by anyone who can
# push to that action's repo; the SHA is the only immutable reference. The
# comment is what makes a Dependabot bump reviewable by a human rather than an
# opaque hex swap -- so never remove it, and never let it drift from the SHA.
#
# Runs on every PR (the required `build-and-test` check) and is called by
# deploy-dev.yml before each dev deploy, so develop never deploys a tree that
# has not passed here.
name: build-and-test
on:
  pull_request:
  workflow_call:

permissions:
  contents: read

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - name: Install (a warning fails it)
        run: scripts/fail-on-warnings.sh npm ci
      - name: Format
        run: npm run format:check
      - name: Lint (zero warnings)
        run: npm run lint
      - name: Typecheck (tsc, svelte-check, wrangler types)
        run: npm run typecheck
      - name: Unit tests
        run: npm run test:unit
      - name: Worker tests (workerd + local D1)
        run: npm run test:worker
      - name: Build (a warning fails it)
        run: scripts/fail-on-warnings.sh npm run build
```

`.github/workflows/deploy-dev.yml`:

```yaml
# Deploys develop to the dev environment on every merge (spec §13): D1
# migrations, then the sync Worker, then the web app (a static-assets Worker,
# spec D9), then a verify that reads all three back from the live URLs.
#
# Every Cloudflare secret is a `dev` ENVIRONMENT secret, and `dev` admits only
# the develop branch, so a fork PR or any other branch cannot reach them
# (spec §12.9, enforced by tests/unit/workflow-secrets.test.ts).
name: deploy-dev
on:
  push:
    branches: [develop]

permissions:
  contents: read

# Two merges in quick succession deploy in order; neither is cancelled, so the
# last one to finish is always the newest commit.
concurrency:
  group: deploy-dev
  cancel-in-progress: false

jobs:
  test:
    uses: ./.github/workflows/ci.yml

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: dev
      url: https://wordfarer-web-dev.shyden1988uk.workers.dev
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      WRANGLER_SEND_METRICS: 'false'
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - name: Apply D1 migrations (before the Worker, so new code never meets an old schema)
        working-directory: apps/sync-worker
        run: npx wrangler d1 migrations apply wordfarer-dev --remote
      - name: Deploy the sync Worker, stamped with this commit
        working-directory: apps/sync-worker
        run: npx wrangler deploy --var "COMMIT:${GITHUB_SHA}"
      - name: Build the web app, stamped with this commit
        env:
          WORDFARER_COMMIT: ${{ github.sha }}
        run: npm run build --workspace @wordfarer/web
      - name: Deploy the web app
        working-directory: apps/web
        run: npx wrangler deploy

  verify:
    needs: deploy
    runs-on: ubuntu-latest
    environment:
      name: dev
      url: https://wordfarer-web-dev.shyden1988uk.workers.dev
    permissions:
      contents: read
      statuses: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
      - name: Verify dev is gated, serves this commit, and D1 answers
        env:
          DEV_WEB_URL: https://wordfarer-web-dev.shyden1988uk.workers.dev/
          DEV_SYNC_URL: https://wordfarer-sync-dev.shyden1988uk.workers.dev
          EXPECTED_SHA: ${{ github.sha }}
          CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}
          CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
        run: node scripts/verify-dev.ts
      - name: Post dev-verified on the deployed commit
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: >-
          gh api "repos/${GITHUB_REPOSITORY}/statuses/${GITHUB_SHA}"
          -f state=success -f context=dev-verified
          -f description="Live on dev: gated, this commit, D1 answers"
          -f target_url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
```

`tests/unit/workflow-secrets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanWorkflow } from './workflow-secrets';

/**
 * Deploy secrets live only in environments (spec §12.9). The fixtures pin the
 * scanner's behaviour on each shape a secret reference can take; the last
 * block runs it over this repo's real workflows.
 */

const workflow = (jobs: string, top = '') =>
  `name: x\non:\n  push:\n${top}jobs:\n${jobs}`;

const job = (body: string) =>
  `  deploy:\n    runs-on: ubuntu-latest\n${body}    steps:\n      - run: wrangler deploy\n        env:\n          TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}\n`;

const problems = (source: string) =>
  scanWorkflow('w.yml', source).findings.map((f) => f.problem);

describe('scanWorkflow', () => {
  it('accepts a secret in a job that declares the dev environment', () => {
    const scan = scanWorkflow('w.yml', workflow(job('    environment: dev\n')));
    expect(scan.secretReferences).toBe(1);
    expect(scan.findings).toEqual([]);
  });

  it('accepts the long form, environment: { name: production, url }', () => {
    const scan = scanWorkflow(
      'w.yml',
      workflow(
        job(
          '    environment:\n      name: production\n      url: https://x.test\n',
        ),
      ),
    );
    expect(scan.secretReferences).toBe(1);
    expect(scan.findings).toEqual([]);
  });

  it('flags a secret in a job with no environment', () => {
    expect(problems(workflow(job('')))).toEqual([
      'secrets.CLOUDFLARE_API_TOKEN in a job that declares no environment; it must be one of dev, production',
    ]);
  });

  it('flags a secret in a job whose environment is not a protected one', () => {
    expect(problems(workflow(job('    environment: scratch\n')))).toEqual([
      'secrets.CLOUDFLARE_API_TOKEN in a job that declares environment "scratch"; it must be one of dev, production',
    ]);
  });

  it('flags an environment chosen by expression, since nothing can check it', () => {
    const findings = problems(
      workflow(job('    environment: ${{ inputs.target }}\n')),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain(
      'declares environment "${{ inputs.target }}"',
    );
  });

  it.each([
    [
      'bracket syntax',
      "${{ secrets['CLOUDFLARE_API_TOKEN'] }}",
      "secrets['CLOUDFLARE_API_TOKEN']",
    ],
    ['the whole context', '${{ toJSON(secrets) }}', 'secrets'],
  ])('sees %s', (_label, expression, reported) => {
    const source = workflow(
      `  leak:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "${expression}"\n`,
    );
    expect(problems(source)).toEqual([
      `${reported} in a job that declares no environment; it must be one of dev, production`,
    ]);
  });

  it('sees secrets: inherit on a reusable-workflow call', () => {
    const source = workflow(
      '  call:\n    uses: ./.github/workflows/deploy.yml\n    secrets: inherit\n',
    );
    expect(problems(source)).toEqual([
      'secrets in a job that declares no environment; it must be one of dev, production',
    ]);
  });

  it('flags a secret in workflow-level env, which no environment can guard', () => {
    const source = workflow(
      '  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n',
      'env:\n  TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n',
    );
    expect(problems(source)).toEqual([
      'secrets.CLOUDFLARE_API_TOKEN outside any job, so no environment can protect it',
    ]);
  });

  it('ignores GITHUB_TOKEN, which GitHub mints per run', () => {
    const source = workflow(
      '  status:\n    runs-on: ubuntu-latest\n    steps:\n      - run: gh api x\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n',
    );
    const scan = scanWorkflow('w.yml', source);
    expect(scan.secretReferences).toBe(0);
    expect(scan.findings).toEqual([]);
  });

  it('is not satisfied or tripped by a comment', () => {
    const source = workflow(
      '  test:\n    runs-on: ubuntu-latest\n    # environment: dev  -- reads ${{ secrets.CLOUDFLARE_API_TOKEN }}\n    steps:\n      - run: npm test\n',
    );
    const scan = scanWorkflow('w.yml', source);
    expect(scan.secretReferences).toBe(0);
    expect(scan.findings).toEqual([]);
  });

  it('refuses pull_request_target outright', () => {
    const source =
      'on:\n  pull_request_target:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n';
    expect(problems(source)).toEqual([
      'pull_request_target runs fork code with this repo’s secrets and a write token',
    ]);
  });
});

describe('this repo’s workflows keep every secret inside an environment', () => {
  // Read inside each test, not in the describe body: a throw at collection
  // time fails the file as "no tests" instead of naming the broken assertion.
  const dir = '.github/workflows';
  const scanAll = () =>
    readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .map((file) => ({
        file,
        scan: scanWorkflow(file, readFileSync(join(dir, file), 'utf8')),
      }));

  it('scans every workflow, and every one has jobs', () => {
    const scans = scanAll();
    expect(scans.length, 'positive control: workflows found').toBeGreaterThan(
      0,
    );
    expect(
      scans.filter(({ scan }) => scan.jobs === 0).map(({ file }) => file),
    ).toEqual([]);
  });

  it('finds the deploy secrets it is guarding (liveness)', () => {
    const references = scanAll().reduce(
      (n, { scan }) => n + scan.secretReferences,
      0,
    );
    expect(
      references,
      'deploy-dev.yml reads four Cloudflare secrets',
    ).toBeGreaterThanOrEqual(4);
  });

  it('no secret is read outside a protected environment', () => {
    expect(scanAll().flatMap(({ scan }) => scan.findings)).toEqual([]);
  });
});
```

Dry-run both deploys locally (needs only the local wrangler login). `WORDFARER_COMMIT=$(git rev-parse HEAD) npm run build --workspace @wordfarer/web`, then `cd apps/web && npx wrangler deploy --dry-run`. Expected: `Read 3 files from the assets directory`. Then `cd apps/sync-worker && npx wrangler deploy --dry-run --var COMMIT:$(git rev-parse HEAD)`. Expected: `env.DB (wordfarer-dev) D1 Database`.

- [ ] **Step 7: Amend D9 and the docs.**
  - Spec §2, D9 row: `**Cloudflare Workers + D1**, matching shyden.co.uk's stack. The web app is a Worker serving static assets (amended 2026-10-01: wrangler 4.145 creates new Pages projects as Workers, and the operator chose Workers static assets over legacy Pages)`.
  - Spec §6.1: `apps/web             Vite PWA shell (Worker static assets)`.
  - Spec §13 Flow: `(web Worker + sync Worker + D1 dev)`. `CLAUDE.md` Flow: the same parenthesis.
  - README Development: `Every merge to develop deploys dev (web and sync Workers, D1) behind Cloudflare Access, and is verified live before it is marked dev-verified.`
  - Then `npx prettier --write` on the three files. Prettier pads Markdown table cells, so find the D9 row by its `| D9` prefix rather than by its padded text.

- [ ] **Step 8: Whole gate.** Unit **68 passed**, worker 9 passed, and format, lint, typecheck and build exit 0. Then `scripts/fail-on-warnings.sh npm ci` and `scripts/fail-on-warnings.sh npm run build` both exit 0.

- [ ] **Step 9: Commit (`ci: deploy develop to dev and verify it live behind Access (Refs #16)`), then mutate (predict first).** M1 (remove `environment` from the deploy job) → 1 failed / 68. M3 (`name: dev` → `name: staging` on verify) → 1 failed. M5 (`return html;` in `stampCommit`) → 2 failed. M6 (`{40}` → `{7,40}`) → 1 failed. M7 (`gateProblems` accepts 200) → 2 failed. M8 (`/cloudflareaccess\.com/` unanchored) → 1 failed. M9 (no retry) → 1 failed. M14 (a tag-pinned `actions/checkout@v7` in `deploy-dev.yml`) → 2 failed. M15 (`secretReferences` keeps only `secrets.` forms) → 3 failed. The denominator stays 68 in every run.

- [ ] **Step 10: PR, merge, watch the deploy.** Merge on green `build-and-test` (head SHA matched to `headRefOid`). Then poll the `deploy-dev` run on the merge commit until `status == completed`, and read jobs `test / build-and-test`, `deploy` and `verify` BY NAME. Read `dev-verified` off `repos/shyden-labs/wordfarer/commits/<sha>/statuses`. Finally, open both URLs in a browser without a session and confirm the Access login appears. If verify fails only on the gate check because Access could not be enabled until the Worker existed, then once Access is on, re-run that job with `gh run rerun <run-id> --failed`, and record it in the story. If the App is refused, ask Shyden to press _Re-run failed jobs_.

---

## Review log

Every pass ran the checks mechanically: each stage built from `origin/develop` (`d547bd6`) in a scratch worktree, `npm install` with its log read for warnings, the whole gate (format, lint, typecheck, unit, worker, build) with exit codes captured, each task's red step against stubs, and every predicted mutation with its anchor count asserted and the denominator read. The code blocks above are generated from those stage commits, not retyped.

**Prototype findings (before pass 1), all fixed in the code above:**

- `@cloudflare/vitest-pool-workers@0.22.0` pins wrangler 4.124.0 and miniflare 5.20260815.0-alpha, bringing in 5 high advisories (sharp, undici). Fixed with root `overrides`, and the single-runtime guard added.
- TypeScript 7 and Vitest 5 are newer than typescript-eslint, svelte-check and the Workers pool accept, so the versions are pinned and Dependabot told why.
- A Svelte component with no `<script lang="ts">` imports as `any` under strict TypeScript (bisected: not the TS version, not the path). Now enforced by `svelte/block-lang`.
- Strict lint found 16 defects in the existing guards, plus two unused exports, one of them the comment stripper without regex or template-substitution lexing.
- Vite 8 warns on an extensionless config import while exiting 0, so `fail-on-warnings.sh` was added. Its first two patterns missed `warnings` and `DeprecationWarning`, and it now matches substrings.
- `wrangler pages project create` delegates to Workers and fails without `--force`. Shyden chose Workers static assets (D9 amended in Task 4). The failed attempt created nothing (the account's Workers script list was read back empty).
- A committed `worker-configuration.d.ts` (16,194 lines) would redden every Dependabot wrangler bump, so it is now generated on install and git-ignored.
- The real-repo secrets scan ran in a `describe` body, so a throw would have failed collection. It moved into each test.

**Pass 1 (2026-10-01 04:54–04:58 UTC): 5 findings, all fixed.**

1. `/health` had an untested `db: 'unexpected'` branch for a `SELECT 1` that cannot return anything else. Deleted (dead defensive code), and the AC updated.
2. Task 1 Step 3's expected result contradicted itself (8 of 10 vs all 10). Measured: 10 failed.
3. Task 2's M2 was described, not specified. Now an exact insert, run: 1 failed / 40.
4. Task 4 Step 7 claimed the licences test reads `CLAUDE.md`. It does not, so the claim was removed and the Markdown-table anchoring note added.
5. Task 3 had no mutation for a health check that never queries D1. M17 added and run: 1 failed / 9.

Results after the fixes: stages 26 → 40 → 43 → 68 unit tests and 9 Worker tests, every gate step exit 0, no warning in any install log. All 13 per-stage red steps and mutations matched their predictions, and all 14 mutations on the stage-4 commit `e572643` went red, with the denominator at 68.

**Pass 2 (2026-10-01 04:59–05:01 UTC): 2 findings, both fixed.**

1. The generated plan failed `prettier --check`, so committing it would have reddened CI on the very ticket that adds the check.
2. Prettier's default `embeddedLanguageFormatting` rewrote the quoted code (it collapsed `package.json`'s `workspaces` array), so the plan no longer matched the files it quotes. `.prettierrc.json` now sets `embeddedLanguageFormatting: "off"` for `*.md`, which leaves quoted code verbatim and still formats the prose. The stages were rebuilt and re-gated (26 / 40 / 43 + 9 / 68 + 9, every step exit 0, no install warnings). The mutation and red runs were not repeated, because a formatter option for Markdown changes no file they read.

Also checked in pass 2 and clean: every file changed in each stage is quoted in that stage or produced by a stated command (`npm install -D yaml@^2.9.1` reproduced stage 2's `package.json` byte for byte). Every quoted file changed in its stage. Every `npm run` target exists in its workspace. Every interface name in the Interfaces blocks is defined in the quoted code. The Task 1/3/4 README edits, applied together, pass `prettier --check`.

**Pass 3 (2026-10-01 05:01–05:03 UTC), a full read of every step and AC against the spec: 4 findings, all fixed.**

1. Task 1 ran the wrapper's tests (Steps 2–5) before installing the toolchain (Step 6), so they would have run on `develop`'s Vitest 5. The steps are reordered: toolchain, web shell, lint red, fix, then the wrapper red and green.
2. Task 1's Interfaces listed the CI steps out of order. They now read format, lint, typecheck, unit, build, as `ci.yml` runs them.
3. Task 1 said to copy the plan into the branch. It is already in the working tree and moves with `git switch`, as does the pending `HANDOVER.md` edit.
4. Task 4's fallback ("re-run verify") named no route. It now says `gh run rerun --failed`, or Shyden's button if the App is refused.

Measured to settle two expectations: stage 1's lint against the unfixed guards gives **16 errors** (by rule: 7 / 4 / 2 / 1 / 1 / 1). A first count of 17 came from a git-ignored `worker-configuration.d.ts` left on disk by a later stage, which is not a defect in stage 1. And `postinstall`'s `wrangler types` succeeds before `src/index.ts` exists, so Task 3's Step 2 install works as ordered.

**Pass 4 (2026-10-01 05:02–05:03 UTC): 0 findings.** All 47 quoted blocks matched their stage files byte for byte after Prettier. Step numbers ran in sequence in every task (15 / 6 / 7 / 10). Stage-file coverage held with the expected exceptions (regenerated locks, the `HANDOVER.md` edit, and stage 2's `package.json` from `npm install -D yaml`). There were no placeholders apart from the four story references, which were open by design until filing. The reordered Task 1 and the changed Task 4 step were re-read.

**Pass 5 (2026-10-01 05:07–05:08 UTC), after the board was filed: 0 findings.** The four story references were resolved to #13–#16, and the Board section records the filed items. Re-ran on that edit: no story placeholder remains (a first grep matched this very sentence, which then spelled the placeholder out; reworded so the check measures the plan, not its own log), each task's `Refs` names its own story, all 47 blocks still match their stage files, and Prettier is clean. **The plan is approved** under the operator's standing rule (reviewed to zero, then self-approved).
