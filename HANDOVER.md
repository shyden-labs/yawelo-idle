# Handover: Yawelo Idle

**Written:** 2026-11-08 (fifty-seventh session). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- 2026-11-08 (fifty-seventh session, continued). Parked questions answered earlier today: #858 (support link; shyden.co.uk ruled it Yawelo Idle's only, nothing filed there), #828, #452, #103 split to #922.
- **#655 SonarCloud:** PR #923 merged into develop as `f8f8d0af` (the integration list now has `scripts/sonar-verdict.ts`; first scan's S4624 fixed; **S9382 accepted by Shyden**, recorded on #655). CI was green on the head, every step run: `sonar-coverage`, `sonarcloud` (gate OK, so the `sonarcloud` environment's token works), build-and-test, coverage, board-orphans. **PR #924** (`655-sonar-required`, head `9808c1e80074b052275d83f931c5242472846759`, worktree `../yawelo-idle-655`): pins both Sonar jobs in `tests/unit/required-checks.test.ts`; watched red; unit 13,792/13,792.

## Running

- A local waiter on PR #924's CI (dies with `/clear`; re-run `~/.claude/scripts/pr-verdict.sh 924`, which can return early while runs are queued).

## Resume steps

0. `ListAgents`, then board-next. #655 (P1) is in hand.
1. **PR #924:** green on head (steps by name) → squash-merge. Then make **both** `sonar-coverage` and `sonarcloud` required (app 15368) on develop (adds to build-and-test, board-orphans, coverage; strict) and main (adds to build-and-test), and read protection back (AC1).
2. **AC5:** prove one real Dependabot PR is scanned and its verdict read (Dependabot gets the Dependabot copy of `SONAR_TOKEN`). **AC6** and the DoD's "one planted ERROR watched red": check what the ticket's comments already prove; fill any gap. Then shut #655.
3. Then #103 (unique ids, no empty strings), M2. #830: draft the roadmap page text and park the approval question here.
4. **On a repeat of the 1 s unit timeouts** (#859, #917): measure swap, load, `memory_pressure`, busy sessions; file a ticket.
5. **#793 AC6:** when Dependabot opens its docker PR for `.github/node`, read its setup-node log line, then shut #793. **#888:** shut after 2026-11-20 with the deploy-dev tally. **#864:** watch site-smoke reds until 2026-11-19.
6. By board: #783 (P0) waits for the next release cut; #784 waits for the phone.

## Waiting on Shyden

- Delete the repo-wide Actions `SONAR_TOKEN` (`gh secret delete SONAR_TOKEN --repo shyden-labs/yawelo-idle`; keep the Dependabot copy). Optional: mark S9382 Accepted in SonarCloud. The second Android phone for the Yawelo Gmail (#784). #830 copy approval.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-655`.
- Open PRs: #602 (Stryker, waits for a runner release), #924 (#655).
