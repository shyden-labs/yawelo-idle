# Handover: Yawelo Idle

**Written:** 2026-11-08 (fifty-third session). No Colima or device claim held. **Phones:** none needed. Shyden is AFK most of 2026-11-07 (relayed by repo-template-be): keep going by Priority, park his decisions here.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- 2026-11-08 (fifty-third session; Shyden asleep until ~11:00 +07, relayed by repo-template-27: keep going by Priority, park his decisions here). The progress page is now required at every close-out (Stop hook `progress-page-at-close-out.py`; registry URL correct).
- **#742 shut** (`file-story.ts` filed #917 live, every field read back).
- **#917 filed (P0, 3 pts):** 4 unit timeouts at 1 s on the laptop with swap at 4,362 MB and load 31; the files alone passed. A later full run passed 13,694/13,694 at swap 4,017 MB, load 6 (comment on #917).
- **#788 shut:** PR #918 merged (ec3460f0); deploy-dev run 42407592960 all green with both scripts denied (verify saw ec3460f0 on every page, D1 answered; smoke 20 passed).
- **#919 filed (P0, 1 pt), PR #920 merged (30bf6e15):** the board-orphans test no longer pins create-github-app-token's exact SHA. #919 is Todo until Dependabot #913 lands.
- My slip: #788 stayed In Progress after its branch was deleted, turning board-orphans red on three PRs; fixed (Todo) and recorded in memory.
- **#793 AC6:** Dependabot's docker run on 2026-11-07 found Node 26.12.1 current: no PR yet.

## Running (each dies with this session)

- A background waiter for Dependabot #913, #914, #915 (#913 brought up to date with `gh pr update-branch`; Dependabot refuses `@dependabot rebase` from the App).

## Resume steps

1. **Dependabot #913, #914, #915:** merge one at a time: when a PR's head contains develop's tip and every job passed on it (SHA read to a file), squash-merge with `--match-head-commit`, then `gh pr update-branch` the next (never `@dependabot rebase`: Dependabot answers "only users with push access" to the App). After #913 lands, shut #919 with its run.
2. **#917 (P0):** AC1 needs induced memory pressure on a shared 8 GB laptop; do it only when no peer session holds a heavy run (`test-lock` shows the holder).
3. **#793 AC6:** when Dependabot opens its docker PR for `.github/node`, read its setup-node log line, then shut #793.
4. **#888:** shut after 2026-11-20 with the deploy-dev tally. **#864:** watch site-smoke reds until 2026-11-19.
5. Then by board: #783 (P0) waits for the next release cut (Shyden 2026-11-05); P1s wait on Shyden (#784, #655, #830) or on #426; next P2s: #757 (waits for a cut).

## Waiting on Shyden

- (Census and #788 route answered 2026-11-07.)
- #784 next steps; the ETA confidence rule; voyage map layout (#328/#331/#452); #655 SonarCloud and `SONAR_TOKEN`; #858 where it goes; #830 copy approval.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-788` and `-919` (both merged, removable) (the 25 old ones were removed 2026-11-07).
- Open PRs: Dependabot #913, #914, #915 (rebasing); #602 (Stryker, waits for a runner release).
