# Handover: Yawelo Idle

**Written:** 2026-11-12 06:32 WIB (seventy-second session, `yawelo-idle-d4`). Nothing runs locally. Colima stopped, no claims. **Phones:** none needed. Waiting on CI for PR #959.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- **Merged #954** (#784 AC6 door check) as `49d7296c24036cdc6592b138eaced9b8254ebe34`.
- **#467 closed:** 15 Indonesian strings read back by Google, table on #467. Shyden: the dev banner changes (filed **#957**, P3, 1 pt); the tagline stays as it is.
- **#958 filed (P0, In Progress):** PR #955's `sonar-coverage` failed in `tests/integration/google-ledger.test.ts:51`, because the test assumed the first run takes the lock (run 43117032183). Reading the code also showed the lock was created empty and then filled, so another run could remove it while live. Fix: **PR #959**, branch `fix/958-ledger-lock-race`, head `9a94f9dcfbfae5705dc0e75baa33a9228b7f01d8`, worktree `../yawelo-idle-958`. The lock is written to a private file and linked into place. The integration test now accepts either order. 6 unit tests, red first; 3 mutants killed; local unit suite: 14119 passed.
- Road to Launch page republished (v32, 06:30 WIB).

## Resume steps

1. **PR #959:** `~/.claude/scripts/pr-verdict.sh 959`. Merge when green (`--match-head-commit` from a file). Then close #958 by hand, once its AC1 is shown passing in the CI log.
2. **PR #955 (#942):** `gh pr update-branch 955`, then merge when green. Read the `Print Node's ICU and CLDR versions (#942)` line in develop's build-and-test log, record it on #942 AC4 and close #942.
3. **Dependabot #949, #950, #951:** one at a time, `gh pr update-branch` each, then merge it when green. #951 (Playwright 1.65.0) also needs the CI container image tag and digest bumped; worktree `../yawelo-idle-951`.
4. **#957:** the dev banner wording (test first).
5. **PARKED until 2026-11-15:** #784 go-live (account, keys, `production` secrets, `door-cron` environment, CI to workers.dev, door-host guard AC1b, daily dispatch of `door-check.yml`).

## Waiting on Shyden

- **#106 and #107 scope**, the Sonar exclusion of `docker/node/Dockerfile` (S6471), **#717** alert channel, and the older items: stray `~/Developer/Repos/scratch-928-*`/`scratch-ho-*` logs; #830 roadmap text; Sparked Host ticket #073955; Epic #6 close; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- `origin/develop` at `49d7296c24036cdc6592b138eaced9b8254ebe34`.
- Worktrees: `-dev-scripts` (detached), `-784` (`feat/784-door-check`, merged: can be removed), `-942` (`ci/942-print-icu`), `-951`, `-958` (`fix/958-ledger-lock-race`).
