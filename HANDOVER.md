# Handover: Yawelo Idle

**Written:** 2026-11-12 06:45 WIB (seventy-third session, `yawelo-idle-d4`). Nothing runs locally. Colima stopped, no claims. **Phones:** none needed. Waiting on CI for PRs #955 and #960.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- **Merged #959** (#958's ledger lock fix) as `58e0748cff01027b78f6758d4ed19cb7ea19d4c3`. **#958 closed** with the evidence on it: the integration test passed in build-and-test, coverage and sonar-coverage on the head.
- **PR #955 (#942):** branch updated; head `84733c5e3ad7711c15a588842476c12715c357b3`, CI running.
- **#957 (In Progress):** PR **#960**, branch `fix/957-id-dev-banner`, head `52856f4fff2a23828e493f1c60b47b94b4ef1fce`, worktree `../yawelo-idle-957`. New `apps/site/src/dev-strip.test.ts`, seen red on _sangat berbeda_ first; local unit suite 14115 passed. PR #960 is BEHIND develop (opened before #959's merge landed in its base).
- Worktrees `-784` and `-958` removed. Road to Launch page republished (v33, 06:44 WIB).

## Resume steps

1. **PR #955:** `~/.claude/scripts/pr-verdict.sh 955`; merge when green (`--match-head-commit` from a file). Read the `Print Node's ICU and CLDR versions (#942)` line in develop's build-and-test log, record it on #942 AC4, close #942.
2. **PR #960:** `gh pr update-branch 960` (after #955 merges), merge when green. After the dev deploy, check `/id/` on dev in a real browser (Yawelo Chrome profile) for #957 AC3, then close #957.
3. **Dependabot #949, #950, #951:** one at a time, `gh pr update-branch` each, merge when green. #951 (Playwright 1.65.0) also needs the CI container image tag and digest bumped; worktree `../yawelo-idle-951`.
4. **PARKED until 2026-11-15:** #784 go-live (account, keys, `production` secrets, `door-cron` environment, CI to workers.dev, door-host guard AC1b, daily dispatch of `door-check.yml`).

## Waiting on Shyden

- **#106 and #107 scope**, the Sonar exclusion of `docker/node/Dockerfile` (S6471), **#717** alert channel, and the older items: stray `~/Developer/Repos/scratch-928-*`/`scratch-ho-*` logs; #830 roadmap text; Sparked Host ticket #073955; Epic #6 close; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- `origin/develop` at `58e0748cff01027b78f6758d4ed19cb7ea19d4c3`.
- Worktrees: `-dev-scripts` (detached), `-942` (`ci/942-print-icu`), `-951`, `-957` (`fix/957-id-dev-banner`).
