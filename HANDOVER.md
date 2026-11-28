# Handover: Yawelo Idle

**Written:** 2026-11-28 20:50 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at 6d2734e3 (#1159). main at e9345241. No Colima, simulator or USB claim held. board-next: #1078 (P0).

## In flight

| Item                  | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1078 docs beacon** | Branch `1078-docs-beacon`, worktree `../yawelo-idle-1078c`, **local commit 25796072, not pushed, no PR**. develop's deploy-dev 46146286886 deployed and verify passed, but site-smoke failed 8 tests (api-docs + private-api-docs × 4 browsers), each on one request alone: Cloudflare's injected Web Analytics beacon (#451, W17), now seen because smoke goes through the dev door. Fix: `tests/site/beacon.ts` (shared `BEACON`, `foreignTo`), both docs specs use it, support.spec imports it. **Prettier, eslint and typecheck NOT yet run** (the test lock held them). |
| **#986** (#160)       | Head eea6ad3b, every check green (116 steps, the one skip the Edge cache save; save-backups spec ran on all 4 browsers), Sonar 0, body updated, still draft. Merge after the beacon fix so develop's deploy can go green.                                                                                                                                                                                                                                                                                                                                                    |
| Test lock             | Held by shyden.co.uk's device run (pid 45672) since 12:29Z; its ETA ~15:05Z, low confidence. shyden-co-uk-ff will message on release.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Done this session

- #1157 merged 7c950984; #1159 merged 6d2734e3 (#1123: the no-email scan counts characters read, limit 8, measured 2.0 to 4.5). develop's Unit tests green on 6d2734e3. #1123 still open: close once develop's deploy is green, saying its AC2 "old regex restored" was stood in by a quadratic mutation.
- Filed #1158 (P0, 2): voyage map socket-drop test failed once under load.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. In `../yawelo-idle-1078c`: `npx prettier --check tests/site`, `npx eslint tests/site`, typecheck (`npm run typecheck`); fix and amend if needed (unpushed). Run the unit suite, push, open the PR (`Refs #1078`), read CI by step, merge.
3. Then `gh pr update-branch 986`, wait green, mark ready, squash-merge. Remove both worktrees and branches.
4. Read develop's deploy-dev by step: Unit tests, verify, verify-roadmap, site-smoke. Green: close #1123 with the evidence.
5. Then (Shyden): check the site Worker holds no leftover `DEV_PASSWORD` secret, then delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment. Then #1078 AC5.

## Parked for Shyden

- Safari/Firefox/Edge sign-in (#1078 AC5).
- Buttondown (#343): once the second free account exists, its API key goes in as a dev environment secret. The live `yawelo` account's keys stay untouched.
- Delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment.
- #1152 AC4: read the next release's deploy-prod run, then close.

## Devices

#1149 (P0) blocks #992/#993, and those also wait on playwright-devices#68 (0.2.2; playwright-devices-25 messages when it's on npm). Yawelo has no device code yet.
