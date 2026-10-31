# Handover: Yawelo Idle

**Written:** 2026-10-31 (thirtieth session). **Running when written:** nothing local. CI on PR #811 (external).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin` (v26.12.1).

## In flight: #810 (P0) in PR #811

Branch `security/810-pull-request-target-gaps`, worktree `../yawelo-idle-810`, head `a662fd14ffc9701aadb40b7aace38540b262fb00`, committed and pushed. `tests/unit/workflow-secrets.ts` under pull_request_target also refuses git/gh/curl/wget in shell lines, expressions in `with:`, any action beyond checkout and setup-node, and reusable-workflow jobs; every refusal names its rule. Local: format, lint, typecheck, unit (12,677) green. #810 In Progress.

1. `~/.claude/scripts/pr-verdict.sh 811` until finished; read build-and-test, coverage and board-orphans by step name on the head SHA.
2. Green: squash-merge into develop (`--match-head-commit` from a file), then shut #810 by hand after reading it merged.

## Done this session

- #783/#757: PR #809 merged as `ffd8b907` (release-cut check). Settings changed in Chrome after Shyden confirmed access, read back by API: main classic strict false + build-and-test; ruleset "main: release cuts only" requires release-cut (integration 15368), not strict; develop unchanged (strict). Recorded on both tickets.
- Still open on #783: a planted non-release PR into main seen refused (the local release-from-a-cut hook refuses me opening one: Shyden opens it, or it is seen on the next release). #757: AC6, the next release cut merging with release-cut green; AC5 void after #795.
- Rule added (global CLAUDE.md "No holes" + memory): always fill every gap I name.

## Waiting on Shyden

- #768 AC4: on Biznet with ordinary DNS, both `dev.yawelo-idle.shyden.co.uk` and `dev-holding.yawelo-idle.shyden.co.uk` play the video in Chrome. Then he turns off the old dev-account bucket and its r2.dev address; the ticket is shut by hand.
- #784 (Gmail and Cloudflare login), #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Dead worktrees, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-10-31)

- By tickets: 36% (149 of 418), pace 1.29 a day, ETA 2027-05-29 (low confidence: 4 of 7 days moved nothing).
- By effort: 1,174 points remaining across 269 open stories, pace 3.14 a day, ETA 2027-11-09 (low confidence). Both before outside waits (#784's login, device sign-off, #768 AC4 on Shyden's phone).
