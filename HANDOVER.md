# Handover: Yawelo Idle

**Written:** 2026-11-11 14:06 WIB (seventieth session, `yawelo-idle-70`). Nothing runs locally. No Colima or device claim held. **Phones:** none needed. Three PRs wait on GitHub CI only.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. board-next names #783 (P0), which waits on the next release cut: nothing to do there now.

## Done this session

- **Merged:** #943 (#784 door deploy) into develop as `1505373a206c0bfdf5585ca0b7dacb33b0d3b583`.
- **PR #954 opened** (#784 AC6 door check, `feat/784-door-check`, head `76665e5e`): develop merged in with conflicts resolved (develop's copy for the six files door-check never changed; `script-loads.test.ts` keeps its `door-check.ts` entry). Local unit run: 14101 passed.
- **PR #955 opened** (#942 AC4, `ci/942-print-icu`, head `98331a3d`): build-and-test prints `icu … cldr …` after setup-node (Shyden chose the CI print, 2026-11-11). Test red first, then green; local unit run: 14074 passed.
- **Dependabot #948** updated from develop; its CI is running.
- ShyDesk asked whether Yawelo uses no-reply@shyden.co.uk for SMTP: answered no (nothing in the code, the Worker config or the workflow secrets; the App can't list stored environment secrets).
- Removed merged worktrees -458, -715, -947. Road to Launch page republished (v29, 14:05 WIB).

## Resume steps

1. **PR #955:** `~/.claude/scripts/pr-verdict.sh 955`. When it's green, merge (`--match-head-commit` from a file). Then read the `Print Node's ICU and CLDR versions (#942)` line in the develop run's build-and-test log, record it on #942 AC4 and close #942 by hand.
2. **PR #954:** the same check. Merge when it's green with the head containing develop (run `gh pr update-branch 954` first if #955 or #948 landed in the meantime).
3. **Dependabot #948, then #949, #950, #951:** merge #948 when green, then `gh pr update-branch` the next one, one at a time. #951 (Playwright 1.65.0) also has to bump the CI container image tag and digest (supply-chain test); worktree `../yawelo-idle-951`.
4. **#467:** Google's allowance resets 15:00 WIB. Read back 15 Indonesian strings: `apps/site/src/copy.ts` (`COPY.id` less "Yawelo Idle", and `LEGAL.id`) and `packages/ui/src/Shell.svelte`'s `lang="id"` section, as a JSON array into `node scripts/google-read-back.ts id en < texts.json`.
5. **PARKED until 2026-11-15:** #784 go-live (account, keys, `production` secrets, `door-cron` environment, CI to workers.dev, door-host guard AC1b, daily dispatch of `door-check.yml`).

## Waiting on Shyden

- **#106 and #107 scope**, the Sonar exclusion of `docker/node/Dockerfile` (S6471), **#717** alert channel, and the older items: stray `~/Developer/Repos/scratch-928-*`/`scratch-ho-*` logs; #830 roadmap text; Sparked Host ticket #073955; Epic #6 close; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- `origin/develop` at `1505373a206c0bfdf5585ca0b7dacb33b0d3b583`.
- Worktrees: `-dev-scripts` (detached), `-784` (on `feat/784-door-check`), `-942` (`ci/942-print-icu`), `-951`.
