# Handover: Yawelo Idle

**Written:** 2026-11-16 00:15 WIB (session `yawelo-idle-f6`). Colima not used. **Shyden is AFK, possibly for days**: keep going without him.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## In flight

- **Ticket 128 (UI store, P3) on PR 982**, branch `128-ui-store`, worktree `../yawelo-idle-128`, head `7e641056` (pushed; read from `git rev-parse` at writing). Board: In Progress. Red tag `evidence/128-red` pushed. CI was running at writing (board-orphans green; build-and-test and sonarcloud in progress).
- Beyond the ACs: a visible page commits a `resume` every `COMMIT_MS` (60 s), or a window open past the 24 h offline cap stops earning (tests seen red first).
- The browser-side hidden-page measurement is #154 AC3 (depends on 128); the store is mounted on no page until #130.
- Evidence in `../yawelo-idle-128/.superpowers/sdd/128/` (git-ignored): red log, mutation scripts, sampled unit log.

## Resume steps

1. `~/.claude/scripts/pr-verdict.sh 982` (it can return while in progress: re-read). Green on the head SHA, steps read by name: squash-merge into `develop`, verify the dev deploy, read every AC against the merged code, then shut ticket 128 by hand with `gh issue close`. Red: find the cause.
2. Ticket 128 has no screen, so no Website story; say so on the ticket when shutting it.
3. Next: unblocked P3s #127, #162 (#125 needs Shyden's region colours). #160 follows #158 and #159.
4. **#784**: needs Shyden's click on Create Account (memory `project-non-prod-account-parked-until-11-15`).
5. **#971**: measured 2026-11-16 (comment 6898111619): 2 timeouts at load 41 with 8.4 GB swap; next, time-stamp each test's end beside the sampler.

## Waiting on Shyden (AFK)

- #830 reading of the Indonesian; #102's CC BY-NC-SA 4.0 for UI strings; #106/#107 scope; #109's two readings (AC2, AC5); Sonar exclusion of `docker/node/Dockerfile` (S6471); Sparked Host ticket #073955; S9382 in SonarCloud; #784 Create Account; #125 region colours.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). `origin/develop` at `2dfdddab`.
- Worktrees: `-dev-scripts` (detached at origin/develop), `-128` (branch `128-ui-store`). No local job running.
- Progress page: version 49 (2026-11-16 00:15 WIB).
