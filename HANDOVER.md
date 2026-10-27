# Handover: Yawelo Idle

**Written:** 2026-10-27 (seventeenth session). **Running when written:** nothing local from this repo; no jobs are DEAD.
**Next session:** `ListAgents`, then `board-next` (expect #762). Resume #762's plan at **review pass 2** (step 2 below), not at coding.

## Node

Since 2026-10-26 the Mac's Node is `~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` does not print 78.3, prefix Node/npm/git-push commands with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## Resume steps

Branch `tooling/762-native-coverage` (worktree `yawelo-idle-761`): origin at `b2ce07c` (red: Guards, run 40252518322); local `9e577b1` = Task 0 (`/test-reports/` ignored), **not pushed, by design**: the plan pushes nothing until Task 6, then lands ONE commit on a fresh branch `tooling/762-one-map` with a new PR (b2ce07c can never pass alone, and a force-push is forbidden). PR #767 stays a draft until then.
1. Read the plan: `yawelo-idle-761/.superpowers/sdd/762/plan.md` (git-ignored). Tasks: T0 done; T1 child processes (#733); T2 PR-workflow trace (#737); T3 workerd (#732), a spike and then a route question to Shyden; T4 act rehearsals (#738); T5 mutations (#766 + #770's 99 proofs + 13 others); T6 one record, no approval.
2. Review pass 2: one scratch PR off this branch with (a) T1's `autoAttachSubprocess` + child fixture + checker, (b) a one-step workflow printing GitHub's generated script beside its `run:` text (T2 offset), (c) act running `rollback-prod.yml` with fake keys (T4 spike). Read every step by name, fix the plan, log the pass, and repeat until clean, then self-approve.
3. T3's next spike: Miniflare 5 straight (`inspectorPort`, `workers[].config`), with no wrangler proxy holding the session. Probes `cov.mjs`, `direct.mjs` were in this session's scratchpad (gone); the findings are on #732. Then ask Shyden the route (in plain words, with costs).
4. Floors and the record: recorded in CI only. Run the unit suite by hand before each push, and push under `source ~/.claude/scripts/test-lock.zsh heavy <label>`.

## Done this session

- **Rulings (Shyden, 2026-10-27, on #762 and #738):** prod rehearsal = **"Practice runner"** (act runs the unchanged prod files with fake keys and a Cloudflare stand-in, measured in a spike first; anything it cannot run faithfully goes back to him). The 99 spelling-only non-unit tests = **"Prove each one"**: filed as **#770** (8 pts, P0, Todo, blocked by #762, read back).
- **Finding told to Shyden:** `b2ce07c` is red. The unit step writes `test-reports/unit.json`, which was not ignored, so five committable walks read 742 against 741. Fixed locally in `9e577b1` (anchored, planted both ways).
- Links fixed and read back: #732, #737, #738 are blocked by #762 (were #728); #738 is also blocked by #737; #728 is still blocked by #748 and #733.
- #732 spike: `createTestHarness` hard-codes `inspector: false` (wrangler 4.148.0, `cli.js:370747`). Via wrangler's proxy, `Profiler.startPreciseCoverage` answered "Profiler is not enabled"; via workerd's own inspector, `Profiler.enable` got no answer within 60 s. Stopped at two routes.
- Plan review pass 1: 7 findings, all fixed (log at the plan's end).
- Shyden relayed via repo-template (2026-10-27): **the phones are not available**. Parked: any device run (#713 AC5).

## Plan facts to keep

- `autoAttachSubprocess` merges V8 script coverage by URL BEFORE conversion (`@vitest/coverage-v8/dist/provider.js:50-62`). Native loading makes both sides the same stripped text, so it should join exactly; T1 pins it with an uncalled function.
- 16 integration/guards test files build `env: { PATH, … }` for spawns, which drops `NODE_V8_COVERAGE`. T1's `measuredEnv` and its guard cover this.
- Suite step durations on develop (run 39040575704): unit 33 s, guards 14, integration 30, properties 17, pacing 44, worker 18, web 12.

## Waiting on Shyden

- Set `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- Phones unavailable (2026-10-27): every device run stays parked until he says otherwise.

## Progress (board read 2026-10-27)

- **By tickets:** 32% complete (140 of 436 in-scope stories closed), 1.29/day over 7 days; board ETA 2027-06-15; release about 2027-06-26 to 2027-07-03 (low confidence).
- **By effort:** 1,295 points remaining across 296 open stories, 4.86/day; board ETA 2027-07-21; release about 2027-08-01 to 2027-08-08 (low confidence).
- Measured: the board and its 7-day pace (four of seven days at zero, so it has slowed since 10-26). Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone sign-off (phones now unavailable, with no date).

## State

- Main checkout on `handover/2026-10-17-d` (its CLAUDE.md is OLD: read develop's). develop `04aefda` when last read.
- Worktrees: `-761` = #762; `-728b` (#745), `-752` (unpushed; scratch ref `refs/floors/tooling/752-pre-push-per-commit`), `-36` parked; `-728-probe` has uncommitted probe files (ask before removing).
- Backups kept 30 days (never delete early): `settings.json.bak-deleting-scripts-2026-10-26`, `reference-guards-and-mechanical-edits.md.bak-deleting-scripts-2026-10-26`, the three `*floors-line*-2026-10-25`, `CLAUDE.md.bak-hook-refusal-final-2026-10-24`, `reference-engineering-standards.md.bak-hook-refusal-final-2026-10-24`, memory `MEMORY.md.bak-compact-2026-10-24`, `settings.json.bak-amend-hook-2026-10-24`, `retest.py.bak-2026-10-22-recursion`; branches `backup/*`; tags `backup/*`, `evidence/*`.
