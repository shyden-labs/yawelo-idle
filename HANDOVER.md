# Handover: Yawelo Idle

**Written:** 2026-10-30, ~19:00 WIB (twenty-seventh session). **Running when written:** nothing.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin` (v26.12.1).

## Done this session

- **#795 closed.** PR #796 was squash-merged as `dc1a57d` (Shyden approved, as the CODEOWNERS owner). It removed floors, mutations, minimums, the meta-guards, the per-test CPU check, the per-file coverage record, CODEOWNERS, owner-review and schedule-watch. Coverage is now one overall threshold in `scripts/coverage.ts`: statements 85%, branches 76% (CI measured 85.8% and 76.9%). Develop's required checks are build-and-test, board-orphans and coverage (Shyden ran the change; read back). The dev deploy on `dc1a57d` is green.
- A PR no longer needs any record step: tests, lint, typecheck and CI only.
- **Filed #797** (P2, 1 point): the roadmap App's unused Administration: read, and develop's "Require review from Code Owners", now pointless. Both are Shyden's calls.
- Told the ShyTalk session (`shytalk-1a`) how our promo video and site are built, read-only.

## Resume steps

1. Start the ticket `board-next` names: **#765** (P0, the pre-push hook's ~60 s under load causing HTTP 408 on push). Its AC1 measures first.
2. Small leftover: `tests/watched.ts`'s doc comment still shows `searched`/`floorBreach` in an example. Fix it in the next PR that touches tests.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Worktree `../yawelo-idle-795` is merged and can be removed. Dead worktrees from before, safe to remove after a look: `-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.
- Waiting on Shyden: #784 (Gmail and Cloudflare login for Yawelo), #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## Progress (board, measured 2026-10-30 after #795 closed)

- By tickets: 35% (144 of 413), pace 1.00 a day, ETA 2027-07-26 (low confidence: 5 of the 7 days closed nothing).
- By effort: 1,173 points remaining across 269 open stories, pace 3.00 a day, ETA 2027-11-25 (low confidence). Both before outside waits (#784's login, device sign-off).
