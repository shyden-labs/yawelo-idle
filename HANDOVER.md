# Handover: Yawelo Idle

**Written:** 2026-10-28 (twenty-second session). **Running when written:** PR **#777** CI on `66bad12` (GitHub-side; survives `/clear`): build-and-test 40697004652, mutations 40697004648, board-orphans 40697004675. The local waiters die with the session: re-wait with step 1.
**Next session:** `ListAgents`, then `board-next`. It names **#771** (P0, In Progress): resume it.

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## Resume steps (#771, worktree `../yawelo-idle-771`, branch `tooling/771-record-rehearse-job`)

HEAD `66bad12`, pushed, one commit. PR #777 into develop is open (body `.superpowers/sdd/771/pr-body.md`, placeholders filled).

1. Wait for PR #777's runs: `~/.claude/scripts/wait-run.sh /Users/shyden/Developer/Repos/yawelo-idle-771 <run-id> /Users/shyden/Developer/Repos/yawelo-idle-771/.superpowers/sdd/771/pr-head.sha > <log> 2>&1; echo "rc=$?"` in the background, once per run id above. `pr-verdict.sh 777` returned while all were still queued: read the runs, not its exit code. Read every job and step BY NAME; required = board-orphans, build-and-test, mutations.
2. Green on `headRefOid` (`pr-head.sha`): merge into develop with `--match-head-commit "$(cat .superpowers/sdd/771/pr-head.sha)"`, squash.
3. DoD: the next develop record shows `rehearse` green. Post its manifest on #771 and close it by hand.
4. The scratch ref `refs/floors/tooling/771-record-rehearse-job` still exists on origin at `66bad12`. The auto-mode classifier refused its delete ("Git Destructive"), and that refusal is final. Shyden deletes it, or rules otherwise.
5. Then #762 pass 7 (plan `yawelo-idle-761/.superpowers/sdd/762/plan.md`). #762's branch predates #771: merge develop in first.

## Done this session

- Branch record run 40664027990 (`66bad12`): `rehearse`, `record-floors`, `record-coverage` green, every step read by name. All 73 floors and `tests/coverage/record.json` are byte-identical to the commit's, so `floors:fetch` would move nothing. The manifest (act 0.2.89, `of: 11`) lists the same 11 workflow files `git ls-files` does.
- Mutations log re-read: `771-record-rehearse.ts` 12 of 12 matched at `66bad12`.
- PR #777 opened; branch 0 behind develop, merges clean.
- **Phones available again** (Shyden via repo-template-54, 2026-10-28). Both are connected: OnePlus CPH2653 (adb `3b402284`) and iPhone Air (devicectl, paired). The only phone-held work, #713 AC5, has its dev-copy half done on both phones (2026-10-21/22). What's left: production at release (prod still serves same-origin `/media/`; #768 and #769 open) and the shyden.co.uk#835 embed (other repo). Nothing runnable today; peer told.

## Waiting on Shyden

- Delete the #771 scratch ref (step 4).
- `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- Offered: a hook refusing a call sent beside a failed Edit.

## Progress (board read 2026-10-28)

- **By tickets:** 32% complete (140 of 442 in-scope stories), 0.57/day over 7 days. ETA 2028-04-09 before outside waits (low confidence: five of seven days at zero).
- **By effort:** 1,317 points remaining across 302 open stories, 1.57 points/day over 7 days. ETA 2029-02-13 before outside waits (low confidence).
- Measured: the board and its 7-day pace. Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone production sign-off at release (no date).

## State

- The main checkout is on `handover/2026-10-17-d` (local handover commits, not pushed). Its CLAUDE.md is OLD; read develop's.
- Worktrees: `-771` (#771, above); `-761` (#762, local `9e577b1`, not pushed by design); `-728b`, `-752`, `-36` parked; `-728-probe` has uncommitted probe files, so ask before removing it.
- A branch cut before #771 lacks `scripts/rehearse.ts`, so its next record fails at the rehearse step. Merge develop first.
- Backups kept 30 days: tag `backup/771-pre-squash-2026-10-28`, plus the hook backups `~/.claude/hooks/*.bak-2026-10-28-*`.
