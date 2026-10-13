# Handover: Yawelo Idle

**Written:** 2026-10-13 ~03:10 UTC. Nothing local is running. The #536 load sampler still runs under launchd and survives a restart.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board, not this file, picks the next ticket.

## Progress (from `node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 27% complete** (94 of 352 in-scope stories closed). Measured pace 5.00 a day over 7 days (ETA at that pace 2026-12-04). **ETA to release-ready: 2026-12-25 to 2027-02-02** (low to medium confidence).
- **By effort: 1,193 points remaining** across 258 open stories. Measured pace 22.29 points a day (ETA at that pace 2026-12-06). **ETA to release-ready: 2026-12-21 to 2027-01-31** (low to medium confidence).
- **Measured:** counts and paces. **Assumed:** as before, about 30 unfiled prestige stories (130–180 points) and 1.5–2.5 weeks of outside waits. #575: the pace counts today as a whole day.

## Done this session

- New global rules applied here: the board's **Priority** (P0–P5) picks the next ticket; **blockers inherit** (Shyden 01:03); **milestone tiers** (Shyden 01:00, on #578); **off-board blocker = note** (Shyden 01:51); **In Progress only with a branch or open PR**; **no typed UTC header**.
- **#576 closed** (PRs #579 and #582): `scripts/board-setup.ts` created the Priority field; `scripts/board-next.ts` works on the real board. Dev verified at `1e27486`.
- **#577**: 417 Blocked by links and 244 sub-issues written and read back (one GraphQL snapshot). PR #584 adds the story-form line.
- **#578**: all 287 open tickets scored and read back (P1 5, P2 25, P3 142, P4 106, P5 9; 53 raised by inheritance). Table on #578.
- **Orphans**: #6, #432 and #536 moved back to Todo. **#580** filed (orphan check in the PR gate, with Shyden's refinement on it).
- **#581 (P0) closed** (PR #583): dev verify failed at `fe586f9` because `/roadmap` still served the previous commit 2 s after the home page moved on. Verify now waits on every page. **Dev verified at `1369d71`** (run 38339817141).
- **#341**: AC8 a–d done. App `yawelo-idle-roadmap` (ID **5294556**), installed on yawelo-idle only (installation 170821713, read back). Dev secrets set by Shyden in his terminal.

## Resume steps

1. `ListAgents`; `node -v` (26). Then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`.
2. **PR #584 (#577)**: labelled `record-floors`. Run `npm run floors:fetch <run-id>`, amend into the one commit, force-push, and merge when CI is green. Then close #577 and #578. #578's AC4 is this file, which no longer orders work.
3. **#341 (P1, PR #438)**: put App ID `5294556` in the Worker config (replacing whatever stands in for it there). Get #438 green, merge, and deploy dev. Read `/api/roadmap/health`. Then walk Shyden through **step e** (org webhook; the secret is in his `~/roadmap-webhook-secret.txt`, which he deletes afterwards). AC8 (ii)/(iii) read-backs follow.
4. **#536** lock from about 16:46 UTC today: the old resume step is in `git show 83681f4:HANDOVER.md`.

## Lessons recorded

- An unquoted heredoc runs Markdown backticks as commands; quote it and pass argv (memory).
- A coordinate click after a picker landed on **Install**; on pages with a submit button, click by ref and get the OK first (memory).
- This laptop's connection to api.github.com reset every few minutes during long REST loops; read via one paginated GraphQL query, and make writers resumable.

## Waiting on Shyden

- **#341 step e**, once #438 deploys to dev (I'll walk it through).
- `handover/overnight-2026-10-05`: one local-only commit, kept until you say.
- From before: Spotlight privacy for `~/Developer/Repos`; the `gh api …/logs` hook; Docker for #467; #451 AC3; #343 Buttondown; #333, #425/#426, #345, #455.

## State

- `develop` at `1369d71`, plus this file. Open PRs: #438 (#341), #584 (#577).
- Worktrees: `../yawelo-idle-341`, `-341-gate`, `../yawelo-idle-develop-bench`.
- Session tools (git-ignored): `.superpowers/sdd/board-priority/` (filers, classify.py, link.py, score.py, set-priority.py, PR texts).
