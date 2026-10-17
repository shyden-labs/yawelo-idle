# #527: one tracked mutation runner

**Ticket:** #527 (P2). **Blocks:** #619 (the required `mutations` check), which blocks #370. **Written:** 2026-10-17. **Status:** spec, reviewed to zero and self-approved (global rule, 2026-09-24).

## 1. Why

Every story that proves a test can fail writes a fresh `mut.py` in its git-ignored session folder, copied from the last one (#368, #369 and about a dozen before them). The copies drift, they are lost when a worktree is removed, and no CI job can run them. Shyden's rule of 2026-10-16 ("mutation testing is vital", "it must be run") requires a `mutations` check on every pull request that changes a non-unit test (#619). That check needs one tracked runner and one tracked file format. This story builds both.

## 2. What changed since the ticket was written (measured 2026-10-17, `origin/develop` at `bd8907e`)

| Fact                                                                                                                               | Source                                                                                                                                                              | Consequence                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every whole-repo guard now runs only in the guards suite (`tests/guards/`, 19 files, 40 floor ids); the unit suite reads no tree.  | #515 (PR #531), `vitest.guards.config.ts`, `tests/guards/*.test.ts`                                                                                                 | The ticket's three misses (#371, #341, #491) were unit-suite runs that still held those guards. #368's and #369's unit runs matched exactly with no corpus prediction. Corpus floors move only when a mutation's run includes the guards suite, which happens under #619 when a guards test is the target. |
| Every floor is checked for equality, in both directions.                                                                           | `tests/floors.ts:114` (fewer) and `:121` (more)                                                                                                                     | A mutation that adds units to a corpus also goes red (#491's M10, +2). The prediction must carry the figure, not only the direction.                                                                                                                                                                       |
| #491's 28 mutation definitions no longer exist.                                                                                    | `.superpowers/sdd/491/` was in a removed worktree; `find` over every checkout finds no `491` folder and no `count-tree.mjs`. PR #528's text keeps their names only. | AC4 as written ("re-running #491's 25 mutations … no hand edits") cannot be met. It is replaced in §7.                                                                                                                                                                                                     |
| Suite run times in CI: unit 33 s, guards 14 s, integration 30 s, properties 17 s, pacing 44 s.                                     | ci.yml run 39040575704, step start and end times                                                                                                                    | Running a mutation's whole suite in CI is cheap: about 7 minutes for #370's nine pacing mutants.                                                                                                                                                                                                           |
| `scripts/record-floors.ts` already lists every suite (`SUITES`): its directory, the command that lists its files, and how it runs. | `scripts/record-floors.ts:207`                                                                                                                                      | The runner takes its suites from that table. No second list.                                                                                                                                                                                                                                               |

## 3. The mutation file

One TypeScript module per mutation set, in `tests/mutations/`, named `<ticket>-<what>.ts`. It default-exports the value of `mutationFile(...)` from `scripts/mutation-file.ts`, which checks the shape when the module loads and returns it typed:

```ts
import { mutationFile } from '../../scripts/mutation-file.ts';

export default mutationFile({
  targets: ['packages/bots/pacing/pacing.test.ts'],
  mutations: [
    {
      name: 'a-first-sail-blind',
      file: 'packages/bots/src/targets.ts',
      anchor: '  const first = run.sails[0];',
      replacement: '  const first = run.sails[1];',
      red: {
        'packages/bots/pacing/pacing.test.ts › the pacing targets (AC4), at the spec’s bounds > (a) idler sets sail for the first time after 30 to 60 minutes':
          'pacing-first-sail/idler',
      },
    },
  ],
});
```

- `targets`: the test files this set proves (#619 matches changed non-unit tests against these). Each must be tracked, and all must belong to the same suite.
- Each mutation has a unique `name` (it names the log files), a tracked `file`, an `anchor` that is not empty, and a `replacement` that differs from the anchor.
- `red` maps each test predicted to fail, written `<file> › <describe> > … > <title>` exactly as vitest reports it, to text its failure message must contain (the floor id, or the finding). An empty `red` predicts green.
- `mutationFile` refuses, naming the problem: empty `targets`, duplicate names, an empty anchor, an anchor equal to its replacement, an empty message text, a `red` key without `›`.

Why TypeScript and not JSON: anchors are multi-line code, and template literals keep them readable and exact. The typechecker and lint read the file. No backslash-u escapes are typed by hand: a non-ASCII anchor is copied from the source file's bytes.

## 4. The runner: `node scripts/mutate-cli.ts <mutation file>...`

For each mutation file, in order:

1. **Load and check.** Import the module and validate it (§3). Every `file` and target must be committed at `HEAD` (`git cat-file -e HEAD:<path>`) and unchanged against it (`git diff --quiet HEAD -- <path>`), so a restore can be checked against `HEAD`. A dirty file is refused by name.
2. **Find the suite.** For each target, run the `list` command of each `SUITES` entry that has a `mutate` command (§5), and keep the suites that list it. Exactly one suite per target, and one suite for the whole file; anything else is refused, naming the suites found. A target no such suite lists is refused as "in no suite the runner can run (the harness and Playwright suites wait on the follow-up story)". The other suites are never listed: their listings have only ever run in CI.
3. **Laptop rule.** Unless `CI` is `true`, any suite but the unit suite is refused: "the laptop runs the unit suite only (Shyden, 2026-10-09); push and let the `mutations` check run it". The rule is now enforced by the tool instead of remembered.
4. **Baseline.** Run the suite once, unmutated. Any failing test, any timeout, or no JSON report fails the file with the failures listed. The baseline total is kept.
5. **Each mutation**, in order:
   1. Read the file's bytes and hash them. Count the anchor: anything but exactly 1 fails the row (`ANCHOR <name>: <n> matches in <file>`) and skips it. For the guards suite, list the file's importers now, on the unmutated tree (§6; once per file).
   2. Write the replaced text. From here on, a `finally` block, and a `SIGINT`/`SIGTERM` handler, write the original bytes back.
   3. **Corpus prediction (guards suite only, §6).**
   4. Run the suite with `FLOORS_RECORD` unset and two reporters (`default` to the log, and the runner's own, `scripts/mutate-reporter.ts`, to a JSON file named by `MUTATE_REPORT`), bounded by the ceiling (§5).
   5. Restore. Re-hash, and refuse to continue if the bytes differ from step 1.
   6. **Judge.** The row matches when all of these hold: the failing tests are exactly the keys of `red` plus the corpus predictions; each red test's messages contain its text; the total equals the baseline total; no test timed out (counted from the error objects the reporter receives); a report exists. Otherwise it prints `MISS <name>` with every unpredicted failure and its first message line, every predicted test that stayed green, every wrong reason, the total and the timeouts.
6. **End.** `git diff --quiet HEAD` over every mutated file; then `<k> of <n> matched`. Exit 0 only if every row of every file matched.

Logs: `.mutations/<file stem>/<name>.log` and `.json` (git-ignored, kept whole: a name alone once lost a flake's error text). The `mutations` check (#619) uploads the folder.

A run never retries anything. A miss is a finding: it is read and recorded, never re-run.

## 4a. The runner's reporter (after the first run, 2026-10-17)

The first run (`dab0bf0`, 22 mutations on the unit suite) matched 17. #369's 15 all matched. The runner's own 7 put every predicted test red and no other, but 5 missed on their reason text, and one of them also reported a timeout that did not happen. Both were the runner's defects, not the predictions':

- **Vitest's JSON keeps only a failure's headline.** Strings are cut at about 30 to 38 characters (`expected undefined to be 'pacing suite: the laptop runs the uni…'`), objects are shown as `[ { …(5) } ]`, and no diff is kept. A floor id past the cut, or a guard's finding inside an object, could never be judged. Chai's `truncateThreshold` is not settable from the CLI (`chaiConfig: null`).
- **A timeout counted from the log is fooled by a code frame.** Vitest prints each failing test's source, and a test whose source holds the words "Test timed out" (`180|  ' FAIL a > b\nError: Test timed out…`) read as a timeout.

Probed on vitest 5.0.3 (an object mismatch, a 55-character string, a 1.5 s test against a 1 s limit): the error objects a reporter receives (`testCase.result().errors`) carry the full `diff`, `actual` and `expected`, and a timeout's `message` begins `Test timed out in`. So `scripts/mutate-reporter.ts`, a vitest reporter, writes at `onTestRunEnd` the run's total, its files, each failing test with its full error text (message, diff, actual, expected), a file that failed outside any test as `<file> › (the file)`, and the timed-out tests. The runner reads that file instead of vitest's JSON, fail-closed. The 7 self-mutants are rewritten for the new code, with predictions written before their run.

The second run (`9b0a949`, 24 mutations) matched 23: #369's 15 again, and 8 of 9 new self-mutants, the long reasons now read whole. The miss was a prediction: a function expected to throw that throws nothing fails with vitest's bare "to throw an error", naming no expected text. Its row was corrected, marked as hindsight, and given two siblings predicted before their first run; the third run (`6cc3c27`) matched 11 of 11.

PR #650's first CI run (`a54530b`) put the code before the whole-repo guards, which the laptop does not run. Five found real breaches, each fixed by the repository's own idiom, none by widening a guard: `raised-limits`, `collection-calls` and `fast-check-in-unit` follow every import of the files the suites load, and refused `main`'s `import()` of a mutation file by a run-time path, so `main` moved to `scripts/mutate-cli.ts`, which no test loads; `git-walks` reads only literal git argument arrays and keeps `ls-files` in one home, so the wrapper went and "tracked" became `cat-file -e HEAD:<path>`; `floorless-searches` found 13 absence searches in the new tests proving nothing about what they searched, now proved with `watched` + `searched` + a recorded floor (which made `Report.failing` a list of `{ name, text }`), `againstControl` for an input empty on purpose, or an exact result with a control member. The second CI run (`758c80a`) left one: `raised-limits` refuses a local `test` or `suite`, which shadows vitest's and hides which calls are tests, so the reporter's loop variable, `realIo`'s suite entry and the reporter test's helper were renamed. The guard's own reader, applied to the eight new files outside the suite, found nothing and counted every call before the next push. With the floors recorded, the self-mutation file ran on the pull request's own commit (`7da72b1`): 11 of 12. The new floor's mutant matched; the miss was a stale prediction, since the guards fix had given a timeout test a genuine timed-out control member that one mutant now also turns red. Its row was corrected, marked as hindsight, and given a sibling predicted before its first run. The fifth run (`a94d5fc`, the same commit's file with those two rows) matched 13 of 13.

## 5. Suites and the ceiling

`Suite` in `scripts/record-floors.ts` gains an optional `mutate`: the vitest arguments the runner runs the whole suite with, to which it adds `--reporter=default --reporter=<absolute path of scripts/mutate-reporter.ts>`. It is set for the six vitest suites run from the root: unit, guards, integration, properties, logs and pacing. The four harness suites need a build first and the two Playwright suites write another report shape, so they have no `mutate` yet and are refused by name. A follow-up story covers them before #619 can require them (filed with this spec).

Each suite run is bounded at **600 s**, a guard against a mutation that loops forever (memory: "a mutation can hang the suite"), not a performance limit. Basis: the slowest suite, pacing, took 44 s in CI, and a busy laptop has run 12 times slower than its CPU time (global rule); 600 s is 13.6 times 44 s. Past it, the runner kills the run's process group, restores, and fails the row naming the suite and the ceiling.

## 6. Corpus prediction

Run only when the suite is the guards suite: by #475's definition, the whole-repo checks. Those are the only floors a mutation can move without affecting the logic they check.

A corpus move is a guard reading the mutated file **as text** (line-of counts property accesses in every TypeScript file, the mutated one included). A guard that **imports** the mutated file has had its logic changed, and its moved floor is a real effect that the author predicts. So, before planting, the runner asks which guards files import each mutated file: `vitest related <file> --run -c vitest.guards.config.ts -t <a pattern no test matches>` with the runner's reporter. Vitest 5.0.3 picks related files from the module graph's static and dynamic import edges before running anything (`getAffectedModules`, `node_modules/vitest/dist/chunks/index.DpLw24bj.js:18617`), and the pattern skips every test, so it lists files without running a check. These are the **importers**.

With the mutation planted, the runner then runs the guards suite with `FLOORS_RECORD=<tmp file>`. In that mode `floorBreach` appends `{ id, actual, site }` for every call and returns no breach (`tests/floors.ts:106`). For each observation whose `actual` differs from the recorded figure (`readFloors()`), and whose `site` file is neither a target nor an importer, the runner predicts that some failing test in the site's file shows `<id>: read <actual>, recorded <recorded>`. It prints each one (`corpus: line-of/accesses 41,201 → 41,203, tests/guards/line-of.test.ts`). The judged run then has to show exactly those failures, plus the author's `red`.

Why a record run and not static counting: the guard's own reader does the counting on the mutated tree, so the prediction agrees with the guard by construction, and no counter is copied. The ticket names counting functions for 5 floor ids (`count-tree.mjs`, which no longer exists, `searchSitesIn` and `scanCollection`); the guards suite checks 40 floor ids, and the record run covers every one, and any floor added later.

Why that is not a filter that only shows what is expected: it only accounts for floors in files that neither are the targets nor import the mutated code, so it never explains a change in logic. A floor that moves in a target, or in a guard that imports the mutated file, must be in the author's `red`, or the row misses. §7's planted controls prove both.

Cost per guards mutation: one `related` listing per distinct mutated file (cached for the file), and one extra guards run (14 s in CI).

## 7. Acceptance criteria, corrected

The ticket's AC1, AC3 and AC5 stand. AC2 and AC4 are corrected by §2's facts, and the ticket is edited to match:

- **AC2 (corrected).** For each mutation whose suite is the guards suite, the runner computes, before the judged run, every recorded floor outside the targets that the planted text moves, with its expected figure, by a record-mode run of that suite (§6). Each one is added as a predicted failure.
- **AC4 (replaced).**
  1. _Parity:_ #369's 15 mutations (the latest set, written for the tree `develop` holds now) are converted by script, with no prediction edited by hand, into `tests/mutations/369-bots-run-player-streams.ts`. The runner gives 15 of 15 matches on the unit suite.
  2. _Corpus class (#491's misses):_ an integration test runs the runner over a fixture repository whose guards suite has a corpus floor counting property accesses across its files, and checks three cases. (a) A mutation that blinds a target reader while adding accesses matches, with only the target test in `red`; the run's failures include the corpus guard's test, and the runner's output names the floor, its two figures and its file, so the match rests on the corpus prediction. (The judge given that run without the corpus prediction misses: a unit test.) (b) A mutation that moves a floor in a target file without predicting it misses. (c) A mutation in a helper that a non-target guard imports, which moves that guard's floor, misses unless predicted, and matches when predicted.
- **Estimate:** re-scored from 5 to 8. The runner, its file format, the suite field, the record-mode prediction, the fixture repository and the conversion are about #84's size (8 points), not #547's (5 points: one workflow and one fetch script).

## 8. Files

| File                                                                      | Holds                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/mutation-file.ts`                                                | The types and `mutationFile` (shape check). Pure.                                                                                                                                                                                                                                                                   |
| `scripts/mutate-cli.ts`                                                   | `main`: loads each mutation file by path and runs it. Apart, because no file the suites load may import by a run-time path.                                                                                                                                                                                         |
| `scripts/mutate.ts`                                                       | The pure parts: suite resolution from list outputs, anchor planting, report reading (failing names, totals, timeouts), corpus prediction from observations, judging, report text. And `main`, which wires them to real processes and files through an `Io` interface (exec with a ceiling, read, write, hash, git). |
| `scripts/record-floors.ts`                                                | `Suite.mutate` and its six values.                                                                                                                                                                                                                                                                                  |
| `tests/unit/mutation-file.test.ts`, `tests/unit/mutate.test.ts`           | One test per case over the pure parts, and `main` driven through a stand-in `Io` (no process, no socket, no tree read).                                                                                                                                                                                             |
| `tests/integration/mutate.test.ts` + `tests/integration/fixtures/mutate/` | The fixture repository and §7's three cases, run for real.                                                                                                                                                                                                                                                          |
| `tests/mutations/369-bots-run-player-streams.ts`                          | The parity set.                                                                                                                                                                                                                                                                                                     |
| `.gitignore`                                                              | `.mutations/`                                                                                                                                                                                                                                                                                                       |
| `package.json`                                                            | `"mutate": "node scripts/mutate-cli.ts"`                                                                                                                                                                                                                                                                            |
| `CLAUDE.md`, `HANDOVER.md`                                                | Point at the runner; session `mut.py` copies stop (AC5).                                                                                                                                                                                                                                                            |

## 9. Testing

- TDD: each unit test is written and seen red before its code, one test per case, and every unit test stays inside 1 s and 0.1 s of its own thread CPU. `main`'s unit tests use the stand-in `Io`, so the unit suite starts no process.
- The integration test is the real run. Its cost is measured in the PR against the integration step's 1-minute limit (30 s used today). If it does not fit, the test is cut, never the limit.
- Mutation-verify the runner's own controls, predictions written first: the anchor count, the moved-total refusal, the restore hash check, the timeout count, and the corpus prediction's exclusion of targets. These run as unit-suite mutations through the runner itself: the first real use, which is allowed on the laptop.
- Floors the new files move (`line-of`, `collection-calls`, `record-floors/typescript-files`, and the rest) are recorded by the `record-floors` label in CI and folded into one commit (repo rule).

## 10. Out of scope

- The `mutations` workflow, the guards test that parses every file in `tests/mutations/`, and the required-check setting: #619.
- The harness and Playwright suites: the follow-up story (§5).
- Stryker source mutation: #36.
