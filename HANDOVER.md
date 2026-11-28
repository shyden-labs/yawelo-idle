# Handover: Yawelo Idle

**Written:** 2026-11-28 11:57 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at aaa60371 (#1154). main at e9345241. No Colima, simulator or USB claim held. board-next was #1078 (P0); #1155 (P0) filed today.

## In flight

| Item | State |
| --- | --- |
| **#1156** (#1155, P0) | Branch `1155-dev-hosts-pass`, worktree `../yawelo-idle-1155`, head 1a8ac651. build-and-test run 46109478847 was running at close (the local watcher is DEAD after `/clear`: re-read with `gh pr checks 1156`). Next: every check green on the head SHA (by step), squash-merge, then read the develop deploy-dev step "Verify the dev hostnames reach the real Workers unchanged" green, shut #1155 by hand, remove the worktree and branches. |
| **#1154** merged aaa60371 | dev.yaweloidle.com shows the site being built. Its develop deploy-dev run 46109795900 was running at close (watcher DEAD). Expect "Verify dev is password-gated…" (verify-dev) **green** and verify-dev-hosts **red** until #1156 lands (#1155). Read both by step name. Worktree and branches removed. |
| **#1078 AC3 part (b)** | Branch `1078-door-required`, worktree `../yawelo-idle-1078b` (own `npm ci`), head 2a62ed99 (develop merged in), **not pushed**. Unit-green so far: DOOR_REQUIRED "true" ×3, holding-secrets, lockdown `markWebRequest`, dev-secrets with no password, web suite with no password. Next steps are in `.superpowers/sdd/1078/plan.md` ("(b) state"). Do not push until the site harness tests have been rewritten, since many fail on this branch as it stands. |
| #986 (draft) | #160, untouched. |

## Facts measured today

- The dev origins were **not** door-required: the site's workers.dev answered 401 Basic, holding-dev and holding-test answered 200 with no door secret (#1078 comment 7233947045, #784 comment 7234052648). Earlier handover wording that they were was wrong.
- **Ruling (Shyden): "Built site on dev"**: dev.yaweloidle.com shows the site being built, and dev-holding keeps the coming-soon page.
- Every develop deploy-dev has been red since release #1150 (run 46105526525): this is #1155.

## Devices

#1149 (P0) blocks #992/#993, and those also wait on playwright-devices#68 (0.2.2; playwright-devices-25 messages when it's on npm). Phones factory-reset 2026-11-28, baseline free space on #1149. Yawelo has no device code yet.

## Parked for Shyden

- Safari/Firefox/Edge sign-in once AC3 is live (#1078 AC5).
- Buttondown (#343): once the second free account exists, its API key goes in as a dev environment secret. The live `yawelo` account's keys stay untouched.
- After part (b) deploys: delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment (check that the site Worker holds no leftover DEV_PASSWORD secret first).
- #1152 AC4: read the next release's deploy-prod run, then close.

## Done this session

- #1154 merged aaa60371 (red read first: run 46107656297, exactly the 3 new site tests failed). Sonar 0 issues, 0 hotspots.
- #1155 filed (P0, 2 pts) and fixed in PR #1156 (tests red first; unit 15185/15185).
- #1139 closed (Edge install 13.2 s under 440 s, a cached install; comment 7234128408).
- Progress page v59 published (version 179).
- Memory: no node_modules symlinks between worktrees (it broke pre-push lint).

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. `gh pr checks 1156`: when green, merge (`--match-head-commit` from a file), read develop's deploy-dev by step name, shut #1155.
3. Read deploy-dev 46109795900 by step name (verify-dev green expected).
4. #1078 part (b), following the plan file.
