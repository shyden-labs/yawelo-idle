# Handover: Yawelo Idle

**Written:** 2026-11-13 18:20 WIB (session `yawelo-idle-a0`). Colima not used. **Phones:** none needed (a peer relayed "both devices plugged in"; nothing here uses them).

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- **New global rule** (Shyden): anything can deploy to dev at any time (`~/.claude/CLAUDE.md` Supply Chain; reference-supply-chain.md). Every peer session was told.
- **#961** closed: `dev` and `board-read` environments set to No restriction in Shyden's Chrome (read back); PR #962 merged as `ef366e57` (deploy-dev deploys any branch started by hand; a `pull_request_target` job may name no environment). Branch deploy run 43386209090 green.
- **#933** reopened, P0: AC4's "every assertion kept" was a line count, not proof. ACs 6–9 added (count assertions in CI both sides, map each one).
- Repeated-journeys audit (repo-template's request): nothing new since #933.

## In flight

- **#933**, branch `933-assertion-counts`, worktree `../yawelo-idle-933`, pushed head `6a4116d3`. No PR yet.
- **Before/after mapping DONE** and posted on #933 (comment 6851186490): every pre-#934 assertion is kept. The 23 fewer runtime assertions are all setup that now runs once per journey: `openMap()` 2×(14→5) = 18, and `conflicted()`'s merge check 6→1 = 5.
- deploy-dev run **43415406638** on `6a4116d3` (the width fold) was dispatched at 18:15 WIB. Dispatch nothing else on dev until it finishes.

## Resume steps

1. `gh run view 43415406638 -R shyden-labs/yawelo-idle`. When it is done, save `--log` to the scratchpad and pull the site-smoke `Assertions per test (#933):` block. Expected roadmap result: "pressing islands" goes 12→14, "fits 320 px" is gone (−3), so the roadmap total is 36−1 = 35, because one `openMap` call (2 assertions) disappears and the overflow check (1) moves into the journey. Post the figures on #933.
2. Open the #933 PR (`Refs #933`) and merge it once green on its headRefOid. Then delete branch `933-before-934` and both worktrees (`-933`, `-933-before`), and check ACs 6–9 before closing #933 by hand.
3. **#957 AC3:** Shyden types the dev password in the Yawelo Chrome tab (`dev.yawelo-idle.shyden.co.uk/id/`). Then check `COPY.id.devStrip` and close.
4. **#830:** Indonesian translation with Google read-back, then implement (approved 2026-11-13).
5. **PARKED until 2026-11-15:** #784 go-live.

## Decided by Shyden 2026-11-13 15:35 WIB

- **#830** draft approved as written: next, Indonesian translation with Google read-back, then implement.
- **#717**: read-only daily Cloudflare cron reading the public run list, emailing support@yaweloidle.com; no GitHub key in Cloudflare.
- **Epic #6** closed (18/18). Stray `scratch-928-*`/`scratch-ho-*` logs deleted.

## Waiting on Shyden

- #957 dev password in the Yawelo tab; #106/#107 scope; Sonar exclusion of `docker/node/Dockerfile` (S6471); Sparked Host ticket #073955; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). `origin/develop` at `ef366e576b6f550cdb4caaf432218a25825212b2`.
- Worktrees: `-dev-scripts` (detached), `-933`, `-933-before`. `-961` can be removed.
