# Handover: Yawelo Idle

**Written:** 2026-11-10 09:35 WIB (sixty-third session; a peer relayed Shyden's "continue"). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. It names #783, which cannot close before the release cut (Shyden, 2026-11-05), so go to step 1.

## Done this session

- **Merged into develop:** PR #938 (`5fb0a9b4`, dev site picks the holding page by door), PR #939 (`40f14ce3`, Google read-back; **#638 closed**; #467 re-scored 5 -> 3), PR #940 (`96d04525458d4c9f848a6b9a660392377f0ec7ff`, origins refuse a request without their door secret, #784 AC4 origin side).
- **#940 in short:** `apps/door/worker/origin.ts` has `refusal`, `behindDoor`, `workerEqual`; sync and dev site Workers use them; `DOOR_REQUIRED: "false"` in `apps/sync-worker/wrangler.jsonc`, `wrangler.injected.jsonc`, `apps/site/wrangler.jsonc`, `wrangler.roadmap-test.jsonc` until the 2026-11-15 go-live. `apps/door/test/door-in-front.test.ts` (in `test:worker`): origins in one `createTestHarness`, the real door under `unstable_startWorker` with `outboundService` and `inferOriginFromRoutes: false`; 9 cases incl. the live roadmap WebSocket through the door. Worker tests step limit 1 -> 3 min (measured 36-44 s).
- **Clean-up done and recorded**; **Shyden 07:00:** wait until 2026-11-15; TEST not created early.
- **#784** moved In Progress -> Todo (no branch or PR names it now); progress comment posted.
- **Progress page republished** (v23, 09:31 WIB).
- Memories: `topic-gh-traps` (`gh pr checks --watch` returns early), `feedback-regenerate-worker-types-before-typecheck` (regenerate types and run the WHOLE typecheck before pushing).

## Running

- A local wait on develop's deploy-dev for `96d04525` (DEAD after `/clear`). Re-read: `gh run list --branch develop --workflow deploy-dev --limit 1`. It must be green; with DOOR_REQUIRED "false" nothing on dev changes.

## Resume steps

1. Confirm deploy-dev for `96d04525` is green. Then remove worktree `../yawelo-idle-784` (branch `feat/784-origins-need-the-door`, merged, clean) and its local branch.
2. **#784 remaining (failing tests first):**
   - `holding-dev` behind `dev-holding.`: today assets-only with `workers_dev: false`; it needs a Worker script asking `behindDoor` and a `workers.dev` address, plus a door-test case.
   - Move CI to `workers.dev` (`deploy-dev.yml`, `dev-behind-develop.yml`, tests naming a door address) with the door secret, retire `scripts/verify-dev-hosts.ts`, then add the door-host guard over `tests/`, `scripts/`, `.github/` (AC1b). At the go-live GitHub's webhook must target the door.
   - Door deploy step (production environment only), the daily request/error check (AC6), reword AC2-AC5 to the rulings.
3. **PARKED until 2026-11-15:** the non-PROD account, then AC1(d) keys, AC2 and the go-live (`DOOR_REQUIRED` "true" + `DOOR_SECRET` by the deploy). P1 #425, #426, #457, #759 follow.
4. **M2 chain:** #467 (AC5/AC6: read back every Indonesian string with `scripts/google-read-back.ts`; writer/reader table on the issue), then #104, #102.
5. **#655 AC5** on the next Dependabot PR; **#793 AC6** on Dependabot's docker PR; **#888** shut after 2026-11-20; **#864** watch site-smoke until 2026-11-19; **#930** asks first.
6. When #784 lands, message the shyden.co.uk session.

## Waiting on Shyden

- **#830:** approve the roadmap text on the ticket, and whether "launch" means the first public opening.
- **#784:** Sparked Host ticket #073955 can be closed. Click Create Account from 2026-11-15.
- **Epic #6** (18 of 18 sub-issues closed): closing it triggers the milestone re-score, and moving ticket levels is his.
- Optional: mark S9382 (await in a loop, by design) Accepted in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only, ahead of origin).
- `origin/develop` at `96d04525458d4c9f848a6b9a660392377f0ec7ff`.
- Worktrees: `-dev-scripts` (detached at develop), `-784` (merged branch, removable after step 1).
- Open PRs: none.
