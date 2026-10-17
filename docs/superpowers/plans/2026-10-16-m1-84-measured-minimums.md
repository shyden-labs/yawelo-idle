# #84 Measured Minimums Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The ten exempted fast-check properties draw fresh cases and check each reach count against a minimum measured over 200 fresh-seed CI runs.

**Architecture:** One method module (`scripts/minimums-method.ts`) holds the maths and the record files. A runner-neutral checker (`tests/minimums.ts`) judges, or records in CI. A labelled workflow samples the properties suite 200 times, a laptop fetch writes the minimums, and a guard pins where the checks run and that no seed is fixed.

**Tech Stack:** TypeScript on Node 26 (type stripping), Vitest 4, fast-check, the TypeScript compiler API for the guard, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-16-m1-84-measured-minimums-design.md`

## Global Constraints

- Minimum = `min(lowest, floor(mean − 6·sd))`, sample sd (n − 1), over at least 200 runs (spec §4).
- No minimum for: fewer than 200 runs, mean 0, sd 0, or a minimum under 1 (raise runs by `ceil(1.5 · least k)` with `k·mean − 6·√k·sd ≥ 1`).
- A count of 0 always fails (AC8). Record mode judges nothing, zeros included.
- The exemption covers these files only: automation, pemandu-tick, sim, unfold, words (2026-10-12) and review, rng (2026-10-16), under `packages/core/properties/`, and log, under `packages/core/logs/` (spec §5.12).
- No fast-check seed is set anywhere in the properties suite except `tests/properties-setup.ts` (fresh per file per run; `PROPERTIES_SEED` replays). No workflow, suite config or npm script sets `PROPERTIES_SEED`.
- The laptop runs unit tests, format, lint and typecheck only; the guards, properties and recording suites run in CI.
- Floors and minimums are recorded in CI only. A pull request that moves floors is squashed into one commit before it is labelled `record-floors`, and every commit passes alone.

## Review Focus

1. **A rare count reaching 0 on a fresh run** (log's rare refusal kinds, unfold's review/journeys turn-ons). Expected: never a random red. The fetch lists it as too small with its factor, and its runs are raised (Task 6). Pinned by `fetch-minimums.test.ts` "writes no minimum for a count too small to check".
2. **Two runs that drew the same seed for one file.** Expected: the fetch refuses ("the cases repeated"). Pinned by `fetch-minimums.test.ts` and mutation S1.
3. **A breach on a pull request that did not touch the property.** Expected: the message names the seed and the replay command. Pinned by `minimums.test.ts` "names a count under its minimum, with the figures and the seed that replays it".
4. **A new refusal kind appearing in log.** Expected: refused as a new member to record, never silently unchecked. Pinned by `minimums.test.ts` "refuses a member the record does not hold".
5. **A seed fixed through a helper, a spread or a re-export.** Expected: the guard refuses it. Pinned by the `measured-minimums.test.ts` plants (options by name, spread, re-export, namespace import, helper).

---

Tasks 1 to 4 were built and gated as stage commits on `properties/84-measured-minimums` (memory: "plan code from executed stage commits"). Their code is the commit named; their evidence is below. Tasks 5 onward run in CI.

### Task 1: Method, checker, seeding home, fetch (commit `0b4a7db`)

**Files:** Create `scripts/minimums-method.ts`, `scripts/fetch-minimums.ts`, `tests/minimums.ts`, `tests/properties-seed.ts`, `tests/properties-setup.ts`, and their unit tests `tests/unit/{minimums-method,minimums,fetch-minimums,properties-seed}.test.ts`. Modify `scripts/record-floors.ts` (export `GUARD`, `guardOf`), `scripts/fetch-floors.ts` (`fetchRefusal(…, workflow)`) and `tests/floors.ts` (export `callSite(stack, self)`).

**Interfaces (produced):**

- `summarise(values): Summary`, `assess(summary): Assessment`, `raiseFactor(mean, sd): number`, `readMinimumsDir(dir)`, `writeMinimums(dir, next): string[]`, `minimumsFileOf(id)`, `MINIMUMS_DIR`, `MIN_RUNS = 200`, `SIGMAS = 6`, `MINIMUMS_RECORD_ENV`, `MinimumObservation`, `Measured`.
- `minimumBreach(id, actual, options?)` and `minimumsBreach(family, counts, options?)`: each returns `string | undefined`.
- `chooseSeed(replay, fresh?)`, `rememberSeed`, `currentSeed`, `SEED_ENV = 'PROPERTIES_SEED'`.
- `sampled(runs)`, `fetchedMinimums(local, samples)`, `reportTable(rows)`, `describeMinimumMoves`, `parseRun`, `artifactPrefix`, `SHARDS = 4`.

- [x] Tests written with hand-worked figures (for example, alternating 0/4 over 200 runs gives least k 38 and factor 57).
- [x] Green: 147 of 147 across the stage's and the touched floors files.
- [x] Red against throwing stubs (`.superpowers/sdd/84/stubs/stage1/`): 79 of 79 failed.
- [x] `tsc`, eslint and prettier clean.

### Task 2: Workflow and sampler (commit `36c094e`)

**Files:** Create `.github/workflows/record-minimums.yml`, `scripts/sample-minimums.ts`, `tests/unit/sample-minimums.test.ts`, `tests/unit/record-minimums-workflow.test.ts` and `tests/unit/workflow-file.ts` (the one parsed-YAML home). Modify `tests/unit/record-floors-workflow.test.ts` and `tests/unit/board-orphans-workflow.test.ts` (onto the shared helpers), `tests/unit/properties-ci.test.ts`, `vitest.properties.config.ts` (`setupFiles`) and `package.json` (`minimums:fetch`, `minimums:sample`).

- [x] `node scripts/sample-minimums.ts` and `node scripts/fetch-minimums.ts` load under Node's type stripping and refuse on the laptop.
- [x] Green apart from the floor lines, which CI records: `record-floors-workflow/files` 5 → 6, and `record-minimums-workflow/files` is new.
- [x] Red against a stub of the sampler: 16 of 16.

### Task 3: The ten properties (commit `d9cddb5`)

**Files:** Modify the 8 files under `packages/core/properties/` and its `tsconfig.json`, plus `packages/core/test/synthetic-course.test.ts` and `tests/unit/literal-floors.burn-down.ts` (minus 5). Delete `tests/floors/core-{automation,log,pemandu-tick,sim,words}.json`.

- [x] 51 asserted replacements; nothing named `seed:`, `floorBreach` or `toBeGreaterThan` is left under `packages/core/properties` (positive control: 15 check calls in 8 files, the `EXEMPT` counts).
- [x] Whole unit suite: 13,003 of 13,012 pass. The 9 reds are all floor lines, read one by one: the new workflow moves 7, and 2 are new.

### Task 4: Guard and meta-guards (commit `3005643`)

**Files:** Create `tests/unit/measured-minimums.ts`, `tests/unit/measured-minimums.test.ts` and `tests/guards/measured-minimums.test.ts`. Modify `tests/unit/floorless-searches.ts` (and its test), `tests/unit/literal-floors.ts` (and its test, whose message is now one hoisted constant).

- [x] Reader: 50 of 50. Red against a stub: 49 of 50, the one pass being the literal `EXEMPT` pin, which passes by design.
- [x] Meta-guard units: 348 of 348.
- [x] 11 mutations (`.superpowers/sdd/84/mutations.json`, logs `mut-*.log`), each whole verdict as predicted.

### Task 5: Push, open the draft pull request, record round 1

- [ ] **Step 1:** Run the unit suite by hand (`npx vitest run`). Expected: only the floor lines from Task 3 are red.
- [ ] **Step 2:** `git fetch origin && git merge origin/develop` if develop moved, then push the branch on its own (`git push -u origin properties/84-measured-minimums`).
- [ ] **Step 3:** Open the draft pull request at once, before CI concludes (`pr-on-red-ci`). Body: `Refs #84`, the spec, and that CI is red by design until minimums and floors are recorded.
- [ ] **Step 4:** Move #84 to In Progress (the branch now names it).
- [ ] **Step 5:** Read the PR's first CI run by step name. Expected red only on what is unrecorded: the properties step (no minimums yet), and the unit and guards floors. Every other failure is a finding.
- [ ] **Step 6:** Label the pull request `record-minimums`, then wait on the run with `wait-run.sh` in the background.
- [x] **Step 7:** `npm run minimums:fetch <run-id>`: it writes the sound minimums, prints the table and lists the too-small counts with their factors. Post the table on #84.

### Task 6: The logs suite, raise the small counts, record round 2

Round 1 (run 38830359612): 63 minimums, 41 findings, 36 of them log's (table on #84). Shyden's rulings that day (spec §2, Rulings 5 and 6) move log into a logs suite of its own, run in CI before a release; #609 records log's minimums at their raised sizes.

- [ ] **Step 0a:** Move `packages/core/properties/log.test.ts` to `packages/core/logs/log.test.ts` (with a `tsconfig.json` like the properties folder's). Add `vitest.logs.config.ts`, `npm run test:logs` and `.github/workflows/logs.yml` (`workflow_dispatch`, `workflow_call`; the install step as `ci.yml` writes it; the step limit by `suite-limits.test.ts`'s rule from log's slowest CI run). Extend `suite-configs.ts`, `suite-limits.test.ts` and `properties-ci.test.ts` (or a sibling) to pin it, and that `ci.yml` never runs it.
- [ ] **Step 0b:** Extend the measured-minimums reader's seed rule to `packages/*/logs/` and `vitest.logs.config.ts`, and move log's `EXEMPT` key, with plants for a seed under `packages/*/logs/`.
- [ ] **Step 0c:** The checker's replay command follows the call site: `npm run test:logs` under `packages/*/logs/`, `npm run test:properties` otherwise.
- [ ] **Step 0d:** `resume` and `listen` become exact checks (accepted equals the runs; refused 0; no kinds).
- [ ] **Step 0e:** Do not commit round 1's `tests/minimums/core-log.json`.
- [ ] **Step 1:** For each property holding a too-small count, take the largest factor among its counts and set `numRuns` to the first round count at or above `numRuns × factor`. Comment at the count with Ruling 4 and the round-1 figures that set it.
- [ ] **Step 2:** Commit, push, label again, and fetch again. Repeat until the fetch lists no finding. Post each round's table on #84.
- [ ] **Step 3:** Compare the properties step's CI time before and after (CI logs), and the workflow's per-shard time against its 20-minute limit. Set the limit from that measurement, and record both figures for the pull request.

### Task 7: Floors, squash, mutations in CI

- [ ] **Step 1:** Squash the branch into one commit (floors move). Label `record-floors`, run `npm run floors:fetch <run-id>`, and fold the floors into that commit (`git commit --amend`) so that every commit is green. Push.
- [ ] **Step 2:** AC3/AC8 on a throwaway draft pull request off this head, as #543 did. One mutant per counted region narrows its generator so the region is reached far less often (for example, sim's gaps that never end at an hour edge, log's events that are never affordable, unfold's walks that never collect). Predict the red tests by title first, then read the whole verdict.
- [ ] **Step 3:** Merge into develop once CI is green on the head SHA, then tick ACs 1 to 9 on #84 with citations, and close it by hand.

## Self-review (2026-10-16)

- **Spec coverage:** §4 is Task 1 (method). §5.1 to §5.4 are Tasks 1 and 3. §5.5 and §5.6 are Task 2. §5.7 is Task 1. §5.8 to §5.10 are Tasks 3 and 4. §5.11 is Task 1. §6 is Tasks 5 to 7. §7 is the gates above, plus Task 7.
- **Placeholders:** none. Tasks 5 to 7 depend on CI figures that do not exist yet, and say what decides them.
- **Type consistency:** the names in the Interfaces block match the committed code (checked by `tsc` over the workspace).
- **Review Focus:** each of the five lines names the test that pins it.
