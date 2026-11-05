# Handover: Yawelo Idle

**Written:** 2026-11-05 (forty-first session). Shyden AFK. **Phones: not authorised; no device work.**
**Running when written (all outside waits; nothing local):** CI on PR #881 (head `fe82893f`) and on PR #882 (head `eb8e4b31`). Read them with `~/.claude/scripts/pr-verdict.sh 881` and `~/.claude/scripts/pr-verdict.sh 882`.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session (forty-first)

- **PR #880 (#464) merged** into develop as `21bc77b7` (squash, after every check passed on `9270463f`). Dev deploy run 41975689132 passed every job (dev-verified included), and #464 is shut. Its worktrees `-464` and `-464b` are removed.
- **#863 is in PR #882** (branch `fix/863-harness-coverage`, worktree `../yawelo-idle-863`). `COVERAGE_EXCLUDE` gains `apps/*/test/**`. Seven new tests were seen red first (4 failed). The one-time mutation pass caught both mutants (`apps/**` and `**/test/**`). Unit suite: 13,023 passed. The board shows In Progress.

## Resume steps

1. PR #881 conflicted with develop after #880 landed. Develop is merged in as `fe82893f`: `tests/integration/script-loads.test.ts` keeps both new lines. Typecheck clean; unit suite 13,028 passed. When it is green, merge it (squash, `--match-head-commit` from a file), check dev, then shut issue 873 by hand. That leaves #720 blocked only by #710. #720's audit step should run `node scripts/npm-audit.ts`.
2. When PR #882 is green, read the new overall figure from its `coverage` job and quote it on #863. Then merge, check dev and shut issue 863 by hand.
3. #783: there is nothing to do until the next release cut. Then watch `release-cut` refuse a non-cut head.
4. Then a P2 with no blocker: #874 (ts-fsrs 6), #402, #497, #513 or #523.

## Waiting on Shyden

- #784 next steps (Gmail, Cloudflare, domains).
- Deleting test board project 6.
- The ETA confidence rule.
- Voyage map layout (#328/#331/#452).
- #655: his SonarCloud project and a `SONAR_TOKEN`.
- #858: where it goes.
- #830: approving its copy.
- Open PRs with no recent movement: #602 (waits on a Stryker runner release), #745, #767, and Dependabot #593, #594, #597, #750, #763, #764, #779 and #834.

## State

- The main checkout is on `handover/2026-10-17-d` (handover commits only).
- Worktrees: `-863` (PR #882), `-873` (PR #881), `-591` and `-871` (both merged; can be removed), `-dev-scripts`. Older ones are kept until Shyden says: `-36`, `-728b`, `-761`, `-752`, `-794`, `-728-probe`.
- Kept local branches: nine `backup/*`, and `tooling/785-nvmrc-exact` `-b`, `-c` and `-d`.

## Progress (board, measured 2026-11-05)

- By tickets: 40% (179 of 447). Pace is 5.14 a day over the 7 finished days to 2026-11-04. ETA 2026-12-28, medium confidence (6 of 7 days moved).
- By effort: 1,162 points remaining across 268 open stories. Pace is 14.00 a day. ETA 2027-01-27, medium confidence.
- Both ETAs are before the outside waits: #784's login and device sign-off.
