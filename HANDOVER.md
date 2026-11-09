# Handover: Yawelo Idle

**Written:** 2026-11-10 02:10 WIB (laptop shutting down) (sixty-second session, working overnight while Shyden sleeps; a peer session relayed his request to keep going by Priority and park anything needing him). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. It names #783, which cannot close before the release cut (Shyden, 2026-11-05), so go to step 1.

## Done this session

- **PR #937** (`feat/784-door-worker`, head `0f05e0825ecaf6789bb1d30884543a701e1632e6`, worktree `../yawelo-idle-784`): the door Worker `apps/door` (`yawelo-idle-door`, bindingless, Custom Domains on `dev.`, `dev-api.`, `dev-holding.`, `test.` yaweloidle.com) and the AC1(c) config pin `tests/unit/door-config.test.ts`. Red first; 15 one-off mutations each broke a test; full unit suite 13,906/13,906 locally; every required check green on the head, all 30 build-and-test steps succeeded. **Merged** into `develop` as `c35bb583dcb8d6d19669e59aa667d873401faf59`.
- **PR #938** (`feat/784-site-knows-its-door`, head `2944a64928fb815b82b403754abf7d5b42602763`, worktree `../yawelo-idle-784`): `doorOf` in `apps/door/worker/origin.ts` (door named only with the origin's own secret, SHA-256 digests compared in constant time) and the dev site's holding choice by door (`HOLDING_DOOR`). Nothing refused before the cutover. Unit green; 10 mutations killed. CI: SonarCloud refused it at 72.7% new-code coverage (floor 80): the page choice sat in the Worker entry, which only the CI harness drives. Fix committed LOCALLY as `a7411b2f6fa36c58afa4d8b22f5b6b6a20f208e3` (`pagesFor` in routes.ts, unit-tested, 2 mutations killed; format, typecheck, unit 13,923 green) but NOT pushed: GitHub's branch is still `2944a649`.
- **#638 committed LOCALLY, not pushed, no PR** (`feat/638-google-read-back`, `c56915c7fe5c84fbd2205442ba6d919451e0229b`, worktree `../yawelo-idle-655`): `scripts/google-read-back.ts` (the one Google caller) and `scripts/google-ledger.ts` (lock, re-reading ledger, atomic writes, day-limit raises), caller guard (guards suite) and a two-runs-at-once integration test. Red first; 27 mutations killed; format, lint, typecheck, unit 13,960 green. PR body ready in the session scratchpad only, so re-draft from the commit message. #467 re-scoped on the ticket (AC6); its Estimate needs re-scoring once #638 merges.
- **Correction on #784:** Yawelo DOES use WebSockets (the live roadmap: `VoyageMap.svelte:46` → `roadmap.ts:301`). The previous handover's "none found" was wrong; the door passes upgrades through, and the `wrangler dev` door check must prove it.

## Running

- **Nothing local.** DEAD: both pushes, stopped by Claude Code for low memory at 02:00 WIB. Re-run: `git -C ../yawelo-idle-784 push` and `git -C ../yawelo-idle-655 push -u origin feat/638-google-read-back`.
- **Remote:** PR #938's CI finished on `2944a649` (sonarcloud failed, the rest passed); nothing else is in progress. This handover commit (`git rev-parse HEAD` on `handover/2026-10-17-d`) is local only: push it with the two branches. (Note: `pr-verdict.sh` returned three times while checks were still running; `gh pr checks <n> --watch --required` waited correctly.)

## Resume steps

1. **Push both branches** once memory allows: `git -C ../yawelo-idle-784 push` (then watch #938's checks with `gh pr checks 938 --watch --required` and squash-merge on a green head), and `git -C ../yawelo-idle-655 push -u origin feat/638-google-read-back`, then open its PR into `develop` with `Refs #638`. Also confirm the dev deploy of `c35bb583` went green.
2. **#784 remaining, door side (failing tests first):**
   - Origins refuse a request without their door secret (use `doorOf`, PR #938). Turns on only at the 2026-11-15 cutover, with `DOOR_SECRET` set by the deploy; `HOLDING_HOST` retires then.
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
- `origin/develop` at `c35bb583dcb8d6d19669e59aa667d873401faf59` when this was written.
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-655` (detached at develop), `-784` (merged branch `feat/784-door-worker`, removable).
- Open PRs: #602 (Stryker, waits for a runner release).
