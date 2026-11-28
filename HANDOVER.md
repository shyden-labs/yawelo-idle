# Handover: Yawelo Idle

**Written:** 2026-11-28 15:36 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at 62fd7bcb (#1156). main at e9345241. No Colima, simulator or USB claim held. board-next: #1078 (P0).

## In flight

| Item | State |
| --- | --- |
| **#1157** (#1078 AC3 part b, draft) | Branch `1078-door-required`, worktree `../yawelo-idle-1078b` (own `npm ci`). Pushed head 6774f9b8 = tests only for the CI-only suites (site, roadmap, door-in-front harnesses) + unit-proven script changes; its build-and-test run 46126426171 is where the new Worker-suite tests are read **red by name** (the first push, b1441d87, stopped at integration: `script-loads` lacked `holding-secrets.ts`, fixed in cc313997). Local, **not pushed**: 4 code commits to 8978e54a (site Worker `markWebRequest`, specs 401→403 `DoorRequired`, roadmap-test config `DOOR_REQUIRED` "true", lockdown password gate deleted, comments). Plan + mapping: `.superpowers/sdd/1078/plan.md`. |
| #986 (draft) | #160, untouched. |

## Done this session

- #1156 merged 62fd7bcb (every check green on head 0b2d5414, steps read by name). Its develop deploy-dev run 46124634004 green on every job; #1155 closed by hand with that evidence (comment 7236618593). #1154's one-off `/` "no data-dev-strip" verify failure did not recur. Worktree and branches removed.
- #1078 part (b): CI-only harness tests rewritten (door secret stands in for the door; without it 403 `forbidden` on every path, webhook and robots included); verify-dev, verify-dev-hosts, site smoke config, deploy-dev and dev-config moved off the password, each red first locally (mutations run once on the new assertions). Unit 15169/15169 at 6774f9b8.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. Read run 46126426171 (`gh run view 46126426171 --log-failed`): the new site/roadmap/door-in-front tests must fail by name (password-gated code still in place). Record the names on #1078.
3. In `../yawelo-idle-1078b`: run the unit suite, push the 4 code commits, read every check green on the head SHA by step, mark #1157 ready, squash-merge (`--match-head-commit` from a file).
4. Read develop's deploy-dev by step name: verify ("Verify dev is behind its door, …"), verify-roadmap, site-smoke (now at dev.yaweloidle.com with the DEV pass).
5. Then (Shyden): check the site Worker holds no leftover `DEV_PASSWORD` secret, then delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment. Then #1078 AC5 (Safari/Firefox/Edge sign-in).

## Parked for Shyden

- Safari/Firefox/Edge sign-in once AC3 is live (#1078 AC5).
- Buttondown (#343): once the second free account exists, its API key goes in as a dev environment secret. The live `yawelo` account's keys stay untouched.
- After part (b) deploys: delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment.
- #1152 AC4: read the next release's deploy-prod run, then close.

## Devices

#1149 (P0) blocks #992/#993, and those also wait on playwright-devices#68 (0.2.2; playwright-devices-25 messages when it's on npm). Yawelo has no device code yet.
