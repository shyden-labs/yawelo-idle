# Handover: Yawelo Idle

**Written:** 2026-10-30 (twenty-fifth session, overnight; Shyden asleep until 06:00 WIB, said to carry on without him). **Running when written:** #786's record run 40949807953, with a local waiter that dies with this session (re-run: `~/.claude/scripts/wait-run.sh ../yawelo-idle-786 40949807953 ../yawelo-idle-786/.superpowers/sdd/786/head.sha`).
**Next session:** `ListAgents`, then `board-next` (names #728, In Progress and blocked by #733, by design: `scripts/board-next.ts:8`).

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## #782: closed (PR #787, merged as `2d9f7d0`, dev deploy green, Done on the board)

## #785: closed (PR #789, merged as `c802418`, dev deploy green, CI resolved Node v26.12.1)

## #786 (P2, worktree `../yawelo-idle-786`, branch `tooling/786-zero-resolves`, HEAD `6990ec8` on develop `c802418`, not pushed)

`zeroExpectationOf` for scalar zeros (settled and polled zeros counted, never sites). Mutation rows 4 of 4 matched; new code fully covered; probe stamped; scratch `refs/floors/tooling/786-zero-resolves`; record **40949807953**. Next: `npm run floors:fetch 40949807953`, amend (`.superpowers/sdd/786/msg.txt` + `Floors: recorded in run 40949807953`), unit, push, PR (body `.superpowers/sdd/786/pr.md`), merge when green, verify dev, close #786, delete the scratch ref.

## #780: parked on Shyden (credential)

Mac spike (comment on #780; logs in `-761/.superpowers/sdd/762/probes/act-spike-780/`): under act, checkout, setup-node and **the gate pass**, but the `ref:` checkout needs a token, and a fake token breaks act's own action cloning. A rehearsal needs a real token (the job's read-only `GITHUB_TOKEN`) or a copy of the workflow with the `ref:` checkouts dropped. AC9 says no real secrets: **his call.** Docker Desktop was started for the spike and quit after.

## #762 (worktree `../yawelo-idle-761`, HEAD `2e28892`, not pushed by design)

Blocked by #780. Task 1 (#733) is fully written: `6d36f3b` attach, `0958de0` checker, `0235816` measure calls it (+ end-to-end measure cases), `267c496` coverage-env reader, `01502e0` whole-tree guard + `733-child-coverage.ts` (11 rows), `2e28892` the guards (4) and integration (2) mutation rows. Unit: 14,433 tests, the same 9 floor breaches as the merge. **Never run (CI-only):** integration, guards and all 733 mutation rows. Plan log: pass 8 (P8-1 to P8-3) in `.superpowers/sdd/762/plan.md`.

## #780 (P0, 8 points, re-scoped)

Shyden: **"test the 3 lines, fix the problem"**, then **"Yes, re-scope #780"** (ACs 6-11 on GitHub). Develop's one-job `rehearse` runs the measured commit's `rehearse.ts`, which runs `act -j rehearse` on the commit's own `record-floors.yml`, traced by `scripts/trace-step.sh` (measures its own lines by observation, AC7) and joined by `traceTable`. **First:** measure whether act runs that job inside the 10-minute job on a runner; if not, stop and report.

## For Shyden in the morning

- **#783 (P0): nothing on GitHub stops a pull request into `main` from a branch that isn't a `release/*` cut** (`main` requires only `build-and-test`; only my local hook guards it). Blocked by #762.
- **#784 (P2, 13 points): Yawelo's own Cloudflare login and accounts.** It needs your new Gmail and login. Question: should #425 (site prod infrastructure, P1) wait for them, or be built in shyden.co.uk's account and moved later?
- **#782** closed (PR #787). **#785** (exact `.nvmrc`) is in its record; Node 26.13.0 is out (2026-10-28), a bump left to the alignment skill. **#786** (P2): a guard blind spot (ShyTalk's), sibling of #697.
- **#780 (P0): may the rehearsal hand act the job's own read-only `GITHUB_TOKEN`?** Without it, act can't check out the measured commit (spike above). The alternative rehearses a copy of the workflow with its `ref:` checkouts dropped.
- **`hooks/disguised-waits.py` misses perl's `select(undef,undef,undef,N)`.** I used it once by mistake and it ran unrefused; recorded in the guard reference. The hook change is yours.
- **#788 (P2): your route.** `allowScripts` approves esbuild and workerd for every version. Exact pins (re-approved on each Dependabot bump), denying both scripts, or keeping bare names? Measurements are planned first.
- repo-template#134 (mutation runner). ShyTalk says you allowed b2 a one-time read of Yawelo.

## Waiting on Shyden

- Delete the #771 scratch ref `refs/floors/tooling/771-record-rehearse-job` (`1450a1e`).
- `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- How to measure a unit test's own CPU now the overlay is refused (#536).

## Progress (board read 2026-10-29, after #780 was filed)

- **By tickets:** 32% complete (140 of 444 in-scope stories), 0.57/day over 7 days. ETA 2028-04-12 before outside waits (low confidence).
- **By effort:** 1,326 points remaining across 304 open stories, 1.57 points/day. ETA 2029-02-18 before outside waits (low confidence).
- Measured: the board and its 7-day pace. Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone sign-off (no date). Re-read the board at close-out: #782 to #786 were filed since.

## State

- Main checkout on `handover/2026-10-17-d` (local handover commits). Its CLAUDE.md is OLD; read develop's.
- Worktrees: `-761` (#762), `-782` (#782), `-771`; `-728b`, `-752`, `-36` parked; `-728-probe` has uncommitted probe files (ask before removing).
- Run logs go in `.superpowers/sdd/<ticket>/` (ignored), never a worktree root.
- Backups kept 30 days: tag `backup/771-pre-squash-2026-10-28`, `.superpowers/HANDOVER.bak-2026-10-29-s25`, `-761/.superpowers/sdd/762/plan.md.bak-pass8-2026-10-29`.
- Use `/usr/bin/grep` for searches whose empty result matters (the shell's `grep` wrapper missed a control).
