# Handover: Yawelo Idle

**Written:** 2026-11-11 14:12 WIB (seventy-first session, `yawelo-idle-70`). Nothing runs locally. No Colima or device claim held. **Phones:** none needed. Three PRs wait on GitHub CI only.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. board-next names #783 (P0), which waits on the next release cut: nothing to do there now.

## Done this session

- **Merged:** Dependabot #948 into develop as `0f6f67e5d252cd2ab0f7ca9da2fbd66c866a6aa3`.
- **PR #954 (#784 AC6 door check):** Sonar gate failed on new-code coverage (75.6% < 80, all in `scripts/door-check.ts`). Commit `9299ff32`: the entry block became an exported `main(env, deps)` returning the exit code; 12 tests added (main red first; 5 mutants each killed). Develop merged in; head `2f1bfb88`, pushed. Local unit run: 14113 passed.
- **#949** updated from develop (CI running). **#955** CI still running from 14:01 WIB.
- Road to Launch page republished (v30, 14:10 WIB).

## Resume steps

1. **PR #955:** `~/.claude/scripts/pr-verdict.sh 955`. When it's green, merge (`--match-head-commit` from a file). Then read the `Print Node's ICU and CLDR versions (#942)` line in the develop run's build-and-test log, record it on #942 AC4 and close #942 by hand.
2. **PR #954:** the same check (head `2f1bfb88`). Confirm SonarCloud passes now. Merge when it's green with the head containing develop (run `gh pr update-branch 954` first if #955 or #949 landed in the meantime).
3. **Dependabot #949, then #950, #951:** merge #949 when green (already updated from develop), then `gh pr update-branch` the next one, one at a time. #951 (Playwright 1.65.0) also has to bump the CI container image tag and digest (supply-chain test); worktree `../yawelo-idle-951`.
4. **#467:** Google's allowance resets 15:00 WIB. Read back 15 Indonesian strings: `apps/site/src/copy.ts` (`COPY.id` less "Yawelo Idle", and `LEGAL.id`) and `packages/ui/src/Shell.svelte`'s `lang="id"` section, as a JSON array into `node scripts/google-read-back.ts id en < texts.json`.
5. **PARKED until 2026-11-15:** #784 go-live (account, keys, `production` secrets, `door-cron` environment, CI to workers.dev, door-host guard AC1b, daily dispatch of `door-check.yml`).

## Waiting on Shyden

- **#106 and #107 scope**, the Sonar exclusion of `docker/node/Dockerfile` (S6471), **#717** alert channel, and the older items: stray `~/Developer/Repos/scratch-928-*`/`scratch-ho-*` logs; #830 roadmap text; Sparked Host ticket #073955; Epic #6 close; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- `origin/develop` at `0f6f67e5d252cd2ab0f7ca9da2fbd66c866a6aa3`.
- Worktrees: `-dev-scripts` (detached), `-784` (on `feat/784-door-check`), `-942` (`ci/942-print-icu`), `-951`.
