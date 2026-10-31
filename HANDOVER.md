# Handover: Yawelo Idle

**Written:** 2026-10-31, ~18:15 WIB (twenty-ninth session). **Running when written:** nothing local. CI on PR #808 (external).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` (expect #768, In Progress). Node: `~/.local/share/node/current/bin` (v26.12.1).

## Done this session

- **#768 code complete**: squashed into one commit `7dd8fd041566d3fabda298229e822f2d7d12a050` on `website/768-own-media-address` (worktree `../yawelo-idle-768`), pushed, **PR #808** into develop. Unit suite 12,568 passed locally; typecheck, lint, format clean.
- Dead "host sends no headers" support removed from `MediaHost` / `verify-prod`.
- AC5 as a plain check: `scripts/free-hosts.ts` + CI step "No built page loads from a free shared domain" (builds the holding page and its dev copy after the main build). Watched it fail once on a planted r2.dev address. Evidence on the ticket. `readBuild`'s tests are in `tests/guards/free-hosts-read.test.ts` (unit setup refuses tree walks), so only CI has run them.
- Board: #768 set In Progress.

## Resume steps (#768)

1. `~/.claude/scripts/pr-verdict.sh 808` in the background. Read every job by step name on head `7dd8fd04`, including the new guards test and the three new build-and-test steps. If red, add a fixing commit (no force-push), then squash-merge.
2. Green: squash-merge into develop; watch the dev deploy and its verify (dev-media files byte for byte, dev-holding reachable).
3. AC4 needs Shyden on Biznet with ordinary DNS: both `dev.yawelo-idle.shyden.co.uk` and `dev-holding.yawelo-idle.shyden.co.uk` play the video in Chrome (`networkState` not 3, `readyState` 4). Write the reading on the ticket.
4. Then Shyden turns off the old dev-account bucket and its r2.dev address; the ticket is then shut by hand.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Live worktree `../yawelo-idle-768` (#768, PR #808). Dead worktrees from before, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.
- Waiting on Shyden: #784 (Gmail and Cloudflare login for Yawelo), #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## Progress (board, measured 2026-10-31 18:10)

- By tickets: 36% (149 of 417), pace 1.29 a day, ETA 2027-05-28 (low confidence: 4 of 7 days closed nothing).
- By effort: 1,171 points remaining across 268 open stories, pace 3.14 a day, ETA 2027-11-08 (low confidence). Both before outside waits (#784's login, device sign-off, AC4 on Shyden's phone).
