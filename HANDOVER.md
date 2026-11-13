# Handover: Yawelo Idle

**Written:** 2026-11-13 15:40 WIB (session `yawelo-idle-68`, continued). Colima not used. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- **New global rule** (Shyden): anything can deploy to dev at any time (`~/.claude/CLAUDE.md` Supply Chain; reference-supply-chain.md). Every peer session was told.
- **#961** closed: `dev` and `board-read` environments set to No restriction in Shyden's Chrome (read back); PR #962 merged as `ef366e57` (deploy-dev deploys any branch started by hand; a `pull_request_target` job may name no environment). Branch deploy run 43386209090 green.
- **#933** reopened, P0: AC4's "every assertion kept" was a line count, not proof. ACs 6–9 added (count assertions in CI both sides, map each one).
- Repeated-journeys audit (repo-template's request): nothing new since #933.

## In flight

- **#933**, branch `933-assertion-counts`, worktree `../yawelo-idle-933`. Pushed head `6a4116d3` (on top of `8a6d9ab6`, counters wired into web/site/engines Playwright and integration); "fits 320 px wide" folded into "pressing islands" as its last step (prettier, eslint, `tsc -p tests/site` clean). No PR yet.
- Measuring branch `933-before-934` (`3b2b1175`, worktree `../yawelo-idle-933-before`): the 5 files from `e18f890a`. **Never merge it**; delete it after measuring. Dispatched: deploy-dev run **43391580634**, pending at 15:22 WIB.
- deploy-dev run **43389539517** on `933-assertion-counts` (`8a6d9ab6`) in progress at 15:22 WIB (build-and-test running). Dispatch nothing more until both finish: a second pending run in the concurrency group cancels the first.
- `6a4116d3` (width fold) **pushed**; unit suite 14131/14131 passed first (rc 0). Not yet deployed: dispatch it only after both measuring runs finish.

## Resume steps

1. `gh run list -R shyden-labs/yawelo-idle --workflow deploy-dev.yml -L 4`: wait for 43389539517 (after) and 43391580634 (before) to finish.
2. Pull counts from both runs: `gh run view <id> -R shyden-labs/yawelo-idle --log`, the lines after `Assertions per test (#933):` per job (build-and-test for integration, smoke, site-smoke).
3. Map every pre-#934 assertion to its home now; post counts, mapping and run links on #933. A missing one: ticket, restore with a failing test first.
4. Dispatch deploy-dev on `933-assertion-counts` (`6a4116d3`, already pushed) and record the site-smoke counts before/after the width fold (roadmap.spec "pressing islands" +2, "fits 320 px" test gone with its 2).
5. Open the #933 PR, merge on green, delete `933-before-934` and both worktrees.
6. **#957 AC3:** Shyden types the dev password in the Yawelo Chrome tab (`dev.yawelo-idle.shyden.co.uk/id/`, Browser `df91d304`); then check `COPY.id.devStrip` and close.
7. **PARKED until 2026-11-15:** #784 go-live.

## Decided by Shyden 2026-11-13 15:35 WIB

- **#830** draft approved as written: next, Indonesian translation with Google read-back, then implement.
- **#717**: read-only daily Cloudflare cron reading the public run list, emailing support@yaweloidle.com; no GitHub key in Cloudflare.
- **Epic #6** closed (18/18). Stray `scratch-928-*`/`scratch-ho-*` logs deleted.

## Waiting on Shyden

- #957 dev password in the Yawelo tab; #106/#107 scope; Sonar exclusion of `docker/node/Dockerfile` (S6471); Sparked Host ticket #073955; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). `origin/develop` at `ef366e576b6f550cdb4caaf432218a25825212b2`.
- Worktrees: `-dev-scripts` (detached), `-933`, `-933-before`. `-961` can be removed.
