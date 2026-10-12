# Handover: Yawelo Idle

**Written:** 2026-10-12 07:24 UTC (#543 done, then the four guard gaps it opened: #554, #551, #558, #559).
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once.

## Progress (from `node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` at 07:18 UTC)

- **By tickets: 26% complete** (88 of 343 in-scope stories closed). Measured pace 5.57 a day over 7 days (ETA at that pace 2026-11-27). **ETA to release-ready: 2026-12-18 to 2027-01-27** (low to medium confidence).
- **By effort: 1,181 points remaining** across 255 open stories (430 of 1,611 closed, 27%). Measured pace 25.29 points a day (ETA at that pace 2026-11-28). **ETA to release-ready: 2026-12-14 to 2027-01-24** (low to medium confidence).
- **Measured:** the counts and paces (10 and 11 October closed nothing). **Assumed:** 4–6 stories (20–30 points) a working day; about 30 unfiled prestige stories (130–180 points); 1.5–2.5 weeks of outside waits. The ranges moved by as many days as the measured ETA did.

## Shyden's rulings this session (2026-10-12, all recorded)

1. **"revert to original"**, **"don't repeat."**, **"Fresh cases, safe minimums"** and **"Every project"**: properties moved out of unit get back their original counts and draw fresh cases; the 8 floored ones get measured minimums (#84). All in `~/.claude/CLAUDE.md` and `reference-engineering-standards.md`, with "a red property in CI is a real defect, never a re-run".
2. **"fix all gaps"**: done this session (below).

## What this session did

- **#543** (8, PR #552, `ca798a3`): every core property in a `properties` suite at its original count; unit keeps pinned stand-ins (57 ms heaviest, was 304).
- **#554** (3, PR #557, `97e07b5`): collection-calls follows test files to the helper modules they load (`tests/unit/helper-modules.ts`), and skips only a script's exact `if (import.meta.main)`.
- **#551** (3, PR #560, `7c67364`): no file the unit suite loads loads fast-check (`tests/guards/fast-check-in-unit.test.ts`), over one shared `unitSuiteFiles()`.
- **#558** (2, PR #561, `77cf763`): floorless-searches reads an absence spelled as an object of empties; the six tree sites were **converted, not listed** (the burn-down ceiling only falls).
- **#559** (3, PR #562, `88a9b71`): raised-limits reads every file the unit suite loads (163 → 189 files), other suites' configs left out by the repo's own lists; record-floors' `suite` bindings are `entry`.
- Each merged, deployed to dev, verified by job name and shut by hand. Two blind forms added to the global guard catalogue.

## Lessons (memory written)

- Shared fixture modules trip `collection-calls`; build derived test tables in the module.
- `record-floors` runs only on `labeled`: remove the label and add it back after a push.
- **Gate every push on the unit run's exit code**; a red unit at push time can change the design (the burn-down ceiling did).

## The order next ("Cleanup first, every project")

1. **#544** (3, 9 tests), **#553** (3, 10 tests): the rest over 0.07 s.
2. **#536** AC3 (3): `CPU_LIMIT_MS` 1,000 → 100, pinned in the hook's `CPU_LIMITS`, a planted 0.11 s test red, 10 green runs at 14 burners.
3. **#541** (5) per-file load limit; **#84** (5) fresh cases with measured minimums.
4. Then: #523, #527, #505, #497/#513; #432 stays open for evidence; #467 (Docker); one M1 floor burn-down per session.

## Waiting on Shyden

- `handover/overnight-2026-10-05`: one local-only commit, kept until you say.
- Still open from before: Spotlight privacy for `~/Developer/Repos`; the `gh api …/logs` hook; Docker for #467; #451 AC3; #341 AC8 a–d (PR #438 must not merge before that); #343 Buttondown; #333, #425/#426, #345, #455.

## State

- **`develop`** at `88a9b71`, deployed and verified. Open PRs: #438 (#341) and this handover's.
- **Worktrees:** `../yawelo-idle-341`, `-341-gate`, `../yawelo-idle-develop-bench`.
- **Session tools (git-ignored):** `.superpowers/sdd/{543,551,554,558}/` (probes with `probe.config.ts`, mutation scripts, `move.py`, `prune.py`), `.superpowers/sdd/536/measure.py` and `report.py`, `.superpowers/sdd/101/set-status.sh`.

## Resume steps

1. **Run `ListAgents` and `node -v`** (prefix `export PATH=/opt/homebrew/opt/node/bin:$PATH;` if it isn't 26). Read each ticket's state from GitHub before working on it.
2. **#544:** move it to In Progress, branch `m1/544-<slug>`, measure first with `measure.py`.
3. **Test commands never share a call with file edits**, nor name test files in an edit's text: the lock queues the whole command. Wait with Monitor or background jobs, never `sleep`.
4. **At close-out:** run the progress script, state both estimates, check closed stories against "Website follows the game", and settle the handover as one commit.
