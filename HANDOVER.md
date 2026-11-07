# Handover: Yawelo Idle

**Written:** 2026-11-08 (fifty-third session). No Colima or device claim held. **Phones:** none needed. Shyden is AFK most of 2026-11-07 (relayed by repo-template-be): keep going by Priority, park his decisions here.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- 2026-11-08 (fifty-third session; Shyden asleep until ~11:00 +07, relayed by repo-template-27: keep going by Priority, park his decisions here). The progress page is now required at every close-out (Stop hook `progress-page-at-close-out.py`; registry URL correct).
- **#742 shut** (`file-story.ts` filed #917 live, every field read back).
- **#917 filed (P0, 3 pts):** 4 unit timeouts at 1 s on the laptop with swap at 4,362 MB and load 31; the files alone passed. A later full run passed 13,694/13,694 at swap 4,017 MB, load 6 (comment on #917).
- **#788:** PR #918 squash-merged (ec3460f0) after every job passed on head a4c322d9: `allowScripts` denies esbuild and workerd. `wrangler dev` measured working with both denied. Open only for the real dev deploy (resume step 1).
- **#919 filed (P0, 1 pt) and PR #920 open:** `board-orphans-workflow.test.ts` pinned create-github-app-token's exact SHA, so Dependabot #913 (3.3.0) went red. Branch `919-token-pin-test`, worktree `../yawelo-idle-919`, commit 2745fadf.
- **#793 AC6:** Dependabot's docker run on 2026-11-07 found Node 26.12.1 current: no PR yet.

## Running (each dies with this session)

- A background waiter on PR #920, #914, #915 and deploy-dev run 42407592960. If this session is gone, re-run the steps below by hand.

## Resume steps

1. **#788:** read deploy-dev run 42407592960 (develop ec3460f0) job by job; if green, check `https://dev.yawelo-idle.shyden.co.uk/play/` and the sync Worker `/health` answer, comment the evidence on #788 and shut it. If the deploy broke, back to Shyden with the measurement.
2. **PR #920 (#919):** when every job passes on its head (SHA read to a file), squash-merge; then `@dependabot rebase` on #913, wait for it green, squash-merge it, shut #919.
3. **Dependabot #914, #915:** squash-merge each once green on its head (Dependabot rebased both onto ec3460f0).
4. **#917 (P0):** AC1 needs induced memory pressure on a shared 8 GB laptop; do it only when no peer session holds a heavy run (`test-lock` shows the holder).
5. **#793 AC6:** when Dependabot opens its docker PR for `.github/node`, read its setup-node log line, then shut #793.
6. **#888:** shut after 2026-11-20 with the deploy-dev tally. **#864:** watch site-smoke reds until 2026-11-19.
7. Then by board: #783 (P0) waits for the next release cut (Shyden 2026-11-05); P1s wait on Shyden (#784, #655, #830) or on #426; next P2s: #757 (waits for a cut).

## Waiting on Shyden

- (Census and #788 route answered 2026-11-07.)
- #784 next steps; the ETA confidence rule; voyage map layout (#328/#331/#452); #655 SonarCloud and `SONAR_TOKEN`; #858 where it goes; #830 copy approval.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-788` (merged, removable), `-919` (the 25 old ones were removed 2026-11-07).
- Open PRs: #920 (#919), Dependabot #913 (red until #920), #914, #915; #602 (Stryker, waits for a runner release).
