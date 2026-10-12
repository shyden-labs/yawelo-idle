# Handover: Yawelo Idle

**Written:** 2026-10-12 05:23 UTC (#543 done: every core property in a `properties` suite at its original count).
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once.

## Progress (from `node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` at 05:22 UTC)

- **By tickets: 25% complete** (85 of 341 in-scope stories closed). Measured pace 5.14 a day over 7 days (ETA at that pace 2026-12-01). **ETA to release-ready: 2026-12-22 to 2027-01-31** (low to medium confidence; the 03:55 range moved by the 1 day the measured ETA moved).
- **By effort: 26% complete** (422 of 1,606 points closed). Measured pace 24.14 points a day (ETA at that pace 2026-12-01). **ETA to release-ready: 2026-12-17 to 2027-01-27** (low to medium confidence; the 03:55 range moved by the 2 days the measured ETA moved).
- **Measured:** the counts and paces (10 and 11 October closed nothing). **Assumed:** 4–6 stories (20–30 points) a working day; about 30 unfiled prestige stories (130–180 points); 1.5–2.5 weeks of outside waits.

## Shyden's rulings this session (2026-10-12, all recorded)

1. **"revert to original"**: a property moved out of unit gets back the count #474 cut (table on #543).
2. **"don't repeat."**: no fixed seed. The 8 floored properties get measured minimums instead of exact floors ("Fresh cases, safe minimums", an exemption he granted): **#84** (now 5 points, with #416's sites folded in).
3. **Both rulings global** ("Every project"), in `~/.claude/CLAUDE.md` and `reference-engineering-standards.md` (backups `*.bak-property-counts-2026-10-12`), with "a red property in CI is a real defect, never a re-run".
4. Closed as superseded: **#411** and **#416**.

## What this session did

- **#543** (8, PR #552, `ca798a3`): 35 `fc.assert` sites and the full golden digests moved to `packages/core/properties/` (`npm run test:properties`, CI step "Properties (every property at its full count)", 1-minute limit from 9/12/12 s). Checks live in `packages/core/test/<module>-laws.ts`, and unit keeps pinned stand-ins. Heaviest touched unit test is 57 ms (was 304). The mutation (draft #555, closed) went red in both suites. Deployed to dev and verified (deploy-dev 38206594244). Closed by hand, Done.
- **Filed:** #551 (3, guard against fast-check in unit), #553 (3, ten more tests over 0.07 s), #554 (3, collection-calls reads helper modules).

## Lessons (memory written)

- Shared fixture modules trip `collection-calls` (#97): no call or method on imported names at collection, and derived test tables are built in the module. It cost two red CI rounds.
- `record-floors` runs only on the `labeled` event: after a push, remove the label and add it back.
- A fall the recorder refuses is lowered by hand only with proof: a probe against develop giving the exact delta.

## The order next ("Cleanup first, every project")

1. **#544** (3, now 9 tests: the encounters ones moved in #543).
2. **#553** (3): the ten found in #543's runs.
3. **#536** AC3 (3): `CPU_LIMIT_MS` 1,000 → 100, pinned in the hook's `CPU_LIMITS`, a planted 0.11 s test red, 10 green runs at 14 burners.
4. **#541** (5) per-file load limit; **#84** (5); **#551** (3); **#554** (3).
5. Then: #523, #527, #505, #497/#513; #432 stays open for evidence; #467 (Docker); one M1 floor burn-down per session.

## Waiting on Shyden

- `handover/overnight-2026-10-05`: one local-only commit, kept until you say.
- Still open from before: Spotlight privacy for `~/Developer/Repos`; the `gh api …/logs` hook; Docker for #467; #451 AC3; #341 AC8 a–d (PR #438 must not merge before that); #343 Buttondown; #333, #425/#426, #345, #455.

## State

- **`develop`** at `ca798a3`, deployed and verified. Open PRs: #438 (#341) and this handover's.
- **Worktrees:** `../yawelo-idle-341`, `-341-gate`, `../yawelo-idle-develop-bench`.
- **Session tools (git-ignored):** `.superpowers/sdd/543/` (`move.py`, `prune.py`, probes with `probe.config.ts`, `shrinks.py`, the over-70 listing `over70.py`), `.superpowers/sdd/536/measure.py` and `report.py` (runs `m-b543-*` before, `m-a543-*` after), `.superpowers/sdd/101/set-status.sh`.

## Resume steps

1. **Run `ListAgents` and `node -v`** (prefix `export PATH=/opt/homebrew/opt/node/bin:$PATH;` if it isn't 26). Read each ticket's state from GitHub before working on it.
2. **#544:** move it to In Progress, branch `m1/544-<slug>`, and measure first with `measure.py`.
3. **Test commands never share a call with file edits,** nor name test files in an edit's text: the lock queues the whole command. Put edits in a script and run it by path. Wait with Monitor or background jobs, never `sleep`.
4. **At close-out:** run the progress script, state both estimates, check closed stories against "Website follows the game", and settle the handover as one commit.
