# Handover: Yawelo Idle

**Written:** 2026-11-17 for session `yawelo-idle-d1`. Colima, simulators and USB phones were not claimed. No background subagent. Local CI waiters die with the session; re-read with the commands below.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## The rule that now leads (Shyden, 2026-11-17)

`~/.claude/global-rules/same-tests-on-every-device-before-device-runs.md`: open `unified-tests` tickets come before all other work, and no device or simulator run happens except one that `measures #N` of them (hook-enforced). Two groups: desktop browsers; phones and tablets (real phones, plus iPad and iPhone Duo in the iOS Simulator, Android tablet and foldable in the emulator). No desktop browser emulates a phone. The device runner is built ONCE for every project in the new repo `shyden-labs/playwright-devices` (Shyden is creating it; its session will message every session its first ticket number). Yawelo builds no runner and had no device-runner code to remove.

Current totals (develop deploy run 43824572283, 2026-11-16): 17 browser tests equal on the old five CI targets; real phones 0. Desktop after #995: three targets, 17 each expected, not yet measured on develop.

## In flight

- **#996 (group tags + per-group totals), PR 1002**, worktree `../yawelo-idle-996`, head `e92fc94e` (read by `git ls-remote`). Local unit 14,487 pass. If green: squash-merge (`--match-head-commit "$(cat ../yawelo-idle-996/.superpowers/sdd/996/head)"`), clean up worktree and branches, set #996 Todo, close it only after the develop deploy prints `Target totals: desktop: chromium 17, firefox 17, webkit 17`.
- **#995 (desktop targets only)** merged as `8102adc2` (PR 1001). Board: Todo. Close by hand once the develop deploy of `8102adc2` (or later) shows three equal desktop totals (AC3); AC4 done (spec, and a comment on #323).
- **#992 Android, #993 iPhone** (2 points each, wiring only) wait on the playwright-devices ticket: link it as `blocked_by` when the number arrives. #997 iPad, #998 iPhone Duo wait on #993; #999 Android tablet, #1000 foldable wait on #992. #160 is blocked by #992 and #993 (its AC6).
- **#989, PR 990** (astro 7.4.12, vite 8.3.8), worktree `../yawelo-idle-989`. Branch updated again after #996's push base moved. Its last red was `board-orphans` from my stale In Progress statuses (fixed: #991 closed, #995 Todo). If green, squash-merge, clean up, verify the dev deploy, close #989 after reading every AC, and tell shyden.co.uk's session to move to vite 8.3.8.
- **#160 (backups), draft PR 986**, worktree `../yawelo-idle-160`. Shyden approved the Indonesian as written (Google read-back in `.superpowers/sdd/160/readback.json`). Next: the AC3 notice, failing tests first. It comes after the open unified-tests tickets that are not blocked.

## Resume steps

1. `~/.claude/scripts/pr-verdict.sh 1002`, `~/.claude/scripts/pr-verdict.sh 990`, and `gh run list -R shyden-labs/yawelo-idle --branch develop --workflow deploy-dev.yml -L 3`. Tell Shyden any failure that turn.
2. Merge PR 1002 and PR 990 as above; read the develop deploy's `Target totals:` line; close #995 and #996 on it.
3. When the playwright-devices ticket number arrives, add it as the blocker of #992 and #993.
4. Then #160's AC3 notice. Later: #784 (ask Shyden about deleting the old Yawelo resources in Shyden Labs Dev), #127, #163.

## Done this session (2026-11-17)

- Deploy of `236ac629` green. #991 (deepmerge advisory withdrawn by GitHub) filed, fixed on PR 994 (`18e19416`) and closed. #995 merged. #992, #993, #995 to #1000 filed, labelled `unified-tests`, P0, scored, linked.
- Rulings: #160 Indonesian as written; #632 stays P5; build the phone runner now (as the shared repo); playwright-devices placement (relayed).
