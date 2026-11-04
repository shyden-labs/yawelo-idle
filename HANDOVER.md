# Handover: Yawelo Idle

**Written:** 2026-11-05 (thirty-eighth session, overnight while Shyden sleeps). **Phones: connected but not authorised (Android unauthorized, iPhone untrusted); no device work.**
**Running when written:** CI on PR #861 (its branch was updated with develop, head `881c7c9a`) and PR #865. Local waiters die with the session.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. #783 waits on #762; skip it.

## Done this session

- **#850 closed:** PR #862 (squash `b6a1535f`) reads board and issue pages at once. On dev the edit-to-roadmap time went from 12.8-14.9 s to 8.1, 9.2 and 8.9 s (both tables are on #850).
- #589's ruling recorded (dev only, dev password; Estimate 3). Filed #863 and #864.
- deploy-dev run 41894579720 (#850's merge): `site-smoke` failed one Chromium test (no island within 5 s on `/roadmap`), cause unknown, so `dev-verified` was skipped. The same test passed in Firefox and WebKit; fresh loads probed afterwards drew in 1.5-2.9 s. #864 makes the next failure keep a screenshot.

## In flight

1. **#589 private Swagger, PR #861** (branch `docs/589-private-swagger`, worktree `../yawelo-idle-589`). The previous head `63a8e51e` was all green (coverage 85.2%). Read the verdict with `~/.claude/scripts/pr-verdict.sh 861`. Once green on the head SHA, squash-merge into `develop`. Then verify on dev at `https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev/api/private/docs`: with `DEV_PASSWORD` it should load, without it 401. Then close #589. Its deploy's `site-smoke` is also the next reading for #864.
2. **#864 site-smoke screenshots, PR #865** (branch `ci/864-site-smoke-traces`, worktree `../yawelo-idle-864`). No trace on purpose: it would carry the dev password into a public artifact. Merge when green; it stays open 14 days for AC3 (explain the miss if it recurs).

## Next

1. Finish 1-2 above, then `board-next`. The remaining unblocked P1 is #830 (needs Shyden's copy approval). #655 is parked until he's back (his SonarCloud login and token).
2. #863 (new, P2, 2 pts): harness test files count as untested coverage. Its first AC is Shyden's choice: (a) leave them out of the figure or (b) accept the cost.

## Waiting on Shyden

- **Ask on his return, one at a time (he said "tomorrow" 2026-11-04):** #784 next steps (Gmail, Cloudflare, domains); delete test board project 6; the ETA confidence rule; voyage map layout (#328/#331/#452).
- #655 SonarCloud: his SonarCloud project and `SONAR_TOKEN` (about 10 minutes in Chrome).
- #863 route (a)/(b). #858 placement ruling. #830 copy approval.
- **Open PRs with no recent movement:** #602 (Stryker, waits on a runner release), #745 (#728), #767 (#762), and Dependabot #593, #594, #597, #750, #763, #764, #779, #834 (re-run them; `ROADMAP_APP_KEY` exists now).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Worktrees: `-589` (PR #861), `-864` (PR #865), `-850` (merged; removable), plus older ones kept: `-36` (PR #602), `-728b` (PR #745), `-761` (PR #767), `-752`, `-794`, `-728-probe`. Ask before removing the older ones.
- Local branches kept: nine `backup/*` and `tooling/785-nvmrc-exact` `-b`/`-c`/`-d`.
- Scratch refs on origin (Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-05)

- By tickets: 38% (170 of 442), pace 4.29 a day, ETA 2027-01-07 (medium confidence: 5 of 7 days moved).
- By effort: 1,171 points remaining across 272 open stories, pace 12.00 a day, ETA 2027-02-10 (medium confidence). Both before outside waits (#784's login, device sign-off).
