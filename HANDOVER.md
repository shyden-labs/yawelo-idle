# Handover: Yawelo Idle

**Written:** 2026-10-16 (UTC). Nothing runs locally or in CI for this session. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board, not this file, picks the next ticket.

## Progress (`node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 27% complete** (98 of 357). Pace 3.43 a day (8, 0, 0, 10, 3, 2, 1). Board ETA 2026-12-30 before outside waits. **ETA to release-ready: 2027-01-18 to 2027-01-26** (low confidence).
- **By effort: 1,188 points remaining** across 259 open stories. Pace 15.43 points a day. Board ETA 2026-12-31. **ETA to release-ready: 2027-01-19 to 2027-01-30** (low confidence).
- **Measured:** counts, paces, board ETAs. **Assumed:** about 30 unfiled prestige stories (130–180 points), 1.5–2.5 weeks of outside waits.

## #580 (In Progress): merged, AC4 waits on Shyden

- PR #600 merged into develop at `89bbd39` (CI green on head `aa8ba92`: build-and-test, every-commit, board-orphans). Dev deploy run 38777956617 green: deploy, verify, smoke, dev-verified.
- Live check on #600: "No orphans: 1 ticket In Progress, each named. Read 390 board items, 38 branches, 6 open pull requests."
- `board-read` environment admits only `refs/pull/*/merge` and holds the NEW roadmap App key (`SHA256:NnsJHVNF…h88utY=`, old key untouched; the downloaded file was deleted).
- **Shyden's rulings:** Dependabot PRs skip by name (2026-10-15). **Merged counts till closed** (2026-10-16): a branch with a merged PR names its ticket until the ticket closes. Recorded on #580, in the global reference (backup `.bak-merged-counts-2026-10-16`), and in `~/.claude/global-rules/pending-merged-branch-counts-till-closed.md` for repo-template and ShyTalk.

## Resume steps

1. `ListAgents`; `node -v` (26); `board-next.ts`.
2. Read back develop's required checks: `gh api repos/shyden-labs/yawelo-idle/branches/develop/protection/required_status_checks`. It must list `board-orphans` (Shyden runs the add; the agent App gets 403).
3. Then write the AC ledger on #580 (AC1–4, the skip, the merged rule, each with its test or run) and close it by hand.
4. Then the board.

## Waiting on Shyden

- Add `board-orphans` to develop's required checks, in a normal terminal: `gh api -X POST repos/shyden-labs/yawelo-idle/branches/develop/protection/required_status_checks/contexts -f 'contexts[]=board-orphans'`.
- Delete the throwaway branches `test/341-mutations` (remote) and `backup/341-drift-check-3-commits` (local)?
- Install the shyden.co.uk close hook (`shyden.co.uk/.superpowers/sdd/hook-close-check/`). `handover/overnight-2026-10-05` local commit; Spotlight privacy; `gh api …/logs` hook; Docker for #467; #451 AC3; #343; #333, #425/#426, #345, #455.
- He keeps `~/roadmap-webhook-secret.txt`. The dev password was shared in chat; changing it is his call.

## State

- `develop` at `89bbd39`. Worktree `yawelo-idle-341-gate` detached at `ae4cdec`, clean.
- Session files (git-ignored): `.superpowers/sdd/580/` (mutation runner and logs, PR body, comments), `.superpowers/sdd/341/`.
