# Handover: Yawelo Idle

**Written:** 2026-10-31 (thirtieth session). **Running when written:** nothing local. CI on PR #809 (external).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin` (v26.12.1).

## In flight: #783 (and #757) in PR #809

Branch `tooling/783-release-cut-check`, worktree `../yawelo-idle-783`, head `5ee37d193fad9040e79de3b92d3629df7e9d7701`, all committed and pushed. Ports repo-template's `release-cut` check (pull_request_target, posts a `release-cut` status on the head) and narrows `tests/unit/workflow-secrets.ts` so pull_request_target passes only with no checkout ref/repository, `persist-credentials: false` and no secret; a second commit (from the automated security review) also refuses unset or write-wide permissions and expressions in shell lines. Local: format, lint, typecheck, unit (12,662) green. #783 and #757 set In Progress; #783 commented (AC3 decided, AC4/AC5 void after #795).

1. `~/.claude/scripts/pr-verdict.sh 809` until it reports a finished verdict; read build-and-test, coverage and board-orphans by step name on the head SHA.
2. Green: squash-merge into develop (`--match-head-commit` from a file), verify the dev deploy.
3. Then Shyden: `main` requires `release-cut` pinned to app 15368 and drops strict; `develop` keeps strict (#757 AC3-AC4). Read both back by API. For #783's definition of done, a planted feature-branch PR into `main` is seen refused on GitHub, then shut. The next release cut merges with `release-cut` green (#757 AC6).
4. #757 AC5 (mutation file) is void after #795; say so on the ticket.

## Waiting on Shyden

- #768 AC4: on Biznet with ordinary DNS, both `dev.yawelo-idle.shyden.co.uk` and `dev-holding.yawelo-idle.shyden.co.uk` play the video in Chrome. Then he turns off the old dev-account bucket and its r2.dev address; the ticket is shut by hand.
- #784 (Gmail and Cloudflare login), #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). `../yawelo-idle-768` removed (merged). Dead worktrees, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-10-31)

- By tickets: 36% (149 of 417), pace 1.29 a day, ETA 2027-05-28 (low confidence: 4 of 7 days moved nothing).
- By effort: 1,171 points remaining across 268 open stories, pace 3.14 a day, ETA 2027-11-08 (low confidence). Both before outside waits (#784's login, device sign-off, #768 AC4 on Shyden's phone).
