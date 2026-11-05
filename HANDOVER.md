# Handover: Yawelo Idle

**Written:** 2026-11-05 (thirty-ninth session). **Phones: connected but not authorised (Android unauthorized, iPhone untrusted); no device work.**
**Running when written:** deploy-dev run 41938848585 (`676e25b8`) and CI on PR #878. Waiters die with this session: re-read them with `gh run view 41938848585` and `~/.claude/scripts/pr-verdict.sh 878`.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. Run board scripts from `../yawelo-idle-dev-scripts`.

## Done this session (thirty-ninth, 2026-11-05)

- **#875 closed:** PR #876 merged (squash `676e25b8`). Deploy run 41938848585 was green through dev-verified.
- **#872 merged** (squash `a6861970`, #871). #870 was moved onto it with `update-branch`; its CI was running when this was written.
- deploy-dev on `5c9db5e7` (#778's merge) was red. The cause was the stuck #873 card, which was fixed last session, so nothing new is wrong.
- **#464 licence check, PR #878** (branch `feat/464-licence-check`, worktree `../yawelo-idle-464`, head `3690cabe`). `npm run licences` judges all 805 packages and refuses none. The shipped tier comes from npm's `dev` flag, and the notices gain `swagger-ui-dist`, `@scarf/scarf` and `zod`. The ACs were trimmed under the cut list (reasons on #464). The ticket is In Progress. The code was first written before its tests. After Shyden's 2026-11-05 "it matters for every ticket always", it was rebuilt red→green; the evidence is in a comment on #878, and the global TDD rule now says so.

## In flight

1. Check the dev deploy for `a6861970` (dev-verified), then shut #871 by hand. Merge #870 when it is green on its head, check dev, and shut #591.
2. #878: merge when green, check dev, shut #464.
3. Then #874 (ts-fsrs 6), which builds on #872's `UNREAD_BY_TS_FSRS`.
4. A develop worktree for board scripts: `../yawelo-idle-dev-scripts` (detached at origin/develop; `git -C ../yawelo-idle-dev-scripts checkout --detach origin/develop` after a fetch).

## Next

1. `board-next` names #783 (Shyden's step). P1s all need Shyden (#830, #655, #784). P2s with no blocker include #402, #464, #497, #513, #523, #874.
2. #863: its first AC is Shyden's choice, (a) leave harness test files out of the figure or (b) accept the cost.

## Waiting on Shyden

- **Ask on his return, one at a time (he said "tomorrow" 2026-11-04):** #784 next steps (Gmail, Cloudflare, domains); delete test board project 6; the ETA confidence rule; voyage map layout (#328/#331/#452).
- #655 SonarCloud: his SonarCloud project and `SONAR_TOKEN` (about 10 minutes in Chrome).
- **#873 deepmerge route (P0):** (a) wait for a patched release, (b) override with a maintained drop-in, or (c) let #720's audit step pass that one GHSA with a reason and an expiry date.
- #863 route (a)/(b). #858 placement ruling. #830 copy approval.
- #783: open a test PR into `main` from any non-release branch, see `release-cut` refuse it, then close it (my hook refuses me opening one). Or accept seeing it at the next release cut.
- **Open PRs with no recent movement:** #602 (Stryker, waits on a runner release), #745 (#728), #767 (#762), and Dependabot #593, #594, #597, #750, #763, #764, #779, #834 (re-run them; `ROADMAP_APP_KEY` exists now).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Worktrees: `-591` (PR #870), `-871` (PR #872), `-464` (PR #878), `-dev-scripts` (detached develop for board scripts), plus older ones kept: `-36` (PR #602), `-728b` (PR #745), `-761` (PR #767), `-752`, `-794`, `-728-probe`. Ask before removing the older ones.
- Local branches kept: nine `backup/*` and `tooling/785-nvmrc-exact` `-b`/`-c`/`-d`.
- Scratch refs on origin (Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-05 from develop's finished-days script)

- By tickets: 39% (176 of 447), pace 5.14 a day over the 7 finished days to 2026-11-04, ETA 2026-12-28 (medium confidence: 6 of 7 days moved).
- By effort: 1,170 points remaining across 271 open stories, pace 14.00 a day, ETA 2027-01-28 (medium confidence). Both are before the outside waits (#784's login, device sign-off).
