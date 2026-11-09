# Handover: Yawelo Idle

**Written:** 2026-11-10 00:05 WIB (sixty-second session, working overnight while Shyden sleeps; a peer session relayed his request to keep going by Priority and park anything needing him). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. It names #783, which cannot close before the release cut (Shyden, 2026-11-05), so go to step 1.

## Done this session

- **PR #937** (`feat/784-door-worker`, head `0f05e0825ecaf6789bb1d30884543a701e1632e6`, worktree `../yawelo-idle-784`): the door Worker `apps/door` (`yawelo-idle-door`, bindingless, Custom Domains on `dev.`, `dev-api.`, `dev-holding.`, `test.` yaweloidle.com) and the AC1(c) config pin `tests/unit/door-config.test.ts`. Red first; 15 one-off mutations each broke a test; full unit suite 13,906/13,906 locally. CI was running when this was written.
- **Correction on #784:** Yawelo DOES use WebSockets (the live roadmap: `VoyageMap.svelte:46` → `roadmap.ts:301`). The previous handover's "none found" was wrong; the door passes upgrades through, and the `wrangler dev` door check must prove it.

## Running

- `~/.claude/scripts/pr-verdict.sh 937` in the background (dies with the session; re-run it).

## Resume steps

1. **PR #937:** read its CI verdict (`~/.claude/scripts/pr-verdict.sh 937`). Green on the head SHA → squash-merge into `develop`. Red → fix on the branch.
2. **#784 remaining, door side (failing tests first):**
   - Origins accept only their door secret (`x-yawelo-door-secret`, constants in `apps/door/worker/door.ts`), and the dev site picks the holding page from `x-yawelo-door` only with a valid secret, replacing `HOLDING_HOST` in `apps/site/worker/routes.ts`. The refusal turns on only at the 2026-11-15 cutover.
   - CI job: the real door in front of the real Workers under `wrangler dev`, WebSocket upgrade included (Shyden: same as ShyTalk).
   - Move CI to `workers.dev` (`deploy-dev.yml`, `dev-behind-develop.yml`, tests naming a door address), retire `scripts/verify-dev-hosts.ts`, then add the door-host guard over `tests/`, `scripts/`, `.github/` (AC1b).
   - Door deploy step (production environment only) and the daily request/error check (AC6). Reword AC2–AC5 to Shyden's rulings.
3. **Clean-up is due** (last run 2026-11-02): a self-paced `/loop` over `~/.claude/global-rules/reference/reference-cleanup.md`, then `~/.claude/scripts/cleanup-done.sh yawelo-idle`.
4. **PARKED until 2026-11-15:** the non-PROD account (Cloudflare's 7-day rule). Then AC1(d) keys, AC2 and the cutover. P1 #425, #426, #457, #759 follow.
5. **M2 chain:** start at #638 (Google read-back under the shared lock and ledger), then #467, #104, #102.
6. **#655 AC5** on the next Dependabot PR; **#793 AC6** on Dependabot's docker PR; **#888** shut after 2026-11-20; **#864** watch site-smoke until 2026-11-19; **#930** asks first (induced swap slows peers).
7. When #784 lands, message the shyden.co.uk session.

## Waiting on Shyden

- **#830:** approve the roadmap text on the ticket, and whether "launch" means the first public opening.
- **#784:** Sparked Host ticket #073955 can be closed. Click Create Account from 2026-11-15.
- **Epic #6** (18 of 18 sub-issues closed): closing it triggers the milestone re-score, and moving ticket levels is his.
- Optional: mark S9382 Accepted in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- `origin/develop` at `58034faae11bf9d9e4a5126e4e031dad24bc7693` when this was written.
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-655` (detached at develop), `-784` (PR #937's branch).
- Open PRs: #937 (doors), #602 (Stryker, waits for a runner release).
