# Handover: Yawelo Idle

**Written:** 2026-11-25, session `yawelo-idle-14`. Branch `handover/2026-10-17-d`. develop at a3f32322. Worktrees: `yawelo-idle-1103` (PR #1105, head 767f9439, pushed, CI running), `yawelo-idle-1074` (PR #1088, head 4d75a136, CI red), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at a3f32322). No Colima, simulator or USB claim. Real devices unavailable (Shyden via repo-template, 2026-11-25).

## Now

- **PR #1105 (#1103)** head 1088e994: thresholds re-set from run 45509404083 (94.8% / 83.4% -> 94 / 83, pin red first), Sonar S9382 dealt with; evidence on #1103. Every check green but `sonar-coverage`, which failed on the flaky test below (not a #1103 defect). No re-run: #1107 first, then update-branch.
- **#1107** filed (P0, 3 pts, blocks #1103): `apps/site/test/roadmap/routes.test.ts` "refuses a body over 1 MiB" sometimes reads ECONNRESET instead of 413 (2 of the last 40 sonarcloud runs). Hypothesis, unmeasured: the Worker's early 413 (from Content-Length, body unread) drops the socket while the client is still uploading. Worktree `yawelo-idle-1107` branch `probe/1107-early-413`, **draft PR 1108 = scratch probe** (`probe-1107.test.ts`, fails on purpose and prints `PROBE-1107 {...}`: raw-socket events + 200-repeat outcome counts). Never merge it; shut it once read; the real change goes on a fresh branch `1107-hook-413-reset` from develop (TDD).
- **#784**: old key `cfat...c5dc` deleted from the Non-Prod account (Shyden's ruling, recorded on #784). Next: confirm the next develop deploy passes without it.
- #1104 (P1) after #1074; #1106 (P2) Sonar smells.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. Read PR 1108's `PROBE-1107` line (`gh run view <run> --log-failed 2>&1 | grep PROBE-1107`), record it on #1107 AC1, shut PR 1108 and delete its branch.
3. #1107 on a fresh branch from develop, red first; PR; merge on green.
4. Update #1105 from develop, CI green, merge. Then #1088 (`yawelo-idle-1074`): merge develop, unit run, push; #1093 AC3, #830 AC3.
