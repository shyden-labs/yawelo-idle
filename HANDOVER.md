# Handover: Yawelo Idle

**Written:** 2026-10-31 (thirty-second session). Shyden is away until the afternoon of 2026-11-01 (relayed by the repo-template session): keep working; anything needing him waits here.
**Running when written:** a local unit run for #818 (`npm run test:unit` in `../yawelo-idle-818`), queued behind another session's test lock. It dies with `/clear`: treat it as DEAD and re-run it (step 1).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. board-next names #768 first, but #768 and #783 wait only on Shyden (below), so take the #813 children.

## Done this session

- #819 merged (PR #820, squash `d3b1255`), closed by hand with AC evidence; worktree removed.
- #768 moved In Progress → Todo (no branch names it).
- #818: branch `test/818-real-pre-push`, worktree `../yawelo-idle-818`, commit `afb2b0f` (committed, NOT pushed). The integration test runs the real hook on repo copies (node_modules symlinked): clean passes; format/lint/type cases each plant that break plus every later gate's break, and assert the later files are not named. Integration step limit 1 → 5 min. Hook (format, lint, typecheck) green locally; board set to In Progress.
- #817: AC1 research posted on the ticket. Corrupt local D1 file gives a real `internal error`; `createTestHarness` runs `persist: false`, so the plan is a Worker started with `unstable_startWorker` and a persist dir holding the corrupt file.

## Next

1. In `../yawelo-idle-818`: `npm run test:unit` (background). If green, push, open PR into develop (`Refs #818`), run `~/.claude/scripts/pr-verdict.sh <pr>` in the background. In the CI log, see the five pre-push cases pass in "Integration tests", and read that step's time. If it is well under 5 min, set the limit from that measurement in the same PR before merge.
2. Then #817 by the plan on the ticket, then #815 and #816 (dev Workers).
3. If a Dependabot PR fails on the missing roadmap key, tell Shyden (ruling on #814).

## Waiting on Shyden

- **#814 test board:** he chose one-time consent. He runs this in his own terminal, then I run the same call once and read the title back:
  ```
  cat > ~/.claude/allow-operator-gh-once <<'EOF'
  gh api graphql -f 'query=mutation{createProjectV2(input:{ownerId:"O_kgDOEOcG5w",title:"Yawelo Idle Roadmap Test Board",repositoryId:"R_kgDOU2Ed2Q"}){projectV2{id number title}}}'
  EOF
  ```
  The board is then made by his account; check the App can read and write it before recording its node id in CLAUDE.md.
- #768: old bucket and r2.dev address off. #783: a planted non-release PR into main seen refused (his to open, or the next release). #784, #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Dead worktrees, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-10-31)

- By tickets: 35% (151 of 426), pace 1.57 a day, ETA 2027-04-24 (low confidence: 4 of 7 days moved nothing).
- By effort: 1,191 points remaining across 275 open stories, pace 3.71 a day, ETA 2027-09-17 (low confidence). Both before outside waits (#784's login, device sign-off).
