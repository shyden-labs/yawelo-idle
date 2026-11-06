# Handover: Yawelo Idle

**Written:** 2026-11-06 (fiftieth session, ended for a settings restart that Shyden asked for). **Running when written:** nothing. No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session (fiftieth)

- **#888:** deploy-dev run 42187221974 on `8abd54f6` (#889's merge) passed all 9 jobs; recorded on #888 (AC 3 tally: 1 deploy read, 0 resets). #888 stays open until 2026-11-20.
- **#497:** Shyden, 2026-11-06: yes, run the daily dev-behind-develop check (asked with its cost; recorded on #497).
- Worktree `../yawelo-idle-497` on branch `ci/497-dev-behind-develop` from develop `8abd54f6`. Nothing written there yet, nothing pushed, #497 still Todo on the board (set In Progress only once the branch is pushed).

## Resume steps

1. **#497, TDD.** Survey done so far: no workflow has a `schedule:` yet. `deploy-dev.yml` triggers on `push: develop` only. The served commit is read by `scripts/verify-dev.ts` (the `yawelo-idle-commit` meta tag behind the dev password; the sync API's `/health` returns `commit`). Its verify jobs use environment `dev` with `DEV_BASIC_AUTH_PASSWORD`. Existing workflow tests to extend: `tests/unit/scheduled-workflows.ts` (+ `.test.ts`), `workflow-secrets.ts`, `workflow-steps.ts`, `workflow-timeouts.ts`, `workflow-runners.ts`, `prod-workflows.test.ts`. AC 4 wants the scheduled job's credential in its own environment allowing `develop` alone; creating that environment and its secret may be Shyden's (App permissions): check before asking. Red tests first for the comparison script (stand-in older commit → opens issue), the `workflow_dispatch` trigger restricted to `develop`, and the environment allow-list.
2. **#888:** read each later develop deploy-dev run; close after 2026-11-20 with the tally.
3. Then by board: #783 (P0) waits for the release cut; P2 Todo by age after #497: #513, #864, #890.

## Waiting on Shyden

- **Old worktrees:** he can run: `cd ~/Developer/Repos/yawelo-idle && for w in 36 728b 761 752 794 728-probe 883 863 873 591 871 874 888; do git worktree remove ../yawelo-idle-$w; done` (none hold uncommitted work; the probe's files are `stash@{0}`).
- **Test board 6 (`PVT_kwDOEOcG584BpujW`):** he deletes it in GitHub (project 6 → Settings → Delete project).
- #784 next steps (Gmail, Cloudflare, domains); the ETA confidence rule; voyage map layout (#328/#331/#452); #655 SonarCloud project and `SONAR_TOKEN`; #858 where it goes; #830 copy approval.
- Open PRs with no recent movement: #602 (Stryker runner release), #745, #767, Dependabot #593, #594, #597, #750, #763, #764, #779, #834.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Worktrees: `-497` (new, empty branch), `-dev-scripts`, and the thirteen above.
- Kept local branches: nine `backup/*`, and `tooling/785-nvmrc-exact` `-b`, `-c` and `-d`.

## Progress (board, measured 2026-11-06)

- By tickets: 41% (186 of 451). Pace 5.86 a day over 7 days to 2026-11-05. ETA 2026-12-22, medium confidence (6 of 7 days moved).
- By effort: 1,161 points remaining across 265 open stories. Pace 16.71 a day. ETA 2027-01-15, medium confidence.
- Both before the outside waits: #784's login and device sign-off.
