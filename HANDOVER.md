# Handover: Yawelo Idle

**Written:** 2026-10-15 ~05:00 UTC. Nothing local is running. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board, not this file, picks the next ticket.

## Progress (from `node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`, 2026-10-15)

- **By tickets: 28% complete** (98 of 353 in-scope stories closed). Measured pace 3.43 a day over 7 days (ETA at that pace 2026-12-29). **ETA to release-ready: 2027-01-17 to 2027-02-05** (low confidence).
- **By effort: 1,173 points remaining** across 255 open stories. Measured pace 15.43 points a day (ETA at that pace 2026-12-31). **ETA to release-ready: 2027-01-18 to 2027-02-02** (low confidence).
- **Measured:** counts and paces. **Assumed:** about 30 unfiled prestige stories (130–180 points) and 1.5–2.5 weeks of outside waits (stores, reviews).

## Done this session

- **#341 closed** (live roadmap backend). PR #438 rebased onto develop, floors recorded in CI (42 moved, all traced to the commit's 19 added files), merged at `b1f95e5`; dev verified (run 38677167609). Shyden added the org webhook (hook 698318626); signed deliveries got 202; health `lastEventAt` moved; a live test with Issues set to write turned health red (`readFailingSince`, exact `readError`) and recovered by the webhook once set back; R6 measured on dev in Chromium, Firefox and WebKit with no-password controls. Closing ledger 8 of 8 ACs, 5 of 5 DoD on #341.
- **#536**: the four 2026-10-14 timeouts measured (at most 29 ms own CPU vs 1.0–1.8 s wall at load 35–54 on 6 cores); evidence on #536. I had first called it "load" on one pass; a side agent caught it (memory `feedback-a-pass-does-not-clear-a-timeout`).
- `~/.claude/CLAUDE.md` went over its ceiling from the shyden.co.uk session's #138 clause; that session trimmed it.

## Resume steps

1. `ListAgents`; `node -v` (26). Then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` (it gave **#580**, P1: the PR gate fails while a ticket is In Progress with no branch or open PR naming it; Shyden's refinement is on the ticket).
2. Then #586 (P2, `scripts/record-floors.ts` dead `unrecordable` path) when the board reaches it.

## Lessons (memory)

- A later pass never clears a timeout: read the sampler at the failing minute and measure each test's own thread CPU.
- `global-rules-size.py` blames whichever session runs Bash next; read `global-rules/reference/claude-md-edits.log` first and tell the writer.
- `cmd | tail && next` is refused: use `cmd >/dev/null 2>&1; echo rc=$?`.
- A webhook saved before its secret sends an unsigned ping (401); test with a real event instead.

## Waiting on Shyden

- `handover/overnight-2026-10-05`: one local-only commit, kept until you say.
- From before: Spotlight privacy for `~/Developer/Repos`; the `gh api …/logs` hook; Docker for #467; #451 AC3; #343 Buttondown; #333, #425/#426, #345, #455.
- Shyden keeps `~/roadmap-webhook-secret.txt` (his choice; never ask him to delete it). The dev password was shared in chat on 2026-10-15; changing it is his call.
- claude-mem's observer allowance has been exhausted since 2026-10-14 18:12 UTC (do not restart the worker).

## State

- `develop` at `b1f95e5` plus this file's PR. No open PRs of mine besides it.
- Worktrees: `../yawelo-idle-341` and `../yawelo-idle-577` (both merged, removable), `-341-gate`, `../yawelo-idle-develop-bench`.
- Session files (git-ignored): `.superpowers/sdd/341/` (ledger, comments, `r6/dev-probe.mjs`), `.superpowers/sdd/536/evidence-2026-10-14-timeouts.md`, `.superpowers/sdd/unrecordable/` (#586 filer).
