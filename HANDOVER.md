# Handover: Yawelo Idle

**Written:** 2026-11-06 (fifty-first session). **Running when written:** CI on PR #892 (GitHub, survives /clear); nothing local. No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session (fifty-first)

- **#497:** PR #892 (branch `ci/497-dev-behind-develop`, head `64f3d76c`, worktree `../yawelo-idle-497`) opened into develop. Adds `scripts/dev-behind-develop.ts` + `.github/workflows/dev-behind-develop.yml` (daily 01:17 UTC; reads dev sync `/health`, which is public, so no secret or environment) and `workflow_dispatch` on deploy-dev (`test` gated to develop). Tests written red first; 7 mutants caught. Laptop: unit 13,655 pass; lint, typecheck, Prettier pass. #497 set In Progress; AC4 reasoning commented on #497.
- CI on #892 was still running when written (board-orphans, build-and-test, coverage).

## Resume steps

1. **#892:** `~/.claude/scripts/pr-verdict.sh 892` (background); read each job by name on the head SHA; when green, squash-merge into develop (`--match-head-commit "$(git -C ../yawelo-idle-497 rev-parse HEAD)"`).
2. **#497 after merge:** read deploy-dev's run on the merge commit. Then AC2 on GitHub: `gh workflow run dev-behind-develop.yml --ref develop -f stand_in_served=<an older develop sha>`, see it red and the alert issue opened assigned to ShydenMcM; check whether board-orphans goes red with the unboarded alert issue (unmeasured; PR #892 body states it as fact, correct it if wrong); shut the alert issue; dispatch once with no input and see it green. Also prove AC3: `gh workflow run deploy-dev.yml --ref develop` runs all jobs. Then shut the ticket by hand with the evidence.
3. **#888:** read each later develop deploy-dev run; shut after 2026-11-20 with the tally.
4. Then by board: #783 (P0) waits for the next release cut (Shyden, 2026-11-05); P2 Todo by age: #513, #864, #890.

## Waiting on Shyden

- **Old worktrees:** he can run: `cd ~/Developer/Repos/yawelo-idle && for w in 36 728b 761 752 794 728-probe 883 863 873 591 871 874 888; do git worktree remove ../yawelo-idle-$w; done` (none hold uncommitted work; the probe's files are `stash@{0}`).
- **Test board 6 (`PVT_kwDOEOcG584BpujW`):** he deletes it in GitHub (project 6 → Settings → Delete project).
- #784 next steps (Gmail, Cloudflare, domains); the ETA confidence rule; voyage map layout (#328/#331/#452); #655 SonarCloud project and `SONAR_TOKEN`; #858 where it goes; #830 copy approval.
- Open PRs with no recent movement: #602 (Stryker runner release), #745, #767, Dependabot #593, #594, #597, #750, #763, #764, #779, #834.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Worktrees: `-497` (PR #892, node_modules installed), `-dev-scripts`, and the thirteen above.
- Kept local branches: nine `backup/*`, and `tooling/785-nvmrc-exact` `-b`, `-c` and `-d`.

## Progress (board, measured 2026-11-06)

- By tickets: 41% (186 of 451). Pace 5.86 a day over 7 days to 2026-11-05. ETA 2026-12-22, medium confidence (6 of 7 days moved).
- By effort: 1,161 points remaining across 265 open stories. Pace 16.71 a day. ETA 2027-01-15, medium confidence.
- Both before the outside waits: #784's login and device sign-off.
