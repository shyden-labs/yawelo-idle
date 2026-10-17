# #649: the mutation runner runs the harness and Playwright suites

**Ticket:** #649 (P2). **Blocks:** #619 (the required `mutations` check). **Builds on:** #527 (spec `docs/superpowers/specs/2026-10-17-mutation-runner-design.md`, merged as `c417b12`). **Written:** 2026-10-18. **Status:** spec, reviewed to zero and self-approved (global rule, 2026-09-24).

## 1. Why

#527's runner runs the six vitest suites that start from the repository root. #619 will require a mutation file for every changed non-unit test, and its AC2 names the four Worker harness suites among them. The two Playwright suites are non-unit tests too. Until the runner can run all six remaining suites, #619 cannot require them.

## 2. What the merged code does today (measured 2026-10-18, `origin/develop` at `c417b12`)

| Fact                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Source                                                                                                                                                | Consequence                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mutableSuites` throws for any suite whose `cwd` is not `.`.                                                                                                                                                                                                                                                                                                                                                                                                  | `scripts/mutate.ts:471`                                                                                                                               | The four harness suites (`apps/web`, `apps/site`, `apps/dev-hosts`, `apps/sync-worker`) cannot be given a `mutate` value without changing it.                                                         |
| The runner's reporter names files relative to `vitest.config.root`.                                                                                                                                                                                                                                                                                                                                                                                           | `scripts/mutate-reporter.ts:73`, `:99`                                                                                                                | Run from `apps/web`, a failing test is named `test/game.test.ts › …`, while targets and `red` keys are repository-relative. Every harness row would miss.                                             |
| `Io.list` returns `entry.files(stdout)`, relative to the suite's `cwd`.                                                                                                                                                                                                                                                                                                                                                                                       | `scripts/mutate.ts:596`                                                                                                                               | A harness target `apps/web/test/game.test.ts` is never found in its own suite's listing. `suiteFiles` (`scripts/record-floors.ts:330`) already joins `cwd`.                                           |
| Three harness `test` scripts build first, each differently: `vite build` (web), two `astro build`s (site), `wrangler pages functions build --outdir .build` (dev hosts). The sync Worker builds nothing. `test:web` builds the game workspace, then runs Playwright.                                                                                                                                                                                          | each app's `package.json`; root `package.json`                                                                                                        | The build must run after the mutation is planted, inside the same bounded run, and must be the same build the `test` script runs.                                                                     |
| Both Playwright configs have three projects (chromium, firefox, webkit), `retries: 0`, `workers: 1`, `timeout: 0`.                                                                                                                                                                                                                                                                                                                                            | `playwright.engines.config.ts:11-20`, `playwright.web.config.ts:39-50`                                                                                | Each test runs three times, so a name must carry the project. With no per-test timeout, a hang ends only at the runner's ceiling.                                                                     |
| Playwright 1.63.0's JSON reporter writes each result's `status` (`passed`, `failed`, `timedOut`, `skipped`, `interrupted`), each test's `outcome()`, each error through `formatError(nonTerminalScreen, …)` (whole message, snippet and stack), and top-level errors (a file that failed to load, a web server that did not start) in `errors`. Its output file is named by `PLAYWRIGHT_JSON_OUTPUT_FILE`. `nonTerminalScreen.colors` follows the terminal's. | `node_modules/playwright/lib/runner/index.js` (`_serializeTest`, `_serializeTestResult`, `_serializeError`, `resolveOutputFile`, `nonTerminalScreen`) | Unlike vitest's JSON (#527 §4a), the built-in report keeps the whole error text, so no custom Playwright reporter is needed. The reader strips ANSI escapes, since colour depends on the environment. |
| CI times on `develop` (run 39040575704): all four harness suites 18 s together, engines 19 s, web smoke 12 s, install 18 s.                                                                                                                                                                                                                                                                                                                                   | step start and end times                                                                                                                              | A mutation run of any of them is far below the 600 s ceiling. AC4 measures it per mutation.                                                                                                           |
| `runFile` lists every mutable suite before the laptop refusal.                                                                                                                                                                                                                                                                                                                                                                                                | `scripts/mutate.ts:347-354`                                                                                                                           | Once the harness and Playwright suites are mutable, a laptop run would start `playwright test --list` and four harness listings. The laptop runs only unit tests (global rule, 2026-10-09).           |
| No workflow runs the runner.                                                                                                                                                                                                                                                                                                                                                                                                                                  | `.github/workflows/` (no `mutate`)                                                                                                                    | AC3 needs a CI run. #619 AC3 ("runs every mutation file the PR adds or changes through #527's runner") is the mechanism; this story takes it (§7).                                                    |

## 3. The suite table

`Suite.mutate` (`scripts/record-floors.ts`) becomes a tagged value:

```ts
readonly mutate?:
  | { readonly kind: 'vitest'; readonly config?: string; readonly build?: readonly string[] }
  | { readonly kind: 'playwright'; readonly config: string; readonly build?: readonly string[] };
```

- `config` is relative to the suite's `cwd`. `build` is a command run in `cwd` before the suite, with the mutation planted.
- The six root suites gain `kind: 'vitest'` and keep their configs.
- Game harness: `{ kind: 'vitest', config: 'vitest.harness.config.ts', build: ['npx', 'vite', 'build'] }`. Site harness: one `build` cannot hold two commands, so `build` is `['npm', 'run', 'build:harness']` and the site gains `"build:harness": "astro build && astro build --config astro.holding.config.ts"`, its `test` becoming `npm run build:harness && vitest run -c vitest.harness.config.ts`. Dev hosts: `['npx', 'wrangler', 'pages', 'functions', 'build', '--outdir', '.build']`. Sync Worker: no `build`.
- Engines: `{ kind: 'playwright', config: 'playwright.engines.config.ts' }`. Web smoke: `{ kind: 'playwright', config: 'playwright.web.config.ts', build: ['npm', 'run', 'build', '--workspace', '@yawelo-idle/web'] }`.
- **No drift from the `test` scripts (AC1).** A guards test, one test per suite, reads each suite's `package.json` script that its `run` names and checks it is exactly `<build joined by spaces, npx dropped> && <vitest run -c config | playwright test -c config>`, or the run alone when there is no `build`. A build changed in one place and not the other goes red.

## 4. Running a suite from its own directory

- `MutableSuite` becomes `{ name, cwd, kind, config, build }`; `mutableSuites` stops refusing `cwd !== '.'`.
- `Io.list` returns repository-relative paths (`suiteFiles`).
- A vitest run spawns `npx vitest run -c <config> --reporter=default --reporter=<runner reporter>` in `cwd`, with `MUTATE_ROOT=<repository root>` in its environment. The reporter names files relative to `MUTATE_ROOT` when set, and refuses (throws at `onTestRunEnd`) when a module lies outside it. Unset, it keeps `vitest.config.root`, so nothing else changes.
- `related` (importers) and `FLOORS_RECORD` stay guards-suite only.

## 5. Reading a Playwright run

- A Playwright run spawns `npx playwright test -c <config> --reporter=list,json` in `cwd`, with `PLAYWRIGHT_JSON_OUTPUT_FILE` set to the run's `json` path and `FORCE_COLOR=0`.
- `readPlaywrightReport(json, cwd)` in `scripts/mutate.ts` turns Playwright's report into the runner's `Report` (`total`, `files`, `failing`, `timedOut`), fail-closed on any shape it does not know, as `readReport` does:
  - Files: each top-level suite's `file`, joined to `config.rootDir` and made repository-relative (the `playwrightListed` rule).
  - Names: `<file> › <project> > <describe> > … > <title>`, the project being the test's `projectName`. Example: `tests/web/shell.spec.ts › webkit > the shell renders with no console errors or page errors`.
  - `total`: every test of every spec, counted once per project.
  - Failing: a test whose status is `unexpected` or `flaky`, with every result's errors, each error's `message`, `snippet` and `stack` joined, ANSI escapes removed.
  - `timedOut`: a test with a result whose status is `timedOut`.
  - A top-level error with a `location` becomes `<its file> › (the file)`; one without becomes `<config> › (the run)`. Both are failing tests whose text is the error, so a baseline red for that reason is refused and a mutation that causes one must predict it.
- The runner picks the reader by the suite's `kind`. `judge` and everything after it are unchanged.

## 6. The build, the ceiling and the laptop

- A run with a `build` spawns the build, then (only if the build exits 0) the suite, under one deadline: 600 s from the build's start, so the ceiling bounds a mutation's whole run. A build that exits non-zero ends the run with no report and its output in the row's log; the row prints `build failed (exit <n>)` and misses. No mutation file can predict a build failure: a mutation that breaks the build proves nothing about a test.
- The baseline builds too, so the judged runs are compared with a built, unmutated suite.
- **Laptop.** Unless `CI` is `true`, the runner lists the unit suite only. A target it does not list is refused with the laptop sentence: "the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the mutations check run it". No harness, Playwright or other non-unit listing starts on the laptop.

## 7. Running mutation files in CI

`.github/workflows/mutations.yml`, on every pull request into `develop`:

1. **`changed`** (no container): checks out with the base, lists the files under `tests/mutations/` that the pull request adds or changes (`git diff --name-only --diff-filter=AM <base>...HEAD`), prints `<n> mutation files changed of <m> paths judged`, and outputs them.
2. **`run`** (needs `changed`, only when `n > 0`; the CI job's Playwright container, SHA-pinned, as `ci.yml` runs it): `npm ci`, then `npm run mutate -- <files>`, uploading `.mutations/` whatever the result. Its timeout is measured in this story and set at the step (no limit inside).

This is #619's AC3, moved here because #649 cannot prove its own rows in CI without it. #619 keeps the changed-test judge (AC2), the guards test parsing every mutation file (AC1), the quick pass (AC4), the required-check setting (AC5), the planted controls (AC6) and the docs fast path (AC7). Both tickets are edited to say so, with their estimates.

## 8. Acceptance criteria, corrected

The ticket's AC4 and AC5 stand. AC1 to AC3 are corrected:

- **AC1.** Each of the six suites has a `mutate` value in `SUITES`; a harness or web smoke run builds first, with the mutation planted, and the guards test of §3 pins each build to the suite's `test` script.
- **AC2.** The runner reads Playwright's JSON report into the same `Report` it reads from its vitest reporter, names written `<file> › <project> > <describe> > … > <title>`. Unit-tested on reports recorded in CI before the reader is written, on a throwaway draft pull request (the laptop runs no Playwright): from each Playwright suite, one clean and one with a planted failed expectation; and from the engines suite, one with a test timed out (`--timeout=1` on the command line) and one with a spec that fails to load (a planted syntax error). The six reports are committed as fixtures.
- **AC3.** Two mutation files run through the runner in CI by `mutations.yml`, every row as predicted, predictions written first: one for the game harness (`apps/web/test/game.test.ts`), including a row whose effect reaches the test only through `./dist` (a runner that built before planting would leave it green), and one for the web smoke suite (`tests/web/shell.spec.ts`), whose red rows name all three projects. The harness suites' naming fix (§4) is proven by the game harness rows matching; a unit test proves it for the other three by their listings.
- **Estimate:** re-scored from 3 to 5: the ticket's three parts, plus §4's naming fix, the laptop listing, the recorded fixtures and §7's workflow. #619 is re-scored from 5 to 3, having given up AC3.

## 9. Files

| File                                                                      | Holds                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/record-floors.ts`                                                | `Suite.mutate` tagged; twelve entries' values.                                                                                                                                |
| `scripts/mutate.ts`                                                       | `MutableSuite` with `cwd`, `kind`, `build`; repository-relative listing; `playwrightArgs`; `readPlaywrightReport`; the build-then-run under one deadline; the laptop listing. |
| `scripts/mutate-reporter.ts`                                              | `MUTATE_ROOT`.                                                                                                                                                                |
| `apps/site/package.json`                                                  | `build:harness`.                                                                                                                                                              |
| `tests/unit/mutate.test.ts`, `tests/unit/mutate-reporter.test.ts`         | One test per case over the new pure parts, `runFile` driven through the stand-in `Io`.                                                                                        |
| `tests/unit/fixtures/mutate/playwright-*.json` (new folder)               | The six recorded reports (§8 AC2).                                                                                                                                            |
| `tests/guards/mutate-builds.test.ts`                                      | §3's parity, one test per suite.                                                                                                                                              |
| `tests/mutations/649-game-harness.ts`, `tests/mutations/649-web-smoke.ts` | AC3's two files.                                                                                                                                                              |
| `.github/workflows/mutations.yml`                                         | §7.                                                                                                                                                                           |
| `docs/superpowers/specs/2026-10-17-mutation-runner-design.md`             | §5 and §10 point here.                                                                                                                                                        |
| `CLAUDE.md`, `HANDOVER.md`                                                | The runner runs every suite; non-unit mutations run in `mutations.yml`.                                                                                                       |

## 10. Testing

- TDD: each unit test written and seen red before its code, one test per case, inside 1 s and 0.1 s of its own thread CPU. `runFile`'s new paths (build, build failure, Playwright kind, laptop listing) are driven through the stand-in `Io`: no process, no socket.
- The reader's tests read the committed recorded reports: no Playwright run in the unit suite.
- The runner's own controls are mutation-verified on the unit suite through the runner (allowed on the laptop), predictions written first: the `MUTATE_ROOT` relativisation, the project in names, the ANSI strip, the `flaky` failing, the top-level error mapping, the build-exit check and the laptop listing.
- AC3's two files are the real runs, in CI only.
- Floors the new files move are recorded by the `record-floors` label and folded into one commit (repo rule).

## 11. Out of scope

- The changed-test judge, the guards test over every mutation file, the required check, and the planted PR controls: #619.
- Mutation files for the site, dev hosts, sync Worker and engines suites beyond the unit-tested listings: each lands with the first story that changes one of their tests (#619 requires it).
- Stryker: #36.
