# Handover: Yawelo Idle

**Written:** 2026-11-05 (thirty-eighth session, overnight while Shyden sleeps). **Phones: connected but not authorised (Android unauthorized, iPhone untrusted); no device work.**
**Running when written:** CI on PR #861 and PR #862 (GitHub had an Actions incident; runs queue slowly). Local waiters die with the session.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. #783 waits on #762; skip it.

## In flight

1. **#589 private Swagger, PR #861** (branch `docs/589-private-swagger`, worktree `../yawelo-idle-589`). Shyden ruled 2026-11-04 "Dev only, dev password"; ACs 3-4 rewritten and Estimate 3. First CI run failed: one test (moved into `routes-unread.test.ts`) and coverage at 84.8% (moved the judge to `apps/site/api/judge.ts` plus unit tests, about 85.3% expected). Read the verdict: `~/.claude/scripts/pr-verdict.sh 861`. Once green on the head SHA, squash-merge into `develop`. Then verify on dev at `https://yawelo-idle-site-dev.shyden-labs-dev.workers.dev/api/private/docs`: with `DEV_PASSWORD` it should load; without it, 401. Then close #589.
2. **#850 roadmap under 10 s, PR #862** (branch `feat/850-parallel-read`, worktree `../yawelo-idle-850`). AC1 is recorded on #850: 12.8-14.9 s total, of which the Worker's read is 10.9-13.7 s. The fix reads board pages and issue pages at the same time. After the merge and dev deploy, re-measure for AC3 with `node <scratchpad>/measure-850.mjs 3` (a one-off, not committed). Shyden approved real `Public title` edits on #829, reverted after each run. If any sample is still 10 s or over, the next cut is caching the installation token (2 REST calls per read).

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
- Worktrees: `-589` (PR #861), `-850` (PR #862), plus older ones kept: `-36` (PR #602), `-728b` (PR #745), `-761` (PR #767), `-752`, `-794`, `-728-probe`. Ask before removing the older ones.
- Local branches kept: nine `backup/*` and `tooling/785-nvmrc-exact` `-b`/`-c`/`-d`.
- Scratch refs on origin (Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-05)

- By tickets: 38% (170 of 442), pace 4.29 a day, ETA 2027-01-07 (medium confidence: 5 of 7 days moved).
- By effort: 1,171 points remaining across 272 open stories, pace 12.00 a day, ETA 2027-02-10 (medium confidence). Both before outside waits (#784's login, device sign-off).
