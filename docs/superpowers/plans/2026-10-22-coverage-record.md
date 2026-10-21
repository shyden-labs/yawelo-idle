# Coverage record and ratchet (#728) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every pull request measures each tracked code file's untested statements and branch arms, and fails when any file's count differs from the committed record or grew against the record at its base.

**Architecture:** each suite pull-request CI runs is re-run under coverage with its own config plus a coverage block (`vitest.coverage.<suite>.config.ts`), through a custom v8 provider that keeps tests and configs in the report. A CLI joins the five reports into a per-file table, the record-floors workflow records it, `floors:fetch` brings it back (ratcheted), and a required `coverage` job compares.

**Tech Stack:** Vitest 5.0.3, `@vitest/coverage-v8` 5.0.3 (pinned exactly), `istanbul-lib-coverage` 3.2.2, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-22-coverage-record-design.md` (its "Amendments made while building" section included).

## Global Constraints

- Coverage is off in the unit step and its limits stand; a coverage run carries no per-test limit.
- The record must equal the measured counts; no file's untested count may rise against the merge base; a file new to the record enters at zero; a rename is judged against its old path.
- The recorder writes only inside the record-floors workflow (`recordRefusal`); the laptop runs only the unit suite.
- Every commit green on every CI step alone; one test per case; no retries; red first for every new test.

## Review Focus

1. A report measured on another commit than the one judged: refused (`metaRefusal`), tested.
2. A tracked code file missing from the joined report: a problem, never zero (`buildTable`), tested.
3. A coverage figure that wobbles between runs (fresh property cases, environment): measured in PR 2 step 1 before the first record.
4. A workflow, template or shell file that grows: its `lines` count rises and the ratchet refuses it (by design until #734 to #738).
5. The provider breaking on a Vitest upgrade: the pin test makes the two move together, and the measure step fails on a missing test file.

---

## Pull request 1 (built 2026-10-22, branch `tooling/728-coverage`)

- [x] **Task 1: the pin.** `@vitest/coverage-v8` at exactly the installed Vitest, the lockfile agreeing, a Dependabot `vitest` group excluded from `patch-updates` (`tests/unit/supply-chain.test.ts`).
- [x] **Task 2: kinds.** `kindOf(path, firstLine)` and `codeLines(path, text)` in `scripts/coverage-kinds.ts` (`tests/unit/coverage-kinds.test.ts`, 47 cases).
- [x] **Task 3: configs and provider.** `scripts/coverage-config.ts` (`COVERAGE_SUITES`, `COVERAGE_EXCLUDE`, `coverageConfigFile`, the `COVERAGE` block), five `vitest.coverage.*.config.ts`, `scripts/coverage-provider.ts`, the setup split (`tests/unit/setup-refusals.ts`), listed in `NON_UNIT_VITEST_CONFIGS` and `suite-limits.test.ts` (`tests/unit/coverage-config.test.ts`, `tests/unit/unit-setup-wiring.test.ts`).
- [x] **Task 4: table and ratchet.** `untested`, `joinMaps`, `buildTable`, `formatTable`, `rises(base, next, renamed)` in `scripts/coverage-table.ts` (`tests/unit/coverage-table.test.ts`).
- [x] **Task 5: CLI and fetch.** `scripts/coverage.ts` (`measure`, `record`; `childEnv`, `metaRefusal`, `coveragePlan`, `renamesFrom`, `fetchedRecordRefusals`), `npm run test:coverage`, `floors:fetch` coverage step (`coverageArtifactName`, `repoOfRunUrl`), record-floors steps (`tests/unit/coverage-cli.test.ts`, `fetch-floors.test.ts`, `record-floors-workflow.test.ts`).
- [x] **Task 6: guards.** Every committable file has a kind; no skip comment in JS/TS (`tests/guards/coverage.test.ts`, `tests/unit/coverage-skip.ts` with `commentsOf`).
- [x] **Task 7: the measuring job.** `coverage` job in `ci.yml` (`tests/unit/coverage-ci.test.ts`), its step limit provisional.
- [x] **Task 8: mutation files.** `tests/mutations/728-coverage-unit.ts` (30 rows), `tests/mutations/728-coverage-guards.ts` (2 rows), `tests/mutations/728-coverage-integration.ts` (3 rows, with `tests/integration/coverage-cli.test.ts` and the CLI in `script-loads.test.ts`).
- [ ] **Task 9: land it.** Commit; push to `refs/floors/tooling/728-coverage`; dispatch record-floors on develop; `npm run floors:fetch <run-id>`; amend; unit suite green; `npm run mutate -- tests/mutations/728-coverage-unit.ts` under the heavy lock, every row as predicted; push; PR; read every step by name; set the measure step's limit from the first runs (3x the slowest, a fall only); merge when green.

## Pull request 2 (next)

- [ ] **Step 1: wobble.** Dispatch record-floors three times on one commit and run the `coverage` job once on it; compare the four tables file by file with a `compareTables` helper (test first). Any differing file: a fixed unit test for the lines that differ, then re-measure.
- [ ] **Step 2: `check`.** `scripts/coverage.ts check`: (a) measured table equals `tests/coverage/record.json`, every differing file named with both counts; (b) `rises` against the record at the merge base, the PR adding the record the only exception. Tests first, both ways.
- [ ] **Step 3: documents-only proof** in the job: `ci-scope.ts` classifies; docs-only checks every changed file is a document not in the record, naming the count; anything else takes the full path. Tests both ways.
- [ ] **Step 4: first record** via record-floors on the branch, fetched and folded in; the job runs `check`.
- [ ] **Step 5: required.** After merge, add `coverage` to `required_status_checks.contexts` and read it back; post the first figures on #728.
- [ ] **Step 6: mutation file** `tests/mutations/728-coverage-ratchet.ts` for `check` and the proof, predictions first.
