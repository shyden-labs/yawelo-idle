# Handover: Yawelo Idle

**Written:** 2026-11-13 14:58 WIB (session `yawelo-idle-68`, continued). Colima not used. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- **New global rule** (Shyden): anything can deploy to dev at any time (`~/.claude/CLAUDE.md` Supply Chain; reference-supply-chain.md). Every peer session was told.
- **#961** closed: `dev` and `board-read` environments set to No restriction in Shyden's Chrome (read back); PR #962 merged as `ef366e57` (deploy-dev deploys any branch started by hand; a `pull_request_target` job may name no environment). Branch deploy run 43386209090 green.
- **#933** reopened, P0: AC4's "every assertion kept" was a line count, not proof. ACs 6–9 added (count assertions in CI both sides, map each one).
- Repeated-journeys audit (repo-template's request): nothing new since #933.

## In flight

- **#933**, branch `933-assertion-counts` (`8a6d9ab6`, worktree `../yawelo-idle-933`): counters (`tests/assertion-counts-reporter.ts`, `tests/vitest-assertion-counts*.ts`) wired into web/site/engines Playwright and the integration config. No PR yet.
- Measuring branch `933-before-934` (`3b2b1175`, worktree `../yawelo-idle-933-before`): the 5 files from `e18f890a`. **Never merge it**; delete it after measuring.
- deploy-dev dispatched on both branches, one after the other (a background watcher, DEAD after `/clear`; re-read with `gh run list -R shyden-labs/yawelo-idle --workflow deploy-dev.yml -L 4`).

## Resume steps

1. Pull counts from both runs: `gh run view <id> -R shyden-labs/yawelo-idle --log`, the lines after `Assertions per test (#933):` per job (build-and-test for integration, smoke, site-smoke).
2. Map every pre-#934 assertion to its home now; post counts, mapping and run links on #933. A missing one: ticket, restore with a failing test first.
3. Then the width rule (2026-11-13): `tests/site/roadmap.spec.ts` "fits 320 px wide" repeats the open-map + press-island journey; make the width a step inside "pressing islands", with before/after counts.
4. Open the #933 PR, merge on green, delete `933-before-934` and both worktrees.
5. **#957 AC3:** Shyden types the dev password in the Yawelo Chrome tab (`dev.yawelo-idle.shyden.co.uk/id/`, Browser `df91d304`); then check `COPY.id.devStrip` and close.
6. **PARKED until 2026-11-15:** #784 go-live.

## Waiting on Shyden

- #957 dev password in the Yawelo tab; #106/#107 scope; Sonar exclusion of `docker/node/Dockerfile` (S6471); #717 alert channel; stray `~/Developer/Repos/scratch-928-*`/`scratch-ho-*` logs; #830 roadmap text; Sparked Host ticket #073955; Epic #6 close; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). `origin/develop` at `ef366e576b6f550cdb4caaf432218a25825212b2`.
- Worktrees: `-dev-scripts` (detached), `-933`, `-933-before`. `-961` can be removed.
