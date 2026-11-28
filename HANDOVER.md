# Handover: Yawelo Idle

**Written:** 2026-11-28 19:35 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at 7c950984 (#1157). main at e9345241. No Colima, simulator or USB claim held. board-next: #1078 (P0); #1123 (P0) in hand because it stopped develop's deploy.

## In flight

| Item                   | State                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1159** (#1123)      | Branch `1123-no-email-steps`, worktree `../yawelo-idle-1123`, head 3fc9bd2d, CI running (`~/.claude/scripts/pr-verdict.sh 1159`; this session's waiter dies on /clear). The scan counts the characters it reads and the test judges the count (2.0 to 4.5 per character, limit 8), no clock. Red first, mutations once, laptop unit 15136/15137 at load 21 to 95 (the one failure #1158). |
| **#986** (#160, draft) | Branch `160-save-backups`, worktree `../yawelo-idle-160`, head 1d6f3b00: develop merged in (two conflicts kept both sides), Sonar S3358 + S9382 fixed (Sonar now 0 open). Every check green, but **behind** develop.                                                                                                                                                                      |
| develop deploy         | deploy-dev run 46143489283 (7c950984) **failed at Unit tests** on the #1123 test (12.22 vs 10): nothing of #1157 is deployed yet. The next develop merge redeploys it.                                                                                                                                                                                                                    |

## Done this session

- #1157 merged 7c950984 (one missed harness call fixed, 93168858: the production-host POST check now sends the door secret like its siblings). Every step green on its head by name, the only skip the Edge cache save. Worktree and branches removed.
- Filed #1158 (P0, 2): the voyage map socket-drop test failed once in the full suite under load, error not captured.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. `~/.claude/scripts/pr-verdict.sh 1159`; read every step green on the head SHA by name, mark ready, squash-merge (`--match-head-commit` from a file). Then remove worktree `../yawelo-idle-1123` and its branches.
3. Read develop's deploy-dev by step name: Unit tests, verify ("Verify dev is behind its door, …"), verify-roadmap, site-smoke (dev.yaweloidle.com with the DEV pass). Green: close #1123 by hand with the evidence (AC2's "old regex restored" was stood in by a quadratic mutation of the hand scan; say so).
4. #986: `gh pr update-branch 986`, wait for green, update its body (it still says "red stage"), mark ready, squash-merge. #160 stays open (AC6 every target; wiring into the game is not in it).
5. Then (Shyden): check the site Worker holds no leftover `DEV_PASSWORD` secret, then delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment. Then #1078 AC5.

## Parked for Shyden

- Safari/Firefox/Edge sign-in once AC3 is live (#1078 AC5).
- Buttondown (#343): once the second free account exists, its API key goes in as a dev environment secret. The live `yawelo` account's keys stay untouched.
- After part (b) deploys: delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment.
- #1152 AC4: read the next release's deploy-prod run, then close.

## Devices

#1149 (P0) blocks #992/#993, and those also wait on playwright-devices#68 (0.2.2; playwright-devices-25 messages when it's on npm). Yawelo has no device code yet.
