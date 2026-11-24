# Handover: Yawelo Idle

**Written:** 2026-11-24 19:55 WIB, session `yawelo-idle-b6`. Branch `handover/2026-10-17-d`. develop at 6f04f065. Worktrees: `yawelo-idle-1093` (PR #1094, draft, head dff0ed25: develop merged in as da6ab4fd, then the threshold raise), `yawelo-idle-1074` (PR #1088, draft), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at 6f04f065). No Colima, simulator or USB claim. Phones are plugged in (Shyden via repo-template, 19:3x WIB) but not needed: #992/#993 are blocked by playwright-devices#7.

## Now

- **#1093 AC2 met:** CI on b98f93ba all green; `sonar-coverage`'s `worker-apps__door__wrangler/lcov.info` lists `apps/door/worker/index.ts` LF 2 LH 2, FNF 2 FNH 2 (evidence on the ticket).
- **#1093 AC4:** thresholds raised 85/76 → 94/82 in dff0ed25 (pin test red first), from run 45354626088: 94.0% / 82.3%. Margin is thin (about 14 statements), so read the coverage step on dff0ed25. Met only once CI passes it.
- **#1093 AC3** still open: PR #1088's Sonar per-file figure for `apps/site/worker/roadmap.ts` (only after #1094 merges and #1088 is updated).
- **#971 repeats today**, posted: full laptop unit runs failed on 1 s timeouts only (2, then 1), load 60 then a peak of 148 (2 s samples), and the same tests pass alone in 22–88 ms. dff0ed25 was pushed with that laptop run red on the timeout alone.
- All P0s wait on Shyden: #784, #860, #1013, and #992–#1000 (playwright-devices#7).

## For Shyden (parked questions)

1. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`).
2. #784: delete the old DEV key `cfat...c5dc`; approve the next production release.

## Resume steps

1. `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach it at origin/develop first).
2. dff0ed25 was pushed at 19:55 WIB; CI started on it then.
3. `~/.claude/scripts/pr-verdict.sh 1094` (background); read each job by name, and the coverage step's two figures, against 94/82. If green: `gh pr ready 1094`, squash-merge into develop (SHA from a file), clean the worktree and branches. If coverage fell below the threshold, re-measure and set the threshold to the measured figure, test first.
4. Then #1074 (PR #1088): merge develop in, full unit run, push; read Sonar's per-file `roadmap.ts` coverage for #1093 AC3; then #830 AC3.
