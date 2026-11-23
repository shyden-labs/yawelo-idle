# Handover: Yawelo Idle

**Written:** 2026-11-23 21:20 WIB, session `yawelo-idle-44`. Branch `handover/2026-10-17-d`. develop at d43bcbdc. Worktrees: `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-1081` (PR #1089), `yawelo-idle-1090` (PR #1091, draft), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim.

## Now

- **#1074 (P1, In Progress), PR #1088 (draft), worktree `../yawelo-idle-1074`, head `5322d65f` (pushed).** Worker half done: CI run 45162800654's build-and-test job passed, the two harness tests included. Page half done: "Last updated {date}, {time} {zone}" (`apps/site/src/roadmap/updated.ts`), zone name language-neutral per Shyden ("Local names where known", #1074 comment). **Blocked by #1093** (Sonar: 20.3% new coverage, roadmap.ts 28/28 uncovered because workerd suites are not measured; Shyden chose "Measure Worker tests too"). Also waits on #1092 (browsers job: Edge install timeout).
- **#1093 (P1, 8 pts, Todo):** Worker suites' coverage into Sonar. AC1 first: measure how a workerd Worker's statements can be counted while the harness (plain Vitest in Node, Worker separate) runs. Next ticket by priority after P0s.
- **#1092 (P2, 2 pts, Todo):** Edge install timed out at 3 min on PRs #1089, #1091, #1088. Shyden: cache browser installs between runs.
- **#1081 (P2, In Progress), PR #1089, head `05ac223b`:** all 5 required checks green (Sonar fixed by injectable `main(run)`). Shyden: wait for a green browsers run before merging (blocked in practice on #1092). AC3 (3 runs under load >100) still owed.
- **#1090 (P2, In Progress), PR #1091 (draft), head `5b685f93`:** check proven red on CI run 45161676075 (`apps/site/dist/support.html: shows support@yaweloidle.com`), plant reverted, Sonar gap (CLI block) covered. Read CI on `5b685f93` by step; un-draft and merge when green (browsers job likely hits #1092).
- All P0s wait on Shyden: #784, #425/#426/#1072, #860 and #1013 (next production release), #992–#1000 (playwright-devices#7).
- #971 got a repeat comment: 7 unit timeouts at load 137 / ~130 MB free; same files pass alone.

## For Shyden (parked questions)

1. #830 AC1: approve the roadmap page's new short text (latest #830 comment).
2. #860: approve the live ShyDesk ticket address `https://yaweloidle.com/support/ticket`.
3. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
4. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach at origin/develop first).
2. Read CI by step on PR #1091 (`5b685f93`) and #1088 (`5322d65f`): `gh run list --branch <branch>`; Sonar per-file via `curl "https://sonarcloud.io/api/measures/component_tree?component=shyden-labs_yawelo-idle&pullRequest=<n>&metricKeys=new_uncovered_lines,new_lines_to_cover&qualifiers=FIL"`.
3. Start #1092 (cache browser installs; small, unblocks three PRs) or #1093 per board-next.
4. Act on Shyden's answers above.
