# Handover: Yawelo Idle

**Written:** 2026-11-25, session `yawelo-idle-14`. Branch `handover/2026-10-17-d`. develop at a3f32322. Worktrees: `yawelo-idle-1103` (PR #1105, head 767f9439, pushed, CI running), `yawelo-idle-1074` (PR #1088, head 4d75a136, CI red), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at a3f32322). No Colima, simulator or USB claim. Real devices unavailable (Shyden via repo-template, 2026-11-25).

## Now

- **PR #1088 red on 4d75a136**: (a) board-orphans: #1093 was In Progress with no branch; moved to Todo and read back. (b) coverage 93.9% < 94%: the whole drop is `apps/site/worker/roadmap.ts` (126 -> 155 statements, all counted untested), measured from the `coverage` artifacts of runs 45441949764 and 45398129974. Cause: the gate (`scripts/coverage.ts`) never joined the Worker suites; #1093's AC4 claim was wrong (corrected on #1093).
- **#1103** filed (P1, 5 points, blocks #1074 and #1093). Shyden picked "Count server tests" (recorded on #1103). Code written in `yawelo-idle-1103`: `judgedMaps`/`workerMaps` in `scripts/coverage.ts`, `measure()` runs `npm run test:worker:coverage`, report writes `coverage-final.json` (`mappedFrom`, `lcovOf`), Sonar's separate Worker step folded into the coverage step (step 20 min, job 30), pins updated. Tests watched red (9 + 2), mutation caught (3 red). `tests/unit` 9,765 green.
- **#1104** filed (P1, 5 points, blocked by #1074, blocks #759): roadmap page shows the board at once, no failure text, socket reconnects (global freshness rule). #1074 AC4/AC5/AC7 reworded to Shyden's 2026-11-23 ruling.
- ShyTalk (shytalk-87) got Yawelo's roadmap page build description.
- New global rule 2026-11-25, "SonarCloud: always fix first" (via repo-template). Sonar read: develop has 21 open code smells, 0 dismissed, 0 hotspots. Filed **#1106** (P2, 5 points) listing all 21.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. `~/.claude/scripts/pr-verdict.sh 1105` (background). On green: read the coverage step's joined figure and confirm `apps/site/worker/roadmap.ts` is judged by the harness (the `coverage` artifact's `worker-*/coverage-final.json`). Then re-set the thresholds and the step/job limits from that run, red-first pin, and note them on #1103 (AC2/AC3). Before merging, read Sonar's issues on PR #1105 (`api/issues/search?componentKeys=shyden-labs_yawelo-idle&pullRequest=1105`) and fix every one in the PR (global rule). Merge into develop once CI is green on the head SHA.
3. After #1105 merges: merge develop into #1088 (`yawelo-idle-1074`), full unit run, push, CI; read Sonar's per-file roadmap.ts figure (#1093 AC3), then #830 AC3.
4. #1104 (P1) after #1074.
