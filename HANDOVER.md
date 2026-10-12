# Handover: Yawelo Idle

**Written:** 2026-10-12 02:25 UTC (#542 and #547 done: golden tests cut by open, floors recorded in CI).
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once.

## Progress (from `node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` at 02:23 UTC)

- **By tickets: 25% complete** (84 of 340 in-scope stories closed). Measured pace 5.00 a day over 7 days (ETA at that pace 2026-12-03). **ETA to release-ready: 2026-12-23 to 2027-02-01** (low to medium confidence).
- **By effort: 26% complete** (414 of 1,603 points closed). Measured pace 23.00 points a day (ETA at that pace 2026-12-03). **ETA to release-ready: 2026-12-19 to 2027-01-29** (low to medium confidence).
- **Measured:** the counts and paces (10 and 11 October closed nothing). **Assumed:** 4–6 stories (20–30 points) a working day; about 30 unfiled prestige stories (130–180 points); 1.5–2.5 weeks of outside waits.

## How floors are recorded now (#547)

Floors are recorded in CI only. Label the PR `record-floors`, wait for that run, then `npm run floors:fetch <run-id>` here, fold the floors into the commit (`git commit --amend`), wait until the PR's CI on the old head has completed, and `git push --force-with-lease`. `npm run floors:record` refuses anywhere else. The pre-push hook runs ci-scripts, format, lint and typecheck, and no test suite: run the unit suite yourself before each push (`CLAUDE.md`).

## The order (Shyden: "Cleanup first, every project")

1. **#543** (8): 29 core property tests move at full count to a required `properties` suite; unit keeps stand-ins on chosen cases (global property ruling of 2026-10-12, steadyhand #290).
2. **#544** (3): the last 11 tests over 0.07 s.
3. **#536** AC3 (3): `CPU_LIMIT_MS` from 1,000 to 100 (held strictly), pinned and listed in the global hook's `CPU_LIMITS` with a refuse and an allow case; a planted 0.11 s test goes red; 10 green runs in a row with 14 busy processes (`.superpowers/sdd/536/measure.py b<n> 14 npx vitest run`).
4. **#541** (5): the per-file load limit (global rule 2026-10-11).
5. Then, as before: #523, #527 (its runner runs from a CI workflow, comment of 2026-10-12), #505, #497/#513; #432 stays open for evidence; #467 (Docker); one M1 floor burn-down per session.

## What this session did

- **#542** (8, PR #549, `e572b4a`): the golden log is cut at each of the player's 5 opens a day (175 slices). Starts are stored as a whole start per day plus deltas (1.60 MB). Five heavy slices, whose resume alone has Pemandu buy over 1,000 Encounters, run in the pacing suite with the whole-log play, replay and judgement. Heaviest unit test: 55 ms, against 308 ms before (5 runs). Six tiling mutations, each red.
- **#547** (5, PR #548, `5f6fd91`): the `record-floors` workflow, `scripts/fetch-floors.ts`, `recordRefusal`, and the pre-push cut. Eight mutations, each red. First real uses: #548's 40 floors, #549's 1,258.
- Both were deployed to dev and verified (deploy-dev 38194257492 and 38195082087). Both are closed by hand and marked Done.
- Shyden's rulings (all posted on the tickets): "Move the 5 out", "Day start + deltas", "#547 first, then #542", "CI records, laptop commits", "No unit in pre-push".

## Waiting on Shyden

1. **Scope of "no unit in pre-push"**: recorded for this repo only. Every repo that records floors in CI meets the same collision, so it may belong in the global rule.
2. **`handover/overnight-2026-10-05`**: one local-only commit, kept until you say.
3. **Still open from before:** Spotlight privacy for `~/Developer/Repos`; the `gh api …/logs` hook; Docker for #467; #451 AC3; #341 AC8 a–d (PR #438 must not merge before that); #343 Buttondown; #333, #425/#426, #345, #455.

## State

- **`develop`** is at `e572b4a`, deployed to dev and verified. Open PRs: #438 (#341, behind develop) and this handover's PR.
- **Worktrees:** `../yawelo-idle-341` and `-341-gate` (open #438), and `../yawelo-idle-develop-bench` (detached, for before/after measurements).
- **Node:** 26.11.1 was first in PATH this session.
- **Session tools (git-ignored):**
  - `.superpowers/sdd/542/`: `mutate.py` (tiling mutations), `mutate547.py`, the probes (`probe.test.ts`, `split.test.ts`, `slices.jsonl`), and `state.md`.
  - `.superpowers/sdd/536/`: `measure.py <label> <burners> npx vitest run`, `report.py`, and the runs (m-b*, m-s542-1..5).
  - `.superpowers/sdd/101/set-status.sh <issue> <option-id>`.
- **Board:** project 4, `PVT_kwDOEOcG584BlRWb`. Status field `PVTSSF_lADOEOcG584BlRWbzhj-3Hc`: Todo `f75ad846`, In Progress `47fc9ee4`, Done `98236657`. Estimate field `PVTF_lADOEOcG584BlRWbzhkVhDU`.

## Resume steps

1. **Run `ListAgents` and `node -v`** (prefix `export PATH=/opt/homebrew/opt/node/bin:$PATH;` if it isn't 26).
2. **Read each ticket's state from GitHub before working on it.**
3. **#543:** move it to In Progress, branch `m1/543-properties-suite`, and measure first.
4. **Never name a test config or the word "vitest" in a setup command:** the test lock queues the whole command. Put file work in a script run by path.
5. **Measure CPU, not wall,** and state the load. One test run at a time. A start held in memory hits identity-keyed memos (`automation.ts`, `sim.ts`); measure from JSON-parsed starts.
6. **At close-out:** run the progress script, state both estimates, and check closed stories against "Website follows the game". Settle the handover as one commit.
