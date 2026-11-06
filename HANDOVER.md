# Handover: Yawelo Idle

**Written:** 2026-11-06 (forty-ninth session). **Running when written:** possibly GitHub's deploy-dev for develop `612d4469` (#886's merge) and CI on PR #889 after develop was merged into it. The session's local waiters die with `/clear`; re-read them as below. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session (forty-ninth)

- **PR #886 (#874, FSRS-7) merged** as `612d4469` after every step passed on `fcc35c08`. The last red was the pacing suite's #297 AC3 catch-up pin: 428 → 410 purchases (probe: branch 410 on 3 fresh courses, develop 428 as control).
- **Shyden's #874 rulings**, recorded on #874: mastery on the 4th Good answer around day 52.7 is right, no retune; AC 9 pacing misses accepted, retune filed as **#890** (P2, 5 pts, blocked by #874).
- **#888:** PR #889 (smoke screenshots on failure, uploaded only when the suite step fails; no trace or video). Tests seen red 4/4, mutation turned 3 red. CI green on `d77e88ce`; the merge hook then wanted develop merged in (1 behind). #888 is In Progress.

## Resume steps

1. **#874 close:** read deploy-dev for `612d4469` job by job (`gh run list -R shyden-labs/yawelo-idle --workflow deploy-dev.yml --commit 612d44695a627ff2e3501225d76179947b13c328`). If every job passed, record it on #874 and close it by hand (`gh issue close 874`), then #890 is unblocked.
2. **#402 AC 3:** the same run is a 26.04 deploy. If every job passed, record it on #402 and close it by hand. If `smoke` fails again, that is #888's evidence case.
3. **PR #889:** if its new head (develop merged in) has CI green step by step, squash-merge it (`--match-head-commit` from a file), read the next deploy-dev, then leave #888 open for AC 3 (14-day tally or the reset explained).
4. Next by board: #783 (P0) waits for the release cut; every P1 waits on Shyden; next P2 Todo by age: #497 (a daily check: ask its daily cost first), #513, #864, #890 once #874 closes.

## Waiting on Shyden

- **Old worktrees:** he can run: `cd ~/Developer/Repos/yawelo-idle && for w in 36 728b 761 752 794 728-probe 883 863 873 591 871; do git worktree remove ../yawelo-idle-$w; done` (none hold uncommitted work; the probe's files are `stash@{0}`).
- **Test board 6 (`PVT_kwDOEOcG584BpujW`):** he deletes it in GitHub (project 6 → Settings → Delete project).
- #784 next steps (Gmail, Cloudflare, domains); the ETA confidence rule; voyage map layout (#328/#331/#452); #655 SonarCloud project and `SONAR_TOKEN`; #858 where it goes; #830 copy approval.
- Open PRs with no recent movement: #602 (Stryker runner release), #745, #767, Dependabot #593, #594, #597, #750, #763, #764, #779, #834.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Worktrees: `-874` (merged, can be removed), `-888` (PR #889), `-dev-scripts`, and the eleven above.
- Kept local branches: nine `backup/*`, and `tooling/785-nvmrc-exact` `-b`, `-c` and `-d`.

## Progress (board, measured 2026-11-06)

- By tickets: 41% (184 of 451). Pace 5.86 a day over 7 days to 2026-11-05. ETA 2026-12-22, medium confidence (6 of 7 days moved).
- By effort: 1,176 points remaining across 267 open stories. Pace 16.71 a day. ETA 2027-01-16, medium confidence.
- Both before the outside waits: #784's login and device sign-off.
