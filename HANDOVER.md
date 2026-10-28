# Handover: Yawelo Idle

**Written:** 2026-10-28/29 (twenty-third session). **Running when written:** PR **#777** CI on `12c6c64` (GitHub-side; survives `/clear`): board-orphans 40731393002, build-and-test 40731393083, mutations 40731392980. The local waiters die with the session: re-wait with step 1.
**Next session:** `ListAgents`, then `board-next`. It names **#771** (P0, In Progress): resume it.

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## Resume steps (#771, worktree `../yawelo-idle-771`, branch `tooling/771-record-rehearse-job`)

HEAD `12c6c64`, pushed, in `.superpowers/sdd/771/pr-head.sha`. Commits: `66bad12`, `402ddb2`, `09e406e`, `bd0c303` (empty, Shyden's route), `12c6c64` (act fix + floors from record run 40729358920, `Floors:` line). Unit on `12c6c64`: 158 files, 14092 tests green.

1. Wait for the three runs: `~/.claude/scripts/wait-run.sh /Users/shyden/Developer/Repos/yawelo-idle-771 <run-id> /Users/shyden/Developer/Repos/yawelo-idle-771/.superpowers/sdd/771/pr-head.sha > <log> 2>&1; echo "rc=$?"` in the background, per run id above. Read every job and step BY NAME; required = board-orphans, build-and-test, mutations. Mutations runs 6 files, including the new `771-gate-io.ts` (integration, CI-only; predictions never run yet).
2. Green on `headRefOid`: squash-merge into develop with `--match-head-commit "$(cat .superpowers/sdd/771/pr-head.sha)"`; keep each commit's reasons in the squash message.
3. DoD: the next develop record shows `rehearse` green; post its manifest on #771 and close it by hand.
4. Scratch ref `refs/floors/tooling/771-record-rehearse-job` (now at `1450a1e`) is still on origin; its delete was refused as "Git Destructive" (final). Shyden deletes it, or rules otherwise.
5. Then #762 pass 7 (plan `yawelo-idle-761/.superpowers/sdd/762/plan.md`); merge develop into #762's branch first.

## Done this session

- PR #777 on `66bad12`: mutations red (748 6/8, 718 16/18), stale after #771's new tests. Fixed in `402ddb2` (labelled hindsight entries; sibling rows predicted first) and `09e406e` (four index orderings that passed with a step missing). Log: `.superpowers/sdd/771/stale-predictions.md`.
- On `09e406e`: guards red on three grown floors (pushed before recording). Shyden chose "Empty commit on top": `bd0c303`.
- Record run 40723820849 failed at Rehearse: act's version check printed a notice and one extra stdout newline (3 of 5 fresh-cache runs, measured locally). Fix in `12c6c64`: `ACT_DISABLE_VERSION_CHECK=1` on both act calls via an optional env on `GateIo.run`; parser stays strict; integration test `record-gate-io.test.ts`; rows in 771 (22/22 apart from one timeout row) and `771-gate-io.ts`. Record run 40729358920 green; 31 floors rose, none fell; coverage untested unchanged (4345).
- Filed **#778** (P2, 3): the -1 ordering form elsewhere and a guard. **#775** AC6 + Estimate 8. **#536**: three local 1 s timeouts at load 42 to 106; own CPU unmeasured (the overlay is refused by `local-suites-unit-only`).
- Global, Shyden's "Every push": `~/.claude/hooks/floors-line-before-first-push.py` judges each commit a later push adds (31 cases, 20 mutants matched). Backups `*.bak-2026-10-28-every-push`; the test file's true original is `...test.py.bak-2026-10-28-every-push-original` (the plain `.bak` one is one blank line short). CLAUDE.md line reworded (", first pushed with a" → "; every pushed commit has a", "2026-10-21" → "2026-10-21/28"); reference section added.

## Waiting on Shyden

- Delete the #771 scratch ref (step 4).
- `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- How to measure a unit test's own CPU now the overlay is refused (#536).
- Offered: a hook refusing a call sent beside a failed Edit.

## Progress (board read 2026-10-28)

- **By tickets:** 32% complete (140 of 443 in-scope stories), 0.57/day over 7 days. ETA 2028-04-11 before outside waits (low confidence: five of seven days at zero).
- **By effort:** 1,323 points remaining across 303 open stories, 1.57 points/day over 7 days. ETA 2029-02-16 before outside waits (low confidence).
- Measured: the board and its 7-day pace. Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone production sign-off at release (no date).

## State

- Main checkout on `handover/2026-10-17-d` (local handover commits). Its CLAUDE.md is OLD; read develop's.
- Worktrees: `-771` (above); `-761` (#762, local `9e577b1`, not pushed by design); `-728b`, `-752`, `-36` parked; `-728-probe` has uncommitted probe files, so ask before removing it.
- Phones connected; nothing phone-held runs before the release (#713 AC5).
- Backups kept 30 days: tag `backup/771-pre-squash-2026-10-28`, `~/.claude/hooks/*.bak-2026-10-28-*`.
