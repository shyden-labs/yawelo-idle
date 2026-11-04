# Handover: Yawelo Idle

**Written:** 2026-11-05 (thirty-eighth session, overnight while Shyden sleeps). **Phones: connected but not authorised (Android unauthorized, iPhone untrusted); no device work.**
**Running when written:** CI on PR #865 (branch updated with develop) and PR #866. Local waiters die with the session.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. board-next names #783 (P0): its code shipped in PR #809, and only a planted non-release PR into `main` remains, which is Shyden's (see below); then take the next ticket.

## Done this session

- **#850 closed:** PR #862 (squash `b6a1535f`) reads board and issue pages at once. On dev the edit-to-roadmap time went from 12.8-14.9 s to 8.1, 9.2 and 8.9 s (tables on #850).
- **#589 closed:** PR #861 (squash `7e800d8b`): `/api/private/docs` answers 401 without the dev password and 200 with it; production answers 404. Its browser tests passed in all three engines.
- Filed #863 (coverage counts harness test files, Shyden's route) and #864 (site-smoke screenshots).
- Two dev deploys in a row had one different `site-smoke` red each: run 41894579720 (Chromium, no island within 5 s) and run 41899809204 (WebKit, a click left `aria-expanded` false). The causes are unmeasured, so `dev-verified` was skipped both times. Both are logged on #864.

## In flight

1. **#864 site-smoke screenshots, PR #865** (worktree `../yawelo-idle-864`). No trace on purpose: it would carry the dev password into a public artifact. Merge when green (`~/.claude/scripts/pr-verdict.sh 865`), then read the next deploy's `site-smoke`. It stays open 14 days for AC3.
2. **#772 board-next walks blocker chains, PR #866** (worktree `../yawelo-idle-772`). AC2 was amended to Shyden's 2026-10-13 "note, not a refusal". Merge when green.

## Next

1. Finish 1-2, then the next ticket below #783. The P1s left all need Shyden (#830 copy, #655 SonarCloud, #784 Cloudflare). The P2s that need no one include #575, #591, #672, #760, #778.
2. #863: its first AC is Shyden's choice, (a) leave harness test files out of the figure or (b) accept the cost.

## Waiting on Shyden

- **Ask on his return, one at a time (he said "tomorrow" 2026-11-04):** #784 next steps (Gmail, Cloudflare, domains); delete test board project 6; the ETA confidence rule; voyage map layout (#328/#331/#452).
- #655 SonarCloud: his SonarCloud project and `SONAR_TOKEN` (about 10 minutes in Chrome).
- #863 route (a)/(b). #858 placement ruling. #830 copy approval.
- #783: open a test PR into `main` from any non-release branch, see `release-cut` refuse it, then close it (my hook refuses me opening one). Or accept seeing it at the next release cut.
- **Open PRs with no recent movement:** #602 (Stryker, waits on a runner release), #745 (#728), #767 (#762), and Dependabot #593, #594, #597, #750, #763, #764, #779, #834 (re-run them; `ROADMAP_APP_KEY` exists now).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Worktrees: `-864` (PR #865), `-772` (PR #866), plus older ones kept: `-36` (PR #602), `-728b` (PR #745), `-761` (PR #767), `-752`, `-794`, `-728-probe`. Ask before removing the older ones.
- Local branches kept: nine `backup/*` and `tooling/785-nvmrc-exact` `-b`/`-c`/`-d`.
- Scratch refs on origin (Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-05)

- By tickets: 38% (170 of 442), pace 4.29 a day, ETA 2027-01-07 (medium confidence: 5 of 7 days moved).
- By effort: 1,171 points remaining across 272 open stories, pace 12.00 a day, ETA 2027-02-10 (medium confidence). Both before outside waits (#784's login, device sign-off).
