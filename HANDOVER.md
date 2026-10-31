# Handover: Yawelo Idle

**Written:** 2026-10-31, ~00:30 WIB (twenty-seventh session). **Running when written:** nothing.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin` (v26.12.1).

## Done this session

- **#795 closed** (PR #796, `dc1a57d`): the dropped test machinery is removed, and coverage is one overall threshold. Develop's required checks are build-and-test, board-orphans and coverage.
- **#798 closed** (PR #799, `4c7805f`): Svelte files count in the coverage score. Thresholds are statements 85 and branches 76, floored from the exact counts. The report rounds down when it prints.
- **#802 closed** (PR #803, `a96766e`): every screen must have tests (Shyden, 2026-10-31). The coverage job fails when a Svelte component is never rendered by a test; `packages/ui/test/Shell.test.ts` renders the shell with `svelte/server`.
- **#804 closed** (PR #805, `aee526c`): behaviour must always be tested (Shyden, 2026-10-31). Every Svelte screen is held to 100% of its statements, branch arms and functions, and the job names each unrun line. Limit, measured: a template `{:else}` arm is invisible to coverage, so the story template also asks for a test that draws every template branch. The first screen with buttons will need a DOM test environment.
- **#800 closed** (PR #801, `f21baae`): the pemandu-tick case generator no longer draws a negative `until`.
- **Filed #797** (P2): the roadmap App's unused Administration: read, and develop's "Require review from Code Owners". Both are Shyden's calls.
- The dev deploy on `4c7805f` is green. Told the ShyTalk session how our promo video and site are built.

## Resume steps

1. Start the ticket `board-next` names: **#765** (P0: a push fails with HTTP 408 when the pre-push hook runs ~60 s under load). AC1 measures first.
2. Small leftover: `tests/watched.ts`'s doc comment still shows `searched`/`floorBreach` in an example. Fix it in the next PR that touches tests.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Dead worktrees from before, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.
- Waiting on Shyden: #784 (Gmail and Cloudflare login for Yawelo), #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## Progress (board, measured 2026-10-31 after #804 closed)

- By tickets: 35% (148 of 417), pace 1.14 a day, ETA 2027-06-24 (low confidence: 4 of the 7 days closed nothing).
- By effort: 1,173 points remaining across 269 open stories, pace 2.86 a day, ETA 2027-12-16 (low confidence). Both before outside waits (#784's login, device sign-off).
