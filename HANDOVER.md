# Handover: Yawelo Idle

**Written:** 2026-11-06 (forty-sixth session, overnight while Shyden slept). **Phones:** none needed by the ticket in hand.
**Running when written:** nothing local. PR #886's CI was running on head `effc2ba6` (GitHub, external).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`; it now has `node_modules`). Node: `~/.local/share/node/current/bin`.

## Done this session (forty-sixth)

- **#874 in PR #886** (branch `deps/874-ts-fsrs-6`, worktree `../yawelo-idle-874`, board In Progress). Its commit `e204077c` was merged with develop to make `effc2ba6`. ACs 1–8 are done, with measured evidence in the PR body: FSRS-7 curve and closed-form mean (worst 1.26e-15 against the 30-digit table), the synchronous FSRS-7 scheduler equal to `DefaultScheduler`, and the golden vectors, golden log and floors regenerated. Red first: 330 failed. Unit is 13,629 green, typecheck and lint clean. The one-time mutation pass ran. Runs and probes are in `../yawelo-idle-874/.superpowers/sdd/874/runs/`.
- Shyden's go-ahead (asked at the start): delete the old worktrees and test board 6. **Both blocked**, see below.

## Resume steps

0. **PR #886 CI:** run `~/.claude/scripts/pr-verdict.sh 886` in the background; it returns early while checks run, so re-run it after CI ends. Read every required check by name on head `effc2ba6` (`build-and-test`, `coverage`, `board-orphans`). If red, fix in the same branch. Floors may need the `record-floors` label (project CLAUDE.md).
1. **Merge only after Shyden answers both #874 questions below** (AC 5 and AC 9 say so). Then squash-merge into develop, verify dev, and close #874 by hand.
2. #783 (P0) has nothing to do until the next release cut.
3. Then `board-next`.

## Waiting on Shyden

- **#874, re-confirm the ranks ruling.** The ruling cited "Mastered after 3 answers", from a probe with model override on. With the short steps he chose, mastery takes the 4th Good answer on **day 52.7** (FSRS-6: day 13.0). Tables are in PR #886 under AC 5.
- **#874 AC 9: pacing outside the tuning targets** (CI bounds still hold). The Casual Learner's gap to destination 11 is 2.866 d (target ≤ 2.8). The Clicker's share is 95.0–96.6% at destinations 6, 7, 9 and 10 (target ≥ 97%; CI floor 95%). Both sweep tables are in the PR.
- **Old worktrees: approved, but `git worktree remove` was refused by the auto-mode classifier.** He can run it himself (none hold uncommitted work; the probe's files are stashed as `stash@{0}` "backup 2026-11-05: 728-probe…"):
  `cd ~/Developer/Repos/yawelo-idle && for w in 36 728b 761 752 794 728-probe 883 863 873 591 871; do git worktree remove ../yawelo-idle-$w; done`
- **Test board 6 (`PVT_kwDOEOcG584BpujW`): approved, but the gh router acts as the App only on recorded boards.** He deletes it in GitHub: project 6 → Settings → Delete project.
- #784 next steps (Gmail, Cloudflare, domains).
- The ETA confidence rule.
- Voyage map layout (#328/#331/#452).
- #655: his SonarCloud project and a `SONAR_TOKEN`.
- #858: where it goes.
- #830: approving its copy.
- Open PRs with no recent movement: #602 (waits on a Stryker runner release), #745, #767, and Dependabot #593, #594, #597, #750, #763, #764, #779 and #834.

## State

- The main checkout is on `handover/2026-10-17-d` (handover commits only).
- Worktrees: `-874` (PR #886), `-dev-scripts`, and the eleven above, waiting for removal.
- Kept local branches: nine `backup/*`, and `tooling/785-nvmrc-exact` `-b`, `-c` and `-d`.

## Progress (board, measured 2026-11-06)

- By tickets: 41% (184 of 449). Pace is 5.14 a day over the 7 finished days to 2026-11-04. ETA 2026-12-27, medium confidence (6 of 7 days moved).
- By effort: 1,169 points remaining across 265 open stories. Pace is 14.00 a day. ETA 2027-01-28, medium confidence.
- Both ETAs are before the outside waits: #784's login and device sign-off.
