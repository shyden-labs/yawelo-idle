# Handover: Yawelo Idle

**Written:** 2026-11-02 (thirty-fifth session). **Phones unavailable: no device work until Shyden says.** Shyden AFK until 13:00 (relayed): keep working by Priority, park his decisions.
**Running when written:** nothing local. External: PR #835 CI on `2898c1c`.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. Skip #768 and #783 (wait on Shyden).

## Done this session

- #827 merged (PR #832, squash `d35415e`) after screen tests for Island/VoyageMap (#804 coverage); shut with dev evidence (site-smoke 33 passed, 39 s vs 3-min limit: no change).
- #833 merged (PR #836, squash `be82401`) and shut: ESLint `no-unused-vars` `args: all` + `_` escape; guard `tests/guards/unused-parameters.test.ts`. Worktree -833 removed.

## Next

1. **PR #835 (Refs #828)**, worktree `../yawelo-idle-826`, branch `feat/828-roadmap-figures`, pushed head `2898c1c` (svelte-gates list fix after the first CI run). Summary screen `RoadmapSummary.svelte` + `summary.ts`; local unit 12,846 green. Re-read CI with `gh pr checks 835 --watch` then `~/.claude/scripts/pr-verdict.sh 835`; merge if green on head; read deploy-dev's site-smoke (2 new summary tests); then shut the ticket by hand.
2. **#829** (live updates): the Worker's `/api/roadmap/live` socket sends the full snapshot on connect and each new version. Plan: VoyageMap opens the socket after the JSON read, replaces `snapshot` on each message, shows "live"/"not live"; AC3 needs a real board edit timed on dev (target < 10 s). Start from develop after PR #835 merges.
3. #830 waits on Shyden's copy approval (summary placeholders: `apps/site/src/copy.ts`, `VOYAGE_PLACEHOLDER.summary`).

## Waiting on Shyden

- **Test board** (shyden-labs project 6): keep or delete, his call.
- **ETA confidence rule** (#828, mine): high at 6–7 of 7 days moved, medium 4–5, low otherwise; his to change.
- **Voyage order:** where the three epics with no milestone (#328 prestige, #331 website, #452 analytics) sit on the voyage; default now: after M8, by issue number (`byDelivery` in `apps/site/src/roadmap/voyage.ts`).
- **Other work:** 46 open stories have no epic; the map counts them in one "other work" line, on no island (default, PR #831).
- #768: old dev bucket's r2.dev address off (Shyden: in the morning, 2026-11-02). #783: a planted non-release PR into main seen refused (his to open, or the next release). #784, #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Dead worktrees, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-02)

- By tickets: 37% (157 of 430), pace 2.43 a day, ETA 2027-02-22 (medium confidence: 4 of 7 days moved).
- By effort: 1,177 points remaining across 273 open stories, pace 5.86 a day, ETA 2027-05-21 (medium confidence). Both before outside waits (#784's login, device sign-off).
