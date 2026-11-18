# #84: property reach counts take measured minimums

**Ticket:** #84 (P2, 8 points). **Written:** 2026-10-16. **Status:** spec, reviewed to zero and self-approved (global rule, 2026-09-24).

## 1. Why

Ten fast-check properties count how often they reached the cases they judge (a "reach count"), so a property whose generator stopped reaching a hard case cannot pass. Eight of them hold those counts as exact recorded floors (`floorBreach`), which only works because each runs at a fixed `seed` and so draws the same cases every run. Shyden ruled on 2026-10-12 that properties draw fresh cases ("don't repeat."). A count on fresh cases moves from run to run, so an exact floor would fail at random. The other two (`review`, `rng`) already draw fresh cases and carry hand-typed minimums (`> 1000`, `> 10`), which the literal-floors rule forbids.

This ticket removes every seed and checks each reach count against a **measured minimum**: a figure low enough that a fresh run falls under it only through a real defect.

## 2. Rulings this spec rests on

| Date       | Where                 | Ruling                                                                                                                                                                                                                                                                                                                          |
| ---------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-12 | #543, AskUserQuestion | "Fresh cases, safe minimums": the 8 floored properties lose their seeds; each reach count is checked against a measured minimum, an exemption from exact floors granted for these alone.                                                                                                                                        |
| 2026-10-12 | #543                  | "revert to original": each property runs at its count from before any cut.                                                                                                                                                                                                                                                      |
| 2026-10-16 | #84, AskUserQuestion  | "Yes, all 10": `review` and `rng` join the exemption.                                                                                                                                                                                                                                                                           |
| 2026-10-16 | #84, AskUserQuestion  | "Raise their runs": a count too small to hold a safe minimum gets its property's `numRuns` raised until it can. Nothing is cut, summed or dropped.                                                                                                                                                                              |
| 2026-10-16 | #84, round 1          | "for this, i think it should be a different CI job dedicated to that. which we will run only as a pre-requisite to a release"; then "i mean for the log checking and audit checking specifically. This should be a test suite of it's own", and the recording cost (about 23 CI machine-hours a recording, estimated) accepted. |
| 2026-10-16 | #84, global           | "this should be the case for all projects, not just this one. separate test suite for logging and auditing. run in ci as a pre-requisite to a release"; then "needs a release pipeline obviously. but for now, you can create the workflow that the release pipeline will call later".                                          |

The exemption covers exactly these files: `automation`, `pemandu-tick`, `review`, `rng`, `sim`, `unfold`, `words` under `packages/core/properties/`, and `log` under `packages/core/logs/` (§5.12). Anywhere else, a measured minimum needs Shyden's consent first.

## 3. The population (AC1)

Derived by `git grep -nE "seed:|floorBreach|toBeGreaterThan|reached"` over `packages/core/properties`, plus the ticket's own list (`synthetic-course.test.ts`):

| Property (file › test)                     | Today                                           | Counts it carries                                  | Becomes                                                                                              |
| ------------------------------------------ | ----------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| automation › tick by tick                  | `seed: 33`, 300 runs, `floorBreach`             | bought, idle                                       | minimums `core-automation/*`                                                                         |
| log › for any %s event (12 types)          | `seed: 34`, 34 runs, `floorBreach`              | accepted, refused, refusal kinds (a set size)      | minimums: accepted, refused, and one count **per refusal kind** (§5.3)                               |
| pemandu-tick › solve                       | `seed: 33`, 10,000 runs, `floorBreach`          | atUntil, firstTick, laterSegment, midSegment, none | minimums                                                                                             |
| sim › plain splits                         | `seed: 474`, 1,000 runs, `floorBreach`          | beside-edge, on-edge, zero-part                    | minimums                                                                                             |
| sim › Pemandu splits                       | `seed: 474`, 300 runs, `floorBreach`            | bought, beside-edge, on-edge, zero-part            | minimums                                                                                             |
| sim › sequences                            | `seed: 474`, 500 runs, `floorBreach`            | bought, buy-refused, checked, clipped, clock-back  | minimums                                                                                             |
| unfold › ${flag} never turns off (8 flags) | `seed: 31`, 300 runs, literals and const tables | steps checked (`> 1885`), turned on, judged        | minimums; `listen`'s turn-on stays `toBe(0)` (§5.4)                                                  |
| words › sequences                          | `seed: 474`, 300 runs, `floorBreach`            | 11 counts                                          | minimums                                                                                             |
| review › never lowers a rank               | unseeded, 300 runs, `> 1000`                    | correct steps                                      | minimum                                                                                              |
| rng › are independent (3 streams)          | unseeded, default runs, `> 10`                  | longest interleaving                               | minimum per stream                                                                                   |
| events (2), hash, log › commute            | unseeded                                        | runs reached                                       | kept: each counts every run unconditionally, so it equals `numRuns` whatever the seed (exact `toBe`) |
| synthetic-course › festival windows (unit) | `windows.length > 0`                            | windows placed                                     | an exact recorded floor: `course()` is deterministic, no property                                    |

## 4. The method (AC2, AC6)

Each count is sampled over **at least 200 fresh-seed runs** of the properties suite in CI. For each count, with `n` runs, lowest `L`, mean `μ` and sample standard deviation `s`:

```
minimum = min(L, floor(μ − 6·s))
```

That is at or below every count seen, and six standard deviations under the mean, so a false failure is vanishingly rare (under a normal model, about 1 in 10⁹ per count per run).

A count gets **no** minimum, and is listed as a finding instead, when:

- `minimum < 1`: too small to check on fresh cases (Ruling 4). The finding names the factor `k` by which its property's `numRuns` must rise: counts are sums over independent runs, so `k` runs multiply the mean by `k` and the standard deviation by `√k`, and `k` is the least integer with `k·μ − 6·√k·s ≥ 1`, taken ×1.5 and rounded up to a round count, to absorb the sampling error in `μ` and `s`. The recording round after the raise checks it.
  `rng`'s longest interleaving is a maximum, not a sum, so `k` does not apply to it. The report says that `k` assumes a sum; were `rng`'s count ever short, a person reads its finding without relying on `k`.
- `s = 0`: no spread over 200 runs, so the count is either fixed by construction (then it is an exact check, not a minimum) or barely sampled. Either way, a person reads it.
- `n < 200`.

## 5. Components

### 5.1 The checker: `tests/minimums.ts`

Sits beside `tests/floors.ts` and has the same runner-neutral shape: it returns the breach as text for the caller's own `expect`.

- `minimumBreach(id, actual, options?)`: nothing when `actual` is at or above the minimum recorded for `id`. Otherwise it returns the breach, naming the id, both numbers and the ruling. A count of **0 is always a breach**, whatever is recorded (AC8). It also refuses a value that is not a count and an id that is not recorded.
- `minimumsBreach(family, counts)`, for counts whose names are known only at runtime (log's refusal kinds): it checks **every id recorded under the family**, treating one absent from `counts` as 0, and refuses a key of `counts` that is not recorded ("a new kind: record the minimums"). Both sides are derived, the record from measurement and the run from the code, so no hand list stands in for either (guard catalogue, "Source of truth list").
- **Record mode:** with `MINIMUMS_RECORD=<file>` set, both append one JSON line per count (`{ id, actual, site, seed, family? }`), judge nothing and return nothing, so a first round can record zeros. Zero is the reason it exists.
- A breach names the seed its file ran at and the command that replays it (§5.11): `npm run test:logs` for a call under `packages/*/logs/`, `npm run test:properties` otherwise, read from the call site.

The method and the record format (§4, §5.2) live in `scripts/minimums-method.ts`, which the checker, the fetch and the guard all import: one home for the maths.

### 5.11 One seeding home: `tests/properties-seed.ts`

A property that fails prints its seed, but a reach count is judged after `fc.assert` has returned, and an unseeded run's seed is lost. So a minimum breach could not be reproduced, which the global rule requires ("reproduce it from its printed seed"). The properties suite therefore takes a setup file, `tests/properties-setup.ts`, that picks a **fresh** seed for each test file on each run (`node:crypto`'s `randomInt`), unless `PROPERTIES_SEED` is set by a person replaying a run. It hands the seed to `fc.configureGlobal({ seed })` and remembers it for the checker. Cases stay fresh on every run (the 2026-10-12 ruling holds), and every red, whether a property's or a count's, names the seed that replays it. That setup file is the only place a seed is set (§5.8 rule 2), and no workflow or config sets `PROPERTIES_SEED`.

### 5.12 The logs suite (Rulings 5 and 6)

`log.test.ts` moves from `packages/core/properties/` to `packages/core/logs/`, the first file of a suite of its own: `vitest.logs.config.ts` (`packages/*/logs/**/*.test.ts`, the same setup file and so the same seeding home, no per-test limit), `npm run test:logs`, and `.github/workflows/logs.yml`, started by hand on the release ref (`workflow_dispatch`) or called by the release pipeline (`workflow_call`, #252). It does not run on pull requests; the unit suite keeps its stand-ins (`packages/core/test/log.test.ts`). Its step carries the one measured limit of `suite-limits.test.ts`.

`resume` and `listen` are accepted by construction (`direct()` returns `ok: true` for both), so their accepted count is checked to equal the runs, and their refused count and kinds to be none: exact facts, not minimums (§4).

Log's other counts take their minimums at their raised sizes in #609, which samples the logs suite on its own. Until then the logs suite is red by design (its counts are unrecorded), which no pull request runs. Round 1's `core-log` minimums, taken at 34 cases a type, are not committed. The audit log (#193) joins the suite when it is built.

### 5.2 The record: `tests/minimums/<group>.json`

One file per group (the id's prefix before `/`, named like a floors file). Each id maps to `{ minimum, runs, lowest, mean, sd }`, so the figure and its evidence sit together. The reader refuses any other shape.

### 5.3 log's refusal kinds

`kinds.size` is a count of distinct kinds. It saturates: once a run has seen every kind, more runs leave it unchanged, its spread falls to 0, and §4 cannot bound it. So each type instead counts refusals **per kind** (`core-log/${type}-refused-${kind}`) through `minimumsBreach`. That is a sum, which §4 bounds, and it proves each kind is still reached, which is stronger than the size of the set.

### 5.4 unfold's `listen`

Listen is on from the first state, so its turn-on count is 0 by construction. It stays `expect(turnedOn).toBe(0)` for `listen` (an exact fact). Its steps-checked and judged counts take minimums like every other flag's.

### 5.5 The sampler: `scripts/sample-minimums.ts`

`npm run minimums:sample -- --runs <n>`. It refuses unless `MINIMUMS_RECORD_JOB=record-minimums` (as `floors:record` refuses outside its workflow). It runs the whole properties suite `n` times, each in a fresh `vitest run` process with fresh seeds (§5.11) and its own record file. Any red run stops it, naming the run: a red property is a real defect (AC9), never a re-run. It judges nothing else: every check of what was recorded happens once, in the fetch, which sees every shard.

### 5.6 The workflow: `.github/workflows/record-minimums.yml`

Started by labelling a pull request `record-minimums`, like `record-floors.yml`: same refusals (develop and main), SHA-pinned actions, read-only permissions. A matrix of **4 shards × 50 runs** (CI measured the properties suite at 8.2 s wall on 2026-10-15, run 38777273204, so about 7 min a shard). Each shard uploads `minimums-<head SHA>-<shard>`. Plain `ubuntu-24.04` with `setup-node`: the properties suite needs no browser.

### 5.7 The fetch: `scripts/fetch-minimums.ts`

`npm run minimums:fetch <run-id>`. It refuses unless the run is record-minimums', completed, successful, on this branch and at its current HEAD (as `fetch-floors.ts` does). It downloads every shard and then refuses when:

- fewer than 4 shards are found;
- any id has fewer than 200 runs;
- two runs recorded the same seed for one file: the cases repeated;
- an id is asserted from two sites, or twice in one run;
- a run's ids, outside families, differ from the first run's;
- a minimum recorded here is missing from the run.

Absent family members count as 0 in that run. It then applies §4, writes the sound ids, prints every minimum that moved, and prints a Markdown table of every id (`n, L, μ, s, μ−6s, minimum`, or the finding with its `k`) to post on #84 (AC6: "the figures and the method are attached here").

### 5.8 The guard: `tests/guards/measured-minimums.test.ts`

Its reader is `tests/unit/measured-minimums.ts`, tested on planted fixtures in the unit suite. It reads the parse tree of every committable TypeScript file and refuses:

1. any reference to `minimumBreach`/`minimumsBreach` (a call, an alias, a namespace access, a pass by reference) outside the exempt files. Each exempt file is pinned with its **number of call sites**, checked for equality ("Exemption binding": a file-wide key must name its count);
2. a `seed` property (written out or shorthand) or a `configureGlobal` call in any file under `packages/*/properties/` or `packages/*/logs/`, in `vitest.properties.config.ts` or `vitest.logs.config.ts`, or in any relative module such a file imports, followed transitively (catalogue row "Imported module's top level"). The one exemption is `tests/properties-setup.ts`, pinned at exactly one `configureGlobal` site. `PROPERTIES_SEED` is refused in every workflow and config file;
3. a `floorBreach` reference in a properties file: an exact floor on fresh cases flakes;
4. a recorded minimum whose entry breaks §4: `minimum ≠ min(lowest, floor(mean − 6·sd))`, `runs < 200`, `minimum < 1`, or `sd = 0`.

Every search puts its population in the verdict (`searched`) and checks it against a recorded floor in the same test.

### 5.9 The floor meta-guards (AC7)

- **literal-floors:** the 5 burn-down entries for `review` (1), `rng` (1) and `unfold` (3) are removed, since those minimums are converted. Its refusal message names `minimumBreach` as the one other accepted form, only in the exempt files, citing the rulings.
- **floorless-searches:** accepts `minimumBreach` as a `searched` call's floor **only** in the exempt files (it imports the exempt list from the guard's reader) and refuses it elsewhere, with plants for both.

### 5.10 Floors that move

The five floors files that hold only these properties' ids (`core-automation`, `core-log`, `core-pemandu-tick`, `core-sim`, `core-words`) are deleted. `synthetic-course/festival-windows` is added. Both are recorded in CI by `record-floors`.

## 6. Staging

1. Build §5 with the properties still at their counts, seeds removed. Open the pull request as a draft at the first push, before CI concludes: until the minimums are recorded its properties step is red by design, and `pr-on-red-ci` refuses a pull request on a head whose required check has already gone red. Label `record-minimums`: **round 1** measures. Fetch: sound ids are written, small ones are listed with `k`.
2. Move log into the logs suite (§5.12). Raise each other listed property's `numRuns` by its `k`, saying in a comment at the count why it is above the restored count (Ruling 4, the figures). Label again: **round 2**. Repeat until the fetch lists nothing. Post every round's table on #84.
3. Label `record-floors`, fetch, and commit the floors as a new commit, pushed normally. (Amended 2026-10-19 by #679: pull requests into `develop` merge by squash alone, so the one squash commit is what lands; no branch is squashed or amended by hand.)
4. Measure the properties step's CI time before and after the raise and give both in the pull request (Ruling 4's cost).

## 7. Verification

- **Unit (laptop):** the checker (every refusal, 0 always a breach, record mode, families), the record reader, §4's maths with fixed inputs and expected outputs written as literals, the sampler and fetch with every process stood in, and the guard's reader on planted fixtures for each applicable row of the guard catalogue (call shape, traced origin, path spelling, exemption binding, imported module's top level). Each new test is first run red against a throwing stub.
- **Guards and properties (CI):** the whole guards suite and the properties suite on the pull request.
- **Mutations (AC3, AC8),** on a throwaway draft pull request as in #543. One mutant per counted region narrows its generator so the region is reached far less often, with the red test predicted by title before the run. The verdict is read whole: every predicted red seen red, everything else green. Count 0 is covered by the unit tests of the checker. The guard's controls are mutated locally through its unit tests.
- **AC4:** no minimum is lowered to make a run pass. A run under a minimum is a finding, filed and explained.

## 8. Not in scope

- Log's minimums at their raised sizes, the logs suite's sampling and the fetch's per-suite scope: #609.

- Exact floors on deterministic tests (the rest of the floor system) are unchanged.
- Properties outside the exempt files keep whatever they have. A future reach count elsewhere asks Shyden first (§2).
