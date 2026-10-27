# Handover: Yawelo Idle

**Written:** 2026-10-27 (nineteenth session). **Running when written:** nothing. No jobs are DEAD. Docker Desktop is running (server 29.9.2, started in session 18 for act); quit it if nothing needs it.
**Next session:** `ListAgents`, then `board-next`. It will name #728 (P0, In Progress, blocked by #733): its rank puts In Progress ahead of unblocked (#772 filed). The chain is #728 ← #733 (inside #762) ← **#771**, so **start #771**.

## Node

The Mac's Node is `~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` does not print 78.3, prefix Node/npm/git-push commands with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## Resume steps

1. **#771** (P0, 5 points, Todo, no branch yet; Shyden's ruling "Make room first", 2026-10-27). Read its ACs on GitHub. Branch `tooling/771-record-rehearse-job` off `origin/develop`, then write its plan (`superpowers:writing-plans`) into the git-ignored `.superpowers/sdd/771/plan.md`, reviewed to zero.
   - Budget (develop `04aefda`, `codeLines`): `record-floors.yml` 105 code lines. Freed: the scratch-ref gate's 19-line `run:` block (line 57) plus its 5-line `env:`, less 1 for a develop checkout = 23. Needed: an 18-line host `rehearse` job (no `npm ci`: built-ins only, setup-node without `cache`) plus a 4-line download step in `record-coverage` = 22. Re-count the real diff with `codeLines`; AC1 says no rise.
   - The gate must run from **develop's checkout** before the measured SHA is checked out, reading the inputs from `$GITHUB_EVENT_PATH`. It is a security gate: it must never run the measured commit's code.
   - The first record of #771's own branch runs develop's OLD workflow (no rehearse job). That is expected, and it passes only if no file's untested count rises.
2. **#762** (blocked by #771). Plan `yawelo-idle-761/.superpowers/sdd/762/plan.md`, pass 6 logged (P6-1 to P6-6). After #771 merges, do pass 7: rewrite Tasks 2, 4 and 6 so the record reads the `rehearse` job's act traces, with real-runner traces feeding #728. Worktree `-761`, branch `tooling/762-native-coverage`: origin `b2ce07c` (red), local `9e577b1` = Task 0, **not pushed, by design** (Task 6 lands one commit on a fresh `tooling/762-one-map`; draft PR #767 stays until then).
3. Floors are recorded on an unpushed commit: scratch ref `refs/floors/<branch>`, the record probe, dispatch develop's `record-floors.yml` with `-f branch= -f sha=`, `floors:fetch`, amend, first push with `Floors:`. Run the unit suite by hand before each push; push under `source ~/.claude/scripts/test-lock.zsh heavy <label>`.

## Done this session

- **#762 plan review pass 6: not clean, 6 findings.** P6-1 (structural): records run develop's `record-floors.yml` on an unpushed commit, so no PR run exists to join, and the ratchet refuses every added workflow line (this branch's +61/−5 on `ci.yml` too). Ruled out by measurement: act from the record's scripts (Playwright container, user 1001, no Docker socket) and a CI replay in the 12-min Measure step (jobs sum 10.6 min, run 40070428755). P6-2: label flow retired. P6-3: Review Focus order. P6-4: the premise test would overwrite coverage-v8's child coverage folder (`dist/index.js` `startCoverage` sets `process.env.NODE_V8_COVERAGE`); dropped. P6-5: the `codeWithoutLiterals` guard is blind to shell inside TS strings; now an AST read of `child_process` arguments. P6-6: non-unit red-first moves to the PR's `mutations` job.
- **Asked Shyden:** "Make room first (Recommended)". Comment on #762 (issuecomment-6437978563).
- **Filed and read back:** #771 (P0, 5, Todo; #762 "Blocked by" #771 via REST `dependencies/blocked_by`). I had told Shyden about 3 points; the drafted job puts it at 5. #772 (`board-next` follows the Blocked-by chain; P2, 2, Todo).
- Router: GraphQL naming no `-R` or board id is refused; use REST `repos/shyden-labs/yawelo-idle/…`.
- Memory: `project-record-cannot-measure-its-own-change`.

## Waiting on Shyden

- Set `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- Phones unavailable (2026-10-27): every device run stays parked until he says otherwise (#713 AC5).
- Optional: whether CLAUDE.md should carry a pointer to the practice-runner rule, and what to cut for it.

## Progress (board read 2026-10-27, this session)

- **By tickets:** 32% complete (140 of 438 in-scope stories closed), 1.29/day over 7 days (5, 0, 1, 3, 0, 0, 0); board ETA 2027-06-16; release about 2027-06-27 to 2027-07-04 (low confidence).
- **By effort:** 1,302 points remaining across 298 open stories, 4.86/day; board ETA 2027-07-23; release about 2027-08-03 to 2027-08-10 (low confidence).
- Measured: the board and its 7-day pace (four of seven days at zero). Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone sign-off (phones unavailable, no date). Nothing closed this session; +7 points filed (#771, #772).

## State

- Main checkout on `handover/2026-10-17-d` (local handover commits, not pushed; PR #648 closed). Its CLAUDE.md is OLD: read develop's. develop `04aefda` when last read.
- Worktrees: `-761` = #762; `-728b` (#745), `-752` (unpushed; scratch ref `refs/floors/tooling/752-pre-push-per-commit`), `-36` parked; `-728-probe` has uncommitted probe files (ask before removing).
- Backups kept 30 days (never delete early): `CLAUDE.md.bak-practice-runner-2026-10-27`, `reference-engineering-standards.md.bak-practice-runner-2026-10-27`, `settings.json.bak-deleting-scripts-2026-10-26`, `reference-guards-and-mechanical-edits.md.bak-deleting-scripts-2026-10-26`, the three `*floors-line*-2026-10-25`, `CLAUDE.md.bak-hook-refusal-final-2026-10-24`, `reference-engineering-standards.md.bak-hook-refusal-final-2026-10-24`, memory `MEMORY.md.bak-compact-2026-10-24`, `settings.json.bak-amend-hook-2026-10-24`, `retest.py.bak-2026-10-22-recursion`; branches `backup/*`; tags `backup/*`, `evidence/*`.
