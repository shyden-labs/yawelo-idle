# Handover: Yawelo Idle

**Written:** 2026-10-16 (UTC). **Running when written:** CI on PR #606 at head `afebaca` (build-and-test, every-commit, board-orphans; started ~06:20). The session's waiter on it dies with a `/clear`. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board picks the next ticket: expect #84.

## Progress (`node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 28% complete** (100 of 361 stories). Measured pace 2.57 a day over 7 days. Board ETA 2027-01-26 before outside waits. **ETA to release-ready: 2027-02-18 to 2027-02-25** (low confidence).
- **By effort: 1,208 points remaining** across 261 open stories. Measured pace 10.71 points a day. Board ETA 2027-02-06 before outside waits. **ETA to release-ready: 2027-03-01 to 2027-03-12** (low confidence).
- **Measured:** counts, paces, board ETAs. **Assumed:** about 30 unfiled prestige stories (130–180 points), and 1.5–2.5 weeks of outside waits.

## Done this session

- **Global rule** (Shyden): logging and auditing have their own test suite, run in CI as a prerequisite to a release. In `~/.claude/CLAUDE.md` (Swagger line kept whole: Shyden said "cut something else"; the wait and zsh detail moved verbatim to `reference-guards-and-mechanical-edits.md`). Sent to the steadyhand, ShyTalk and shyden.co.uk sessions.
- **repo-template#16**, PR repo-template#17: green on `54b0768`; merging into `main` is Shyden's.
- **#609** filed (P2, 8): log's minimums at full size in the logs suite; blocked by #84, blocks #252 and #254.
- **#84:** round 2 (run 38853589161) 57 minimums, 0 findings (table on #84). Squashed to one commit; the guards, first run inside record-floors, found 3 defects, fixed (collection call in log.test.ts; 10 unfloored absences rewritten with planted controls; the recorder now knows the logs suite as unrecordable; 2 scripts added to script-loads). Two floors lowered by hand with per-file proof in the commit. Floors recorded by run 38858183612 and folded in. CI fully green by name on `9f7e9bd`; the properties step took 17 s and 12 s (table updated 12 → 17 s, limit still 1 minute) in `afebaca`.

## #84 (In Progress, P2, 13 pts): PR #606 (draft)

- Worktree `/Users/shyden/Developer/Repos/yawelo-idle-84`, branch `properties/84-measured-minimums` at `afebaca`, one commit on `7e32388`, pushed, clean.

## Resume steps

1. `ListAgents`; `node -v` (26); `board-next.ts` (expect #84).
2. `git -C ../yawelo-idle-84 rev-parse HEAD > ../yawelo-idle-84/.superpowers/sdd/84/head.sha`; read CI on `afebaca` by step name (`wait-run.sh` per run id from `gh run list --branch properties/84-measured-minimums`). Expected all green.
3. Task 7 Step 2: CI mutations on a throwaway draft PR off the head. Design and cautions in `../yawelo-idle-84/.superpowers/sdd/84/mutations-ci.md`; exact titles in `properties-titles.txt` there. Read each generator before predicting; predictions first, then the whole verdict; close the throwaway unmerged.
4. Task 7 Step 3: mark #606 ready, merge into develop once green on its head, tick ACs 1–9 on #84 with citations, close by hand. Then #609.
5. When the board names #603: do its AC1 check first.

## Waiting on Shyden

- Merge repo-template PR #17 (and #15, #13, #7, #5) into `main`.
- A hook for the `gh api …/logs` escape-sequence refusal: missed for the 8th time this session.
- Add the agent App's key to Dependabot's secret store for #604 (blocked by #36 anyway).
- After #36 merges: add `mutation` to develop's required checks (#36's plan, Task 7).
- Delete the throwaway branches `test/341-mutations` (remote), `backup/341-drift-check-3-commits`, `handover/2026-10-16-c` and `handover/2026-10-16-d` (local)?
- Install the shyden.co.uk close hook. Earlier asks still open: `handover/overnight-2026-10-05`, Spotlight privacy, Docker for #467, #451 AC3, #343, #333, #425/#426, #345, #455.

## State

- Main checkout on `handover/2026-10-16-e` from `7e32388` (develop); this file is its only change.
- Worktrees: `yawelo-idle-84` (#84, above); `yawelo-idle-36` (#36, parked behind #603, `cf1a736`, draft PR #602); `yawelo-idle-341-gate` detached at `ae4cdec`, clean. repo-template: `repo-template-16` (#16, PR #17).
- Session files (git-ignored): `.superpowers/sdd/84/` (in both checkouts), `607/`, `36/`, `580/`, `341/`.
