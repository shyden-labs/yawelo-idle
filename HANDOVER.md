# Handover: Yawelo Idle

**Written:** 2026-10-30, ~11:30 WIB (twenty-seventh session). **Running when written:** CI on PR #796.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin` (v26.12.1).

## Where it stands

- **#795 (P0, In Progress): PR #796**, branch `tooling/795-simplify`, worktree `../yawelo-idle-795`, two commits, head `835af7d79def4d3160d0b4ae21cac94d068c5298`, pushed. It removes floors, mutations, minimums, the meta-guards and limits, the per-file coverage record, CODEOWNERS, owner-review and schedule-watch (359 files, −45,317 lines), and makes coverage one overall threshold (statements 85%, branches 76%, as this tree measured in CI run 40999845202: 85.8% and 76.9%) in `scripts/coverage.ts`. Locally: format, lint, typecheck and unit (12,516 tests) green. Guards, integration, properties, pacing and coverage run in CI only.
- One PR, not four: floors, meta-guards, mutations and coverage were entangled (deleting any test tripped the floors). The squash commit's message lists every verdict it turns into a pass.

## Resume steps

1. Read PR #796's CI: `~/.claude/scripts/pr-verdict.sh 796`. Fix any red in a new commit on the branch (never amend a pushed branch).
2. (Done: the first run failed only on the threshold; the second commit sets it to the measured figures.)
3. When green on the head SHA, change develop's required checks from `build-and-test, board-orphans, mutations` to `build-and-test, board-orphans, coverage` (app 15368), and read them back. `mutations` never reports on #796, so it cannot merge before this.
4. Squash-merge #796, check the dev deploy, re-read #795's ACs, and close it by hand with a comment.
5. (Done: filed #797, P2, 1 point, for the roadmap App's unused Administration: read and develop's "Require review from Code Owners"; both Shyden's calls.)
6. Then `board-next` (expected: #765, then #768, #783, the P1 website items, game M1).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Dead worktrees from before, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.
- Waiting on Shyden: #784 (Gmail and Cloudflare login for Yawelo), #788, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## Progress (board, measured 2026-10-30)

- By tickets: 35% (143 of 412), pace 0.86 a day, ETA 2027-09-09 (low confidence).
- By effort: 1,180 points remaining across 269 open stories, pace 1.86 a day, ETA 2028-07-27 (low confidence). Both before outside waits (#784, device sign-off).
