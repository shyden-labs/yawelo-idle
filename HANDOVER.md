# Handover: Yawelo Idle

**Written:** 2026-11-28 18:39 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at 62fd7bcb (#1156). main at e9345241. No Colima, simulator or USB claim held. board-next: #1078 (P0).

## In flight

| Item | State |
| --- | --- |
| **#1157** (#1078 AC3 part b, draft) | Branch `1078-door-required`, worktree `../yawelo-idle-1078b`. **Pushed head 6b339cc5** (4 code commits + sync harness test fix); its CI is running (`~/.claude/scripts/pr-verdict.sh 1157`, the waiter in this session dies on /clear). Previous run 46126426171 read red by name: 105 site/roadmap names as planned, plus 38 sync Worker harness tests from one unplanned gap (8d38326d made the sync Worker require its door, its tests sent no secret), fixed by 6b339cc5. Names on #1078 (comment 7238688931). Laptop unit at 6b339cc5: 15134/15135, the one failure the #1123 timing flake (10.73 vs 10), recorded on #1123 (comment 7238716158). |
| #986 (draft) | #160, untouched. |

## Done this session

- #1156 merged 62fd7bcb (every check green on head 0b2d5414, steps read by name). Its develop deploy-dev run 46124634004 green on every job; #1155 closed by hand with that evidence (comment 7236618593). #1154's one-off `/` "no data-dev-strip" verify failure did not recur. Worktree and branches removed.
- #1078 part (b): CI-only harness tests rewritten (door secret stands in for the door; without it 403 `forbidden` on every path, webhook and robots included); verify-dev, verify-dev-hosts, site smoke config, deploy-dev and dev-config moved off the password, each red first locally (mutations run once on the new assertions). Unit 15169/15169 at 6774f9b8.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. (Done: red names recorded on #1078.)
3. `~/.claude/scripts/pr-verdict.sh 1157` (head 6b339cc5); if red, read the failures by name; read every check green on the head SHA by step, mark #1157 ready, squash-merge (`--match-head-commit` from a file).
4. Read develop's deploy-dev by step name: verify ("Verify dev is behind its door, …"), verify-roadmap, site-smoke (now at dev.yaweloidle.com with the DEV pass).
5. Then (Shyden): check the site Worker holds no leftover `DEV_PASSWORD` secret, then delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment. Then #1078 AC5 (Safari/Firefox/Edge sign-in).

## Parked for Shyden

- Safari/Firefox/Edge sign-in once AC3 is live (#1078 AC5).
- Buttondown (#343): once the second free account exists, its API key goes in as a dev environment secret. The live `yawelo` account's keys stay untouched.
- After part (b) deploys: delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment.
- #1152 AC4: read the next release's deploy-prod run, then close.

## Devices

#1149 (P0) blocks #992/#993, and those also wait on playwright-devices#68 (0.2.2; playwright-devices-25 messages when it's on npm). Yawelo has no device code yet.
