# Handover: Yawelo Idle

**Written:** 2026-10-31, ~18:15 WIB (twenty-ninth session). **Running when written:** nothing local. CI on PR #808 (external).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` (expect #768, In Progress). Node: `~/.local/share/node/current/bin` (v26.12.1).

## Done this session

- **#768 merged**: PR #808 squash-merged into develop as `3b031ca245f4923674f37097f44233d2c713152f` after all 50 build-and-test steps (new guards test and "No built page loads from a free shared domain" included), board-orphans and coverage passed on head `7dd8fd04`.

## Resume steps (#768)

1. Dev deploy run 41193853222 on `3b031ca2` passed 100/100 steps (recorded on #768).
2. AC4 needs Shyden on Biznet with ordinary DNS: both `dev.yawelo-idle.shyden.co.uk` and `dev-holding.yawelo-idle.shyden.co.uk` play the video in Chrome (`networkState` not 3, `readyState` 4). Write the reading on the ticket.
3. Then Shyden turns off the old dev-account bucket and its r2.dev address; the ticket is then shut by hand.
4. Remove the `../yawelo-idle-768` worktree after a look (branch merged).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Live worktree `../yawelo-idle-768` (#768, PR #808). Dead worktrees from before, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.
- Waiting on Shyden: #784 (Gmail and Cloudflare login for Yawelo), #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## Progress (board, measured 2026-10-31 18:10)

- By tickets: 36% (149 of 417), pace 1.29 a day, ETA 2027-05-28 (low confidence: 4 of 7 days closed nothing).
- By effort: 1,171 points remaining across 268 open stories, pace 3.14 a day, ETA 2027-11-08 (low confidence). Both before outside waits (#784's login, device sign-off, AC4 on Shyden's phone).
