# Handover: Yawelo Idle

**Written:** 2026-11-08 (fifty-third session). No Colima or device claim held. **Phones:** none needed. Shyden is AFK most of 2026-11-07 (relayed by repo-template-be): keep going by Priority, park his decisions here.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- 2026-11-08 (fifty-third session): **#742 shut**: `file-story.ts` filed #917 live, every field read back (comment on #742).
- **#917 filed (P0, 3 pts):** the whole unit suite on the laptop had 4 timeouts at 1 s (dev-config x2, golden-vectors, golden-log slice 99) with swap at 4,362 of 5,120 MB and load 31; the same files alone passed 4,579/4,579. A repeat of #859, measured as its ruling asks.
- **#788 AC2/AC3:** branch `788-deny-install-scripts` (worktree `../yawelo-idle-788`), commit a4c322d9, **PR #918** into develop. `allowScripts` denies esbuild and workerd; unit tests (bare names, all false, every locked script package named) seen red, 4 mutants killed. Measured with both denied: `npm ci` no warning; `wrangler dev` sync `/health` 200 `db: ok`, web `/play/` 200. #788 In Progress.

## Running (each dies with this session)

- Nothing. PR #918 CI was in progress at handover (head a4c322d9).

## Resume steps

1. **PR #918:** `~/.claude/scripts/pr-verdict.sh 918` (it can return while in progress: re-read the jobs by name). When every required check passes on the head SHA (read `headRefOid` to a file), squash-merge into develop. Then measure the real dev deploy (deploy-dev run green, `dev.yawelo-idle.shyden.co.uk` and the sync Worker `/health` answer) and shut #788 with the evidence; if the deploy breaks, back to Shyden with the measurement.
2. **#793 AC6:** when Dependabot opens its docker PR for `.github/node`, read its setup-node log line, then shut #793.
3. **#917 (P0):** reproduce under induced memory pressure per its AC1.
4. **#888:** shut after 2026-11-20 with the deploy-dev tally. **#864:** watch site-smoke reds until 2026-11-19.
5. Then by board: #783 (P0) waits for the next release cut; P1s wait on Shyden (#784, #655, #830) or on #426; next P2s: #757 (waits for a cut).

## Waiting on Shyden

- (Census and #788 route answered 2026-11-07.)
- #784 next steps; the ETA confidence rule; voyage map layout (#328/#331/#452); #655 SonarCloud and `SONAR_TOKEN`; #858 where it goes; #830 copy approval.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-788` (the 25 old ones were removed 2026-11-07).
- Open PRs: #918 (#788, CI running), #602 (Stryker, waits for a runner release).
