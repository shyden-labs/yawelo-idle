# Handover: Yawelo Idle

**Written:** 2026-11-10 14:35 WIB (sixty-fourth session; Shyden: "continue"). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. It names #783, which cannot close before the release cut (Shyden, 2026-11-05), so go to step 1.

## Done this session

- **PR #941 merged** (`7f71c2b72697d2058b63d7870287ea3ef39a47af`): the holding page's dev copy is behind its door. `apps/site/worker/holding.ts` (`serveHolding` -> `behindDoor`, Node-readable types) runs before its files; `apps/site/holding-dev/wrangler.jsonc` has `main`, `workers_dev: true`, `DOOR_REQUIRED: "false"`. Door harness: 6 holding cases (refusals red on `b2e9b35a`, run 42769277622); unit test `apps/site/worker/holding.test.ts` (mutated once). Sonar needed the unit test (0% new coverage without it: harness coverage never reaches Sonar).
- deploy-dev run 42773374986 green on every job. Live: `yawelo-idle-holding-dev.shyden-labs-dev.workers.dev/` 200 (holding page), `dev-holding.yawelo-idle.shyden.co.uk/` 200.
- **#942 filed** (P2, 3 points, blocks #793): move Node's Docker pin out of `.github/` (shyden.co.uk's Dependabot 400 on that path); Yawelo's 2026-11-07 run only skipped 26.13.0 on cooldown, so the 400 is unproven here.
- #784 back to Todo (no branch or PR names it); progress comment posted. Worktree `-784` and its branch removed.
- Progress page republished (v26, 14:35 WIB).

## Running

- Nothing.

## Resume steps

1. **#784 remaining (failing tests first):**
   - Move CI to `workers.dev` (`deploy-dev.yml`, `dev-behind-develop.yml`, tests naming a door address) with the door secret, retire `scripts/verify-dev-hosts.ts`, then add the door-host guard over `tests/`, `scripts/`, `.github/` (AC1b). At the go-live GitHub's webhook must target the door.
   - Door deploy step (production environment only), the daily request/error check (AC6), reword AC2-AC5 to the rulings.
2. **#942** (P2): move the pin to `docker/node/Dockerfile`, 17 tracked files name `.github/node`; then 26.13.0.
3. **PARKED until 2026-11-15:** the non-PROD account, then AC1(d) keys, AC2 and the go-live (`DOOR_REQUIRED` "true" + `DOOR_SECRET` by the deploy, holding-dev included). P1 #425, #426, #457, #759 follow.
4. **M2 chain:** #467 (AC5/AC6: read back every Indonesian string with `scripts/google-read-back.ts`; writer/reader table on the issue), then #104, #102.
5. **#655 AC5** on the next Dependabot PR; **#793 AC6** after #942; **#888** shut after 2026-11-20; **#864** watch site-smoke until 2026-11-19; **#930** asks first.
6. When #784 lands, message the shyden.co.uk session.

## Waiting on Shyden

- **Stray logs:** `~/Developer/Repos/scratch-928-*` and `scratch-ho-*` (Yawelo's, from #928, nothing of value); my delete was refused. If wanted: `! rm ~/Developer/Repos/scratch-928-* ~/Developer/Repos/scratch-ho-*`.
- **#830:** approve the roadmap text on the ticket, and whether "launch" means the first public opening.
- **#784:** Sparked Host ticket #073955 can be closed. Click Create Account from 2026-11-15.
- **Epic #6** (18 of 18 sub-issues closed): closing it triggers the milestone re-score, and moving ticket levels is his.
- Optional: mark S9382 (await in a loop, by design) Accepted in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only, ahead of origin).
- `origin/develop` at `7f71c2b72697d2058b63d7870287ea3ef39a47af`.
- Worktrees: `-dev-scripts` (detached at develop).
- Open PRs: none.
