# Handover: Yawelo Idle

**Written:** 2026-11-10 06:19 WIB (sixty-third session; a peer relayed Shyden's "continue"). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. It names #783, which cannot close before the release cut (Shyden, 2026-11-05), so go to step 1.

## Done this session

- Pushed PR #938's coverage fix (`feat/784-site-knows-its-door`, `a7411b2f6fa36c58afa4d8b22f5b6b6a20f208e3`, worktree `../yawelo-idle-784`). At 06:19: board-orphans, build-and-test and coverage pass; sonar-coverage pending.
- Pushed #638 and opened **PR #939** (`feat/638-google-read-back`, `c56915c7fe5c84fbd2205442ba6d919451e0229b`, worktree `../yawelo-idle-655`). At 06:19: build-and-test and sonar-coverage pending.
- Dev deploy of `c35bb583` (door Worker) green.
- **Clean-up done** (recorded; pass log in `~/.claude/global-rules/reference/reference-cleanup.md`): 2 worktrees, 43 local and 4 remote branches, PR #602 closed (Shyden approved), 15 obsolete memories, 230 MB of closed-ticket scratch. Branch tips saved in `.superpowers/cleanup/`.

## Running

- Local `gh pr checks --watch` waiters for #938 and #939: DEAD after `/clear`. Re-run: `gh pr checks 938 --watch --required` (and 939).

## Resume steps

1. **Merge on green heads:** #938 (head `a7411b2f…`) and #939 (head `c56915c7…`), squash into `develop` with every commit's reasons in the message. If SonarCloud refuses #939's new-code coverage, add unit tests (red first), not exemptions. After #938 merges, remove worktree `../yawelo-idle-784` and its branch; after #939, `../yawelo-idle-655`. Re-score #467's Estimate once #638 merges.
2. **#784 remaining, door side (failing tests first):**
   - Origins refuse a request without their door secret (use `doorOf`, PR #938). Turns on only at the 2026-11-15 cutover, with `DOOR_SECRET` set by the deploy; `HOLDING_HOST` retires then.
   - CI job: the real door in front of the real Workers under `wrangler dev`, WebSocket upgrade included (Yawelo does use WebSockets: `VoyageMap.svelte:46` → `roadmap.ts:301`).
   - Move CI to `workers.dev` (`deploy-dev.yml`, `dev-behind-develop.yml`, tests naming a door address), retire `scripts/verify-dev-hosts.ts`, then add the door-host guard over `tests/`, `scripts/`, `.github/` (AC1b).
   - Door deploy step (production environment only) and the daily request/error check (AC6). Reword AC2–AC5 to Shyden's rulings.
3. **PARKED until 2026-11-15:** the non-PROD account (Cloudflare's 7-day rule). Then AC1(d) keys, AC2 and the cutover. P1 #425, #426, #457, #759 follow.
4. **M2 chain:** after #638, #467, #104, #102.
5. **#655 AC5** on the next Dependabot PR; **#793 AC6** on Dependabot's docker PR; **#888** shut after 2026-11-20; **#864** watch site-smoke until 2026-11-19; **#930** asks first (induced swap slows peers).
6. When #784 lands, message the shyden.co.uk session.

## Waiting on Shyden

- **#830:** approve the roadmap text on the ticket, and whether "launch" means the first public opening.
- **#784:** Sparked Host ticket #073955 can be closed. Click Create Account from 2026-11-15.
- **Epic #6** (18 of 18 sub-issues closed): closing it triggers the milestone re-score, and moving ticket levels is his.
- Optional: mark S9382 Accepted in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only, local, ahead of origin).
- `origin/develop` at `c35bb583dcb8d6d19669e59aa667d873401faf59`.
- Worktrees: `-dev-scripts` (detached), `-655` (#939), `-784` (#938).
- Open PRs: #938, #939.
