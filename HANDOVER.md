# Handover: Yawelo Idle

**Written:** 2026-11-05 (thirty-eighth session, overnight while Shyden sleeps). **Phones: connected but not authorised (Android unauthorized, iPhone untrusted); no device work.**
**Running when written:** nothing local (laptop shutdown). CI may still be running on PR #872; its waiter is DEAD. Re-read with `~/.claude/scripts/pr-verdict.sh 872`.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. Run board scripts from a `develop` worktree: this handover branch's copies predate #575 and #772. board-next names #783 (P0): its code shipped in PR #809, and only a planted non-release PR into `main` remains, which is Shyden's (see below); then take the next ticket.

## Done this session

- **#850 closed:** PR #862 (squash `b6a1535f`) reads board and issue pages at once. On dev the edit-to-roadmap time went from 12.8-14.9 s to 8.1, 9.2 and 8.9 s (tables on #850).
- **#589 closed:** PR #861 (squash `7e800d8b`): `/api/private/docs` answers 401 without the dev password and 200 with it; production answers 404.
- **#575 closed:** PR #867 (`d872dff7`): the pace counts finished days only; verified on dev's `/api/roadmap.json`. etaDate now gives today when nothing remains.
- **#772 closed:** PR #866 (`bc4018a7`): board-next walks a blocked pick's chain. AC2 was amended to Shyden's 2026-10-13 "note, not a refusal".
- **#672 closed:** PR #868 (`3d2ab26b`): the dev hostname-adapter step is renamed, and the renamed step ran green on deploy.
- **#778 closed:** PR #869 (`5c9db5e7`): the Dependabot order check reads both offsets from one text. AC2-AC4 (an AST meta-guard) were dropped under the 2026-10-30 cut list; the reasons are on the ticket.
- **#864:** PR #865 (`789bb5e1`) merged; site-smoke now keeps screenshots of failures, with no trace. It stays open until 2026-11-19 (AC3 watch). Tally: 2 reds before, 0 since (three green deploys).
- Filed #863 (coverage counts harness test files; Shyden's route).
- #760 shut as not planned (the git-walks guard was deleted by #795).
- **Security, found and told to Shyden:** develop had 19 npm audit findings (2 high). #871 (P0) is in PR #872. Filed #873 (P0, deepmerge has no patched release; Shyden's route, and it blocks #720) and #874 (P2, ts-fsrs 6.0 upgrade).

## In flight (both RED, fix first)

1. **#871 audit fixes, PR #872** (branch `fix/871-audit-findings`, worktree `../yawelo-idle-871`, head `cd968102`). `board-orphans` failed at "No ticket is In Progress without a branch or open pull request" (run 41924164200). Its log names the ticket; suspects are tickets set In Progress this session. Fix that board status, then trigger a fresh run with `gh pr update-branch 872` (a re-run is not allowed). `build-and-test` had not reported when the session stopped. Merge when green, check dev-verified on the deploy, then shut the ticket by hand, noting that #873 holds the 3 lows.
2. **#591 fresh Worker types, PR #870** (branch `tooling/591-fresh-worker-types`, worktree `../yawelo-idle-591`, head `8474d01b`). RED: Guards failed `tests/guards/erasable-syntax.test.ts` "lists every tsconfig git has, each one the typecheck reads" (run 41922738170). That guard parses the root `typecheck` script, and the new `npm run --silent types && ` prefix breaks its parse. Coverage failed too, probably for the same reason. Fix: teach the guard to skip the prefix, or move the rebuild into `pretypecheck`/`prelint` npm hooks and pin those in tests/unit/worker-types.test.ts. The guards suite runs in CI only. Then merge and shut the ticket by hand (AC2 collapses into always-rebuild; AC3's floor is dropped under the cut list).

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
- Worktrees: `-591` (PR #870), `-871` (PR #872), plus older ones kept: `-36` (PR #602), `-728b` (PR #745), `-761` (PR #767), `-752`, `-794`, `-728-probe`. Ask before removing the older ones.
- Local branches kept: nine `backup/*` and `tooling/785-nvmrc-exact` `-b`/`-c`/`-d`.
- Scratch refs on origin (Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-05 from develop's finished-days script)

- By tickets: 40% (176 of 443), pace 4.29 a day over the 7 finished days to 2026-11-03, ETA 2027-01-06 (medium confidence: 5 of 7 days moved).
- By effort: 1,159 points remaining across 267 open stories, pace 12.00 a day, ETA 2027-02-09 (medium confidence). Both before outside waits (#784's login, device sign-off). Today's 6 closures enter the pace tomorrow.
