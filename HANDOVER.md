# Handover: Yawelo Idle

**Written:** 2026-10-16 (UTC). **Running when written:** on PR #606, head `3171c9e`: record-minimums round 2 (38853589161), build-and-test (38853571590), every-commit (38853571372), board-orphans (38853571365). The session's waiter on them dies with a `/clear`. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board picks the next ticket: expect #84.

## Progress (`node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 28% complete** (100 of 361 stories). Measured pace 2.57 a day over 7 days. Board ETA 2027-01-26 before outside waits. **ETA to release-ready: 2027-02-18 to 2027-02-25** (low confidence).
- **By effort: 1,208 points remaining** across 261 open stories (+13 today: #609 filed at 8, #84 re-scored 8 → 13). Measured pace 10.71 points a day. Board ETA 2027-02-06 before outside waits. **ETA to release-ready: 2027-03-01 to 2027-03-12** (low confidence).
- **Measured:** counts, paces, board ETAs. **Assumed:** about 30 unfiled prestige stories (130–180 points), and 1.5–2.5 weeks of outside waits.

## Done this session

- **New global rule** (Shyden): logging and auditing have a test suite of their own, run in CI as a prerequisite to a release. In `~/.claude/CLAUDE.md` (folded into the Swagger line to stay under the size ceiling) and `global-rules/reference/reference-engineering-standards.md`. Sent to the steadyhand, ShyTalk and shyden.co.uk sessions.
- **repo-template#16**, PR repo-template#17 into `main`: configs, `test:logs`, `logs.yml` (dispatch + call), docs, README step 8; 14 tests, 9 mutations; CI green on `54b0768`. Merging into `main` is Shyden's.
- **#84 round 1** fetched (63 minimums, 41 findings; table on #84). Spec and plan amended (§5.12, Task 6). Commit `3171c9e`: log moves to the logs suite (`packages/core/logs/`, `vitest.logs.config.ts`, `logs.yml` for #252), resume/listen exact, replay names the suite, reader covers `packages/*/logs/`, automation ×8, unfold journeys/review ×42, words ×12, culture ×3. 10 mutations as predicted. Unit: only floor lines red (9), as Task 7 expects.
- **#609** filed (P2, 8 pts): log's minimums at raised sizes in the logs suite. Blocked by #84; blocks #252 and #254. #193 notes the audit log joins the suite.

## #84 (In Progress, P2, 13 pts): PR #606 (draft)

- Worktree `/Users/shyden/Developer/Repos/yawelo-idle-84`, branch `properties/84-measured-minimums` at `3171c9e`, pushed, clean. Plan Task 6 Step 1 onward.
- Round 1's `core-log.json` is set aside in `.superpowers/sdd/84/round1-core-log.json` (not committed, by design).

## Resume steps

1. `ListAgents`; `node -v` (26); `board-next.ts` (expect #84).
2. `git -C ../yawelo-idle-84 rev-parse HEAD > ../yawelo-idle-84/.superpowers/sdd/84/head.sha`, then in the background: `wait-run.sh . 38853589161 .superpowers/sdd/84/head.sha` (round 2) and the same for build-and-test 38853571590 (expected red only at Unit tests, the 9 floor lines; read every failure).
3. When round 2 is green: `npm run minimums:fetch 38853589161`; post the table on #84; raise anything still listed and repeat (Task 6 Step 2). Then Task 6 Step 3: the properties step's CI time before and after (the unfold and automation raises may pass the 1-minute limit: measure, then set it by `suite-limits.test.ts`'s rule).
4. Task 7: squash, `record-floors`, fold the floors in, CI mutations on a throwaway PR, merge, close #84. Then #609.
5. When the board names #603: do its AC1 check first.

## Waiting on Shyden

- Merge repo-template PR #17 (and #15, #13, #7, #5) into `main`.
- A hook for the `gh api …/logs` escape-sequence refusal: missed for the 8th time this session.
- Add the agent App's key to Dependabot's secret store for #604 (blocked by #36 anyway).
- After #36 merges: add `mutation` to develop's required checks (#36's plan, Task 7).
- Delete the throwaway branches `test/341-mutations` (remote), `backup/341-drift-check-3-commits` and `handover/2026-10-16-c` (local)?
- Install the shyden.co.uk close hook. Earlier asks still open: `handover/overnight-2026-10-05`, Spotlight privacy, Docker for #467, #451 AC3, #343, #333, #425/#426, #345, #455.

## State

- Main checkout on `handover/2026-10-16-d` from `2a2bb8b` (develop); this file is its only change.
- Worktrees: `yawelo-idle-84` (#84, above); `yawelo-idle-36` (#36, parked behind #603, `cf1a736`, draft PR #602); `yawelo-idle-341-gate` detached at `ae4cdec`, clean. repo-template: `repo-template-16` (#16, PR #17).
- Session files (git-ignored): `.superpowers/sdd/84/` (in both checkouts), `607/`, `36/`, `580/`, `341/`.
