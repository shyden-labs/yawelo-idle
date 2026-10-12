# Handover: Yawelo Idle

**Written:** 2026-10-12 00:21 UTC (the clean-up pass, #536 AC1 and AC2, #541–#544 filed, and the 0.1 s line made strict and global).
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once.

## Progress (both estimates, from `node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` at 23:36 UTC)

- **By tickets: 24% complete** (82 of 335 in-scope stories closed). Measured pace 6.86 a day over 7 days (ETA at that pace 2026-11-17). **ETA to release-ready: 2026-12-23 to 2027-02-01** (low to medium confidence).
- **By effort: 25% complete** (401 of 1,574 points closed). Measured pace 32.14 points a day (ETA at that pace 2026-11-17). **ETA to release-ready: 2026-12-19 to 2027-01-29** (low to medium confidence).
- **Measured:** the counts and the paces (10 and 11 October closed nothing). **Assumed:** 4–6 stories (20–30 points) a working day; about 30 unfiled prestige stories (130–180 points); 1.5–2.5 weeks of outside waits. This session added 21 points (#541–#544), which the next progress run counts.

## The order (Shyden: "Cleanup first, every project")

1. **#542** (5): the 51 golden-log and shop-agreement tests over 0.07 s replay a slice finer than a day, each at or under 0.07 s of thread CPU. Each day's _first_ kind (`encounters`) pays for judging the whole day (`judgedDay` in `tests/unit/shop-agreement.test.ts`), so the work is recording more starts in `golden-days.jsonl`.
2. **#543** (8): 29 core property tests move at full count to a required `properties` suite; unit keeps stand-ins on chosen cases (the global property ruling of 2026-10-12, steadyhand #290).
3. **#544** (3): the last 11 tests over 0.07 s.
4. **#536** AC3 (3): `CPU_LIMIT_MS` from 1,000 to 100 (held strictly), pinned and listed in the global hook's `CPU_LIMITS` with a refuse and an allow case; a planted 0.11 s test goes red; 10 green runs in a row with 14 busy processes (`.superpowers/sdd/536/measure.py b<n> 14 npx vitest run`).
5. **#541** (5): the per-file load limit (global rule 2026-10-11). Imports are 34% of the unit suite's 19.1 s.
6. Then, as before: #523, #527, #505, #497/#513; #432 stays open for evidence; #467 (Docker); one M1 floor burn-down per session.

## What this session did

- **Clean-up pass 1** (logged in `~/.claude/global-rules/reference/reference-cleanup.md`; the ledger says 2026-10-11):
  - worktrees: 5 removed (297, 297-before, 348, 348-red, 35)
  - branches: 105 local and 146 remote deleted (operator approved the remote deletions and the local-only work)
  - scratch and logs: 57 uncited `.superpowers/sdd/` dirs for closed tickets, and 5 logs in `~/Developer/Repos`
  - memory: 12 entries wholly covered by `CLAUDE.md` moved to `memory/covered-by-claude-md/`
  - board: checked, 0 mismatches
- **#536 AC1:** seven measured runs, posted on #536. All pass at 0 and 6 busy processes. 10, 14, 14 and 20 gave 15, 1, 0 and 7 failures. Every failure was a test at 117–308 ms of CPU, and the worst wall-over-CPU ratio was 12.07. The macOS load average counts threads and lags, so it can't serve as a line.
- **#536 AC2:** Shyden chose to cut the tests over 0.1 s, then made the check strict and global: _"held structly and yes i do want it as a global rule"_. One test's CPU varies up to 2.0x between runs (median 1.2x), so every test over 0.07 s is cut: 91 tests. `~/.claude/CLAUDE.md` and the hook (`CPU_LIMITS` ceiling 0.1 s; cases 59/59, mutations 0 mismatches) were changed, with backups `*.bak-0.1s-2026-10-12`. Other projects pick it up as a standing task in their own sessions.

## Waiting on Shyden

1. **`handover/overnight-2026-10-05`**: one local-only commit. My clean-up question said 7 branches when there were 8, so this one is kept until you say.
2. **Still open from before:** Spotlight privacy for `~/Developer/Repos`; the `gh api …/logs` hook; Docker for #467; #451 AC3; #341 AC8 a–d (PR #438 must not merge before that); #343 Buttondown; #333, #425/#426, #345, #455.

## State

- **`develop`** is at `5ef43d0`. Its dev deploy was verified in the last session. Open PRs: #438 (#341, behind develop) and this handover's PR.
- **Worktrees:** `../yawelo-idle-341` and `-341-gate` (open #438), and `../yawelo-idle-develop-bench` (detached, for before/after measurements).
- **Node:** 26.11.1 was first in PATH this session.
- **Remote branches:** `develop`, `main`, `website/341-roadmap-backend` and `m1/35-pacing-bots` (no PR; its text is on develop; kept).
- **Session tools (git-ignored):**
  - `.superpowers/sdd/536/`: `measure.py <label> <burners> npx vitest run`, `report.py <labels…>`, `heavy-59.txt` + `near-70-99.txt` (the 91 tests over 0.07 s, with their heaviest CPU), `m-*.jsonl/.log/.meta.json` (all seven runs), `file.py` + `stories/`
  - `.superpowers/sdd/101/set-status.sh <issue> <option-id>`
- **Board:** project 4, `PVT_kwDOEOcG584BlRWb`. Status field `PVTSSF_lADOEOcG584BlRWbzhj-3Hc`: Todo `f75ad846`, In Progress `47fc9ee4`, Done `98236657`. Estimate field `PVTF_lADOEOcG584BlRWbzhkVhDU`.

## Resume steps

1. **Run `ListAgents` and `node -v`** (prefix `export PATH=/opt/homebrew/opt/node/bin:$PATH;` if it isn't 26).
2. **Read each ticket's state from GitHub before working on it.**
3. **#542:** move it to In Progress, branch `m1/542-golden-slices`, and measure first (`heavy-59.txt` and `near-70-99.txt` have the before figures).
4. **Never name a test config or the word "vitest" in a setup command:** the test lock queues the whole command. Put file work in a script run by path.
5. **Measure CPU, not wall,** and state the load. One test run at a time.
6. **At close-out:** run the progress script, state both estimates, and check closed stories against "Website follows the game". Settle the handover as one commit.
