# Handover: Yawelo Idle

**Written:** 2026-11-06 (forty-eighth session). **Running when written:** nothing local. PR #886's CI on head `3cc252da` may still be running (GitHub's). Written before a planned laptop restart: every worktree clean; unpushed only `728b` (10), `761` (10) and `752` (3 commits, 2026-10-24, its ticket closed as not planned), all stale backups kept on purpose and in the removal list below. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session (forty-eighth)

- **PR #886 was red** on `0da61b07` (`build-and-test` Properties step and `coverage`): the properties suite's full golden-vector pins for `meanR` and `review` were still FSRS-6's; #874 had updated only the unit prefix pins. Computed on macOS: identical to CI's values, and the six det-math pins unchanged (control). Fixed in `3cc252da`, unit 13,630 green (`../yawelo-idle-874/.superpowers/sdd/874/runs/unit-3cc252da.txt`), pushed. PR shows `merge=BEHIND` develop.
- **#402:** PR #887 was in fact opened and merged (`5aa1a942`, 2026-11-05 18:29 UTC). **Its dev deploy failed** (run 42084808174): `smoke` failed 1 of 20, `[webkit] shell.spec.ts:91` at `page.goto('/play/')`, "Connection reset by peer"; `dev-verified` skipped. It is the first connection reset in all 24 failed deploy-dev runs and came on the first 26.04 deploy. The cause can't be measured because the job keeps no evidence. Filed **#888** (P2, 2 pts, sibling of #864). Recorded on #402; AC 3 is unmet, so #402 stays open and is back to Todo (branch deleted, no PR).

## Resume steps

0. **PR #886 CI:** run `~/.claude/scripts/pr-verdict.sh 886` in the background and read `build-and-test`, `coverage` and `board-orphans` by name on head `3cc252da`. Update the branch from develop if needed (merge, no force-push).
1. **Merge only after Shyden answers both #874 questions below.** Then squash-merge into develop, verify dev, and shut the ticket by hand (`gh issue close`).
2. **#402 AC 3:** read the next deploy-dev on develop (26.04) job by job. When every job passes, record it on #402 and shut it by hand.
3. #783 (P0) has nothing to do until the next release cut. Every P1 waits on Shyden (#784 chain: #425, #426, #457, #759; #655 SonarCloud; #830 copy). Next P2 Todo by age: #497 (a daily check: ask its daily cost first), #513, then the rest. #888 and #864 are small siblings.

## Waiting on Shyden

- **#874, re-confirm the ranks ruling.** The ruling cited "Mastered after 3 answers", from a probe with model override on. With the short steps he chose, mastery takes the 4th Good answer on **day 52.7** (FSRS-6: day 13.0), re-measured on head `0da61b07`. Tables are in PR #886 under AC 5.
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

- By tickets: 41% (184 of 450). Pace is 5.86 a day over the 7 finished days to 2026-11-05. ETA 2026-12-22, medium confidence (6 of 7 days moved).
- By effort: 1,171 points remaining across 266 open stories. Pace is 16.71 a day. ETA 2027-01-16, medium confidence.
- Both ETAs are before the outside waits: #784's login and device sign-off.
