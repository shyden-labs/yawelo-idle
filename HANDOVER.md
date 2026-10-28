# Handover: Yawelo Idle

**Written:** 2026-10-28 (twenty-first session). **Running when written:** run **40664027990**, the BRANCH's own `record-floors.yml` on `66bad12` (GitHub-side; it survives `/clear`). The local waiter dies with the session: re-wait with step 1.
**Next session:** `ListAgents`, then `board-next`. It names #728 (blocked); the chain is #728 ← #733 (#762) ← **#771**, so **resume #771**.

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## Resume steps (#771, worktree `../yawelo-idle-771`, branch `tooling/771-record-rehearse-job`)

HEAD `66bad12`, **pushed** (one commit; `Floors: recorded in run 40646855523`). Unit suite at `66bad12`: 158/158 files, 14,090/14,090 tests. Mutations `771-record-rehearse.ts`: 12/12 matched (`.superpowers/sdd/771/mutate-66bad12-b.log`). The probe stamped `66bad12`. The scratch ref `refs/floors/tooling/771-record-rehearse-job` was re-created fresh at `66bad12` (delete, then push; no force). #771 is In Progress.

1. Wait for run 40664027990: `~/.claude/scripts/wait-run.sh /Users/shyden/Developer/Repos/yawelo-idle-771 40664027990 /Users/shyden/Developer/Repos/yawelo-idle-771/.superpowers/sdd/771/head.sha > <log> 2>&1; echo "rc=$?"` (never pipe a background waiter into a filter: the hook refuses it now). Read every job BY NAME (`record-floors`, `rehearse`, `record-coverage`) and the rehearse manifest (11 listed files expected). Its floors should equal the committed ones: if `floors:fetch 40664027990` would move anything, stop and find out why.
2. Delete the scratch ref: `git push origin --delete refs/floors/tooling/771-record-rehearse-job`.
3. Open the PR into develop with body `.superpowers/sdd/771/pr-body.md`. Fill in `RESULT_PLACEHOLDER` ("12/12 matched at 66bad12") and `BRANCH_RUN_PLACEHOLDER` (run 40664027990 and its verdict). Then `~/.claude/scripts/pr-verdict.sh <pr>` in the background, and merge once CI is green on `headRefOid`. DoD: the next develop record shows `rehearse` green; post its manifest on #771 and close it by hand.
4. Then #762 pass 7 (plan `yawelo-idle-761/.superpowers/sdd/762/plan.md`). #762's branch predates #771: merge develop in first.

Plan, review log and notes: `../yawelo-idle-771/.superpowers/sdd/771/plan.md` (git-ignored).

## Done this session

- Record run 40646855523 fetched and folded in. All 49 floor moves are predicted or file-count growth from the commit's 11 files. Coverage record: 61 mutation files left, the new files at 0 untested, `coverage.ts` 49 untested statements with untested branches 23→21, `record-floors.yml` 105→105.
- **#776 filed** (P0, 3 points): `apps/web/worker/index.ts` reads 12 statements, not 15, on unchanged code. #748 measured inside `record-floors`, and develop's `record-coverage` job measures differently.
- **Global hooks** (`~/.claude/hooks`, backups `*.bak-2026-10-28-*`):
  - `status-through-a-filter.py` refuses a background command ending in a filter (57 cases, 28/28 mutants).
  - `test-isolation.py` locks a script named `*.test.*`/`test_*`/`*_test.*` (LIGHT) or `*.mutations.*` (HEAVY). Before this, my unlocked hook runs starved the first mutation run (2 rows missed on 1 s timeouts; 12/12 with the machine idle). 141 cases; 52/52 mutants.
  - Two lock mutant anchors had been stale since 2026-10-21, so the rows after them never ran; re-anchored, three predictions widened (each kill read).
  - All three forms are in `reference-guard-forms-and-floors.md`.

## Waiting on Shyden

- `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- Phones unavailable: device runs parked (#713 AC5).
- Offered: a hook refusing a call sent beside a failed Edit (this session: twice).

## Progress (board read 2026-10-28)

- **By tickets:** 32% complete (140 of 442 in-scope stories), 0.57/day over 7 days. ETA 2028-04-09 before outside waits (low confidence: four of seven days at zero).
- **By effort:** 1,317 points remaining across 302 open stories, 1.57 points/day over 7 days. ETA 2029-02-13 before outside waits (low confidence).
- Measured: the board and its 7-day pace. Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone sign-off (no date). Filed this session: +3 points (#776).

## State

- The main checkout is on `handover/2026-10-17-d` (local handover commits, not pushed). Its CLAUDE.md is OLD; read develop's.
- Worktrees:
  - `-771`: #771, above.
  - `-761`: #762, local `9e577b1`, not pushed by design.
  - `-728b`, `-752` and `-36`: parked.
  - `-728-probe`: uncommitted probe files; ask before removing.
- A branch cut before #771 lacks `scripts/rehearse.ts`, so its next record fails at the rehearse step. Merge develop first.
- Backups kept 30 days: tag `backup/771-pre-squash-2026-10-28`, plus the hook backups.
