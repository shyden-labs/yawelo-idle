# Coverage record and ratchet (#728): design

**Ticket:** #728 (re-scoped 2026-10-22, 5 points). **Rulings:** on #728 (2026-10-21/22) and the global reference
(`~/.claude/global-rules/reference/reference-engineering-standards.md`, "ONE COVERAGE TOOL" and the three paragraphs after it).
**Later stories it feeds:** #732 workerd, #733 child processes, #734 browser and templates, #736 the shell rewrite,
#737 and #738 workflows, then #739 the changed-line gate.

## Why

Shyden, 2026-10-21: coverage ratchets to 100%, and "this should have been in place since the beginning". Today the repo
has no coverage tool at all. This ticket gives it one, records each file's untested code, and makes every pull
request prove that no file's untested code grew and that every gain was recorded.

## What was ruled (not mine to change)

1. One tool: `@vitest/coverage-v8`, pinned to the installed Vitest version exactly, with a test that fails on drift.
2. The ratchet counts **untested statements and branch arms per file** (_"Untested count (Recommended)"_, then _"make
   this apply to every project"_). No file's count may rise; the percentage is printed, 100% is the goal.
3. The record must **equal** the measured counts, and each gain is recorded in the pull request that earns it
   (_"Must be recorded (Recommended)"_), in the same CI run that records the floors.
4. Code is every TypeScript and JavaScript file, **tests and tool configs included**, and the workflow files (steadyhand
   #381, global; confirmed here _"Code, traced (Recommended)"_). Lines coverage is told to skip count as unrun.
5. Coverage is off in the 1 s unit step, and the coverage run carries no per-test limit ("Both global").
6. Documents-only pull requests prove nothing measured changed (_"Prove nothing changed (Recommended)"_).
7. In this repo floors are recorded only by the `record-floors` workflow on a scratch ref and fetched back (#547, #724).
   The recorder follows the same path: the laptop cannot run the non-unit suites, so the joined counts can only be
   measured in CI.

## Goals

- `npm run test:coverage` measures every Node Vitest suite PR CI runs (unit, guards, integration, properties,
  pacing), joins them, and writes one istanbul JSON map, one lcov file (kept for SonarCloud, #655) and a per-file
  untested table.
- `tests/coverage/record.json` holds, for **every tracked code file**, its untested statements and untested branch
  arms, plus totals. Files no Node suite can measure yet are in it too, at their full size, so they can only shrink
  as #732 to #738 land.
- A required `coverage` job on every pull request measures and fails on any difference from the record, naming
  each file and both counts: a rise is a regression, a fall is a gain not yet recorded.
- The record is written only by the record-floors workflow and comes back through `npm run floors:fetch`.

## Non-goals

- The changed-line gate (#739), and measuring workerd, child processes, the browser, templates or workflows (#732
  to #738). This ticket only reserves their place in the record.
- The `logs` suite. It runs before each release, not on pull requests (global logging rule), so the coverage job
  leaves it out too. A line only it reaches counts as untested, and the logs rule already says unit keeps stand-ins.
- The four `apps/*/vitest.harness.config.ts` suites. Their cases run inside workerd, which Node's V8 cannot see (#732).

## Anti-goals (a failure even if it works)

- A number that wobbles between runs, so a pull request goes red at random. That is a retry waiting to happen.
- A file missing from the record, read as zero. Absence fails closed.
- A coverage run that changes what the unit step judges (its limits, its setup), or a unit step that runs with coverage on.
- Skip comments (`v8 ignore`, `c8 ignore`, `istanbul ignore`) quietly lowering a count.

## Shape

### Measuring (`scripts/coverage.ts measure`)

- Each suite runs on its own, in the CI step order, with `--coverage` and the JSON reporter into
  `coverage/<suite>/coverage-final.json`, under a coverage config that extends that suite's own config. Running the
  suites one at a time keeps each suite's setup, pool and timing the same as in its own CI step.
- The coverage config sets `include` to every JS/TS extension, `exclude` to nothing but `node_modules` and build
  output, and `reportOnFailure: false`, so a red suite records nothing. The config itself runs no process (a unit
  test imports it). The measure script then intersects the join with `git ls-files`: an untracked file in the join
  is dropped, and a tracked JS/TS file missing from it fails the run (absence fails closed, never zero).
- For the unit suite, the coverage config swaps `tests/unit/setup.ts` for a setup that keeps every refusal
  (process, socket, checkout reads) but not the CPU check, and lifts `testTimeout`/`hookTimeout`. The plain unit
  config is untouched, and a unit test reads it to prove coverage is off there and the limits stand. If
  `hooks/unit-limit-never-raised.py` refuses the lifted timeouts, the conflict between the hook and the "coverage
  steps carry no per-test limit" ruling is reported to Shyden. The hook is never widened around this code.
- Skip comments: a guard refuses any `v8 ignore`, `c8 ignore` or `istanbul ignore` comment in tracked code, so no
  line can be skipped. (A guard is simpler and stricter than rewriting the hint handling; planted and seen red.)
- The per-suite maps are joined with `istanbul-lib-coverage` (BSD-3-Clause, a direct dev dependency). The join must be
  exact for a file two suites both load; the plan measures this before relying on it.
- **Measured 2026-10-21 (probe, unit suite alone, plain `provider: 'v8'`):** 75.3% of statements run (2,723 of
  11,016 untested) and 80.7% of branch arms (1,300 of 6,720), over 284 files. Vitest left out 211 tracked code files:
  the 18 `.astro` and 1 `.svelte` (parse errors), and 190 test files plus `tests/unit/setup.ts` and
  `vitest.config.ts`, because Vitest adds the run's own test files, setup files and config to the exclude list as
  "hard-coded default coverage exclusions. These cannot be overridden by user config"
  (`vitest/dist/chunks/index.DpLw24bj.js`, 5.0.3). The ruling counts tests and configs as code, so the coverage
  config uses a **custom provider** (`scripts/coverage/provider.ts`): the v8 module, with a `V8CoverageProvider`
  subclass (a supported import through the package's `"./*"` export) whose `initialize` replaces the resolved exclude
  with exactly ours. A test pins that the run's own test file, setup and config appear in the report.
  **Measured with that provider (probe, same day):** all 472 tracked JS/TS files are in the report; unit alone runs
  79.3% of statements (5,290 of 25,566 untested) and 77.4% of branch arms (1,889 of 8,376). `include` is limited to
  the `v8` kinds, since `.astro` and `.svelte` only log parse errors. Vite warns on an extensionless config import
  (`./vitest.config`), and a warning is a failure here, so every config import names `.ts`.
- Kinds the Node tool cannot parse (`.svelte`, `.astro`, `.html`, the workflow YAML, the two shell files until #736)
  enter the table at their full size: every non-blank line that is not wholly a comment in that kind's line-comment
  syntax counts as one untested statement, with zero branch arms, and the table names the measure (`v8` or `lines`).
  One table lists every tracked kind as `v8`, `lines` or not code; a tracked file of an unlisted kind fails the run.
  From the 2026-10-21 census of tracked extensions: `v8` is `.ts`, `.js`, `.mjs`, `.cjs`, `.mts`, `.cts`; `lines` is
  `.github/workflows/*.yml`, `.svelte`, `.astro`, `.html`, `.sh` and an extensionless file starting `#!`; not code is
  every other YAML (Dependabot, issue forms), JSON, JSONC, JSONL, Markdown, text, CSS, media, dotfiles, `_headers`,
  `NOTICE`, `LICENSE`, `CODEOWNERS`. CSS as not code is **my call**: it has no executable lines and no ruling names it.
- The run writes `coverage/meta.json` with the commit it measured; the ratchet refuses a report for another commit.

### The record and its recorder

- `tests/coverage/record.json`: `{ files: { "<path>": { measure, statements: { untested, total },
branches: { untested, total } } }, totals }`, sorted by path, written by one function (stable bytes).
- `scripts/coverage.ts record` refuses unless `recordRefusal` (shared with the floors) passes: CI, inside the
  record-floors workflow. It writes the measured table as is. The "raise only" half of the floors rule is the
  ratchet's job here, since an exact match means the record can only be what was measured.
- `record-floors.yml` gains "Measure coverage", "Record coverage" and "Upload the coverage record" steps after
  "Record the floors"; the record goes up as its own `coverage-<sha>` artifact. `floors:fetch` brings it back
  (below), with the same refusal when the run did not record this branch's head.
- Because record-floors always runs develop's copy (#718), the record step must be on develop before a branch can
  use it. So this ticket lands as **two pull requests**: (1) the tool, measure, join, recorder and record-floors
  step, with no ratchet job; (2) the wobble measurement, the first record, the ratchet and the required job.

### The ratchet (`scripts/coverage.ts check`) and the `coverage` job

- `check` makes two comparisons, and lists every failing file (not just the first) with both counts and the direction:
  - **(a) recorded:** the measured table equals the pull request's record, file by file (same paths, same untested
    and total counts). A difference means a gain or a loss nobody recorded.
  - **(b) ratchet:** the pull request's record against the record at the merge base with `origin/develop`. No file's
    untested statements or untested branch arms may rise, and a file new to the record enters at zero untested.
    Without (b), a pull request could record its own regression. The one exception is the pull request that adds
    the record (no record at the base, and the diff adds it); any other missing base record fails.
    It prints the totals and percentages either way.
- `floors:fetch` applies (b) before writing, as it refuses a fall in the floors: it refuses a fetched record in which
  any file's untested count rose against the local one. It writes the coverage record whenever the run uploaded one
  (its own `coverage-<sha>` artifact, so the floors artifact keeps its layout), and refuses when the tree has a
  record but the run uploaded none.
- So a change that grows a file nothing measures yet (a workflow, a template) fails until its story lands. That is
  "unmeasured fails" as ruled, for growth; #739 adds every other changed line.
- New `coverage` job in `ci.yml`, same container image as `build-and-test`, its own measured `timeout-minutes`.
  Steps: checkout, setup-node, classify (`scripts/ci-scope.ts`), install, then either the documents-only proof or
  measure + check, then upload the lcov and the table. Added to `required_status_checks` after merge, then read back.
- Documents-only proof: every changed file is one `ci-scope.ts` already calls a document, and none is in the
  record. It prints how many files it judged. Anything else takes the full path; a classification it cannot read fails.

### Wobble (AC4)

Before the first record, three record-floors runs and one `coverage` job run, all on the same commit: the ratchet
compares a pull request's job with a record run, and their environments differ (`FLOORS_RECORD_JOB` is set only on the
record step, never on the measure step; the event name differs). Their tables are compared file by file. A file
whose counts differ between runs gets a fixed (seeded or table-driven) unit test for the lines that wobbled, without
changing how the properties draw fresh cases (#543), and the record is written only once three runs agree. The
comparison script is the same `check` function.

## Testing

- Unit (in-process, no process or socket): the kind table, the line counter per kind, the join of two maps, the
  table writer's stable bytes, `check` (equal, rise, fall, path added, path missing, wrong commit, unreadable report),
  the recorder's refusal, the documents-only proof both ways, the pin test, the Dependabot group, and that the plain
  unit config keeps coverage off and its limits.
- Guards (whole repo): no skip comments in tracked code; every tracked file's kind is in the table.
- Both guards are absence or population searches, so each checks its recorded floor in its own test
  (`floorBreach` on the expression `searched(…, { of })` names), recorded through record-floors.
- Each pull request carries the mutation file for what it adds (the `mutations` check refuses a new guard without
  one): `tests/mutations/728-coverage-tool.ts` in the first (guards, kind table, join, recorder refusal),
  `tests/mutations/728-coverage-ratchet.ts` in the second (`check`, the documents-only proof). Predictions written first.

## Left to the builder

The exact config composition for each suite (a coverage config per suite, or one config reading the suite from an
environment variable), how the lcov is produced from the joined map, and the job's measured limit.

## Amendments made while building (2026-10-22)

Each is measured; none changes a ruling.

- **Files.** `scripts/` is flat here, so the modules are `scripts/coverage-kinds.ts`, `scripts/coverage-table.ts`,
  `scripts/coverage-config.ts`, `scripts/coverage-provider.ts` and the CLI `scripts/coverage.ts`.
- **One config per suite.** `vitest.coverage.<suite>.config.ts` (five files), not one config reading an environment
  variable. The raised-limits guard refuses `testTimeout: 0` in any file the unit suite loads ("0 turns the limit
  off"), and is right to; a coverage config is a non-unit suite config, so the unit one sets its own `0` limits and
  its refusals-only setup, and is listed in `NON_UNIT_VITEST_CONFIGS`, where `suite-limits.test.ts` holds each to `0`.
  `scripts/coverage-config.ts` exports the `COVERAGE` block as data and holds no limit key; each config is built by
  spreads, not a call, since tests load the configs and the collection-calls guard refuses a call into workspace code
  at collection (found by CI's guards in the first record run).
- **The unit setup is split.** `tests/unit/setup-refusals.ts` holds every refusal; `tests/unit/setup.ts` imports it
  and adds the CPU check. No test proved the CPU check was wired before this ticket; `tests/unit/unit-setup-wiring.test.ts`
  is a stand-in read from the parse tree, and the run that proves it is #740.
- **The provider loads `V8CoverageProvider` at run time.** With its declarations in the program (they import magicast
  and Babel types) `npm run lint` ran out of heap: over 2.2 GB resident; 1.64 GB with the file left out, 1.19 GB with
  the run-time load. Re-measured after the change: the unit report still holds the run's own test files.
- **Renames.** The ratchet takes a rename map (git's `-M` against the merge base): a renamed file is judged against
  its old path, so a rename never reads as a new file with untested code.
- **floors:fetch** ratchets the fetched record against the record at the merge base with `origin/develop` (the same
  base the job uses), and checks everything before writing anything, floors included.
- **The `coverage` job lands in the first pull request, measuring only** (not required, no check), so the measure
  step runs in CI before anything relies on it. Its step limit is provisional (300 s, 15 minutes) until its first
  runs, and is set from them before the first pull request merges.
- **`suite-limits.test.ts`** now lists suite steps in every `ci.yml` job, not only `build-and-test`: a suite in a
  job of its own escaped the limit rule.
- **Skip comments** are found by `tests/unit/coverage-skip.ts` through a new `commentsOf` in `tests/unit/source-text.ts`,
  sharing `codeWithoutLiterals`' literal blanking (one home), so a string or regex spelling one is not one.
