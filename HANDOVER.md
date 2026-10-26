# Handover: Yawelo Idle

**Written:** 2026-10-26 (sixteenth session; committed before the Mac restart). **Running when written:** nothing local from this repo; no jobs are DEAD.
**Next session:** `ListAgents`, then `board-next` (expect #762). The work is #762's change, which ALSO carries #733, #732, #737 and #738 (Shyden's rulings on #762). Start by PLANNING it (superpowers:writing-plans, reviewed to zero per the global rule), not by coding. Step 1 below (reading the five tickets) was done this session; the summary is in step 1.

## Node: use the new PATH

Homebrew's node is uninstalled (2026-10-26): a shell started before then finds no `node` at all, so node/npm/npx AND `git push` (the pre-push hook calls node) fail with "command not found". Since 2026-10-26 the Mac's Node is `~/.local/share/node/current/bin` (v26.12.1, ICU 78.3 / CLDR 48, as CI; Shyden, shyden.co.uk #953). Prefix every Node/npm command with `export PATH=$HOME/.local/share/node/current/bin:$PATH;` until Claude is relaunched from a fresh terminal (then check `node -p process.versions.icu` reads 78.3).

## Resume steps

Branch `tooling/762-native-coverage` at `b2ce07c` (= origin; amend no longer allowed, add commits). PR #767 is a DRAFT. #762 In Progress.
1. Read (done 2026-10-26): #762 AC1–AC4 built; #733 (child-process coverage via the native loader, 5 pts, AC5: every mutation file at zero untested), #732 (workerd coverage over the inspector, 5), #737 (bash xtrace of every PR-workflow `run:` step joined to lcov, 5), #738 (rehearse the 8 non-PR workflows on the PR commit, 8; **its prod-rehearsal design must be approved by Shyden**), #766 (hindsight row + sibling, after #762). Links today: #732, #737, #738 blocked by #728; #728 by #733; #733 by #762; #766 by #762. Decide the order inside one change and fix the links (a blocker takes the top level of what waits).
2. Plan (spec + plan in `.superpowers/sdd/762/`): each kind measured and joined on the one map, the records re-taken once, the 112 mutation findings answered (99 spelling-only files still need a decision: the check has no spelling-only rule; ask Shyden if the plan cannot prove them), #766's rows. Review the plan to zero.
3. Each new commit: record floors via the scratch ref, fetch, fold in BEFORE pushing. Push under `source ~/.claude/scripts/test-lock.zsh heavy <label>` (#765). Run the unit suite by hand before each push.
4. Session tools from the fifteenth session (`recdiff.mjs`, `spelling-only.py`, `predicted-exist.mjs`, `arms.mjs`) were in that session's scratchpad: gone; rewrite if needed.

## Done this session (sixteenth)

- Clean-up pass (reference-cleanup.md, B and D; logged; `cleanup-done.sh` run). With Shyden's four OKs: 9 worktrees, 32 local + 9 remote branches deleted, PR #648 closed (superseded handover). 6 memory links repaired. #661 moved In Progress → Todo (only a merged branch named it).
- **Finding told to Shyden:** `ROADMAP_APP_KEY` is not set as a Dependabot secret, so `board-orphans` is red on every Dependabot PR (#763, #764; #661 AC1, his step; commented on #661).
- Slip: three branches deleted after their backup tag failed; recovered the same turn (tags `backup/handover-overnight-2026-10-05-2026-10-26`, `backup/probe-718-trigger-2026-10-26`, `backup/site-621-media-ranges-2026-10-26`).
- Mechanism (Shyden: "Hook, every project"): global `hooks/deleting-scripts-stop-at-failure.py` + `.test.py` (67 cases) + `.mutations.py` (21, all as predicted), registered and proven live. A scratch shell script that deletes needs `set -euo pipefail` and no bare `A && B` (set -e ignores a failure left of &&, measured in bash 3.2.57 and zsh 5.9). Written in `reference-guards-and-mechanical-edits.md`.
- A separate Mac de-bloat session (Shyden approved "Finished worktrees", 02:00 UTC) also removed `-687 -692 -713 -718 -719 -751 -754`. Branches survive; `-751`'s git-ignored `sdd/751` notes are gone (only `probe751.sh` survives in the main checkout).

## Waiting on Shyden

- Set `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- Phones: shyden.co.uk held the iPhone for #811 (2026-10-25); confirm with Shyden before any device run (#713 AC5; its worktree is gone, recreate from `site/713-media-from-r2` if needed).

## Progress (board read 2026-10-26)

- **By tickets:** 32% complete (140 of 433 in-scope stories closed), 2.14/day over 7 days; board ETA 2027-03-12; release about 2027-03-23 to 2027-03-30 (low confidence).
- **By effort:** 1,276 points remaining across 293 open stories, 6.71/day; board ETA 2027-05-05; release about 2027-05-16 to 2027-05-23 (low confidence).
- Measured: the board and its 7-day pace (three days at zero). Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, the real-phone sign-off.

## State

- Main checkout on `handover/2026-10-17-d` at `ef0fb44` (its CLAUDE.md is OLD: read develop's); this file not committed. develop `04aefda`.
- Worktrees: `-761` = #762's branch; `-728b` (#745), `-752` (unpushed, scratch ref `refs/floors/tooling/752-pre-push-per-commit` on origin), `-36` parked; `-728-probe` has uncommitted probe files (ask before removing).
- Backups kept 30 days: `settings.json.bak-deleting-scripts-2026-10-26`, `reference-guards-and-mechanical-edits.md.bak-deleting-scripts-2026-10-26`, the three `*floors-line*-2026-10-25`, `CLAUDE.md.bak-hook-refusal-final-2026-10-24`, `reference-engineering-standards.md.bak-hook-refusal-final-2026-10-24`, memory `MEMORY.md.bak-compact-2026-10-24`, `settings.json.bak-amend-hook-2026-10-24`, `retest.py.bak-2026-10-22-recursion`; branches `backup/*`; tags `backup/*`, `evidence/*`. Never delete early.
