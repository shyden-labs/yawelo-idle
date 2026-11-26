# Handover: Yawelo Idle

**Written:** 2026-11-26 22:00 WIB, session `yawelo-idle-5b`. Branch `handover/2026-10-17-d`. develop at a2dc515c (#1138 merged). No Colima, simulator or USB claim held.

## Devices

The real phones are connected (Shyden, via repo-template, 21:06 WIB), but **playwright-devices-ae holds them** for playwright-devices#54 (PR #59). My device tickets cannot start yet:

- #992 (real Android) and #993 (real iPhone), both P0: blocked by playwright-devices#54 (linked 2026-11-26, read back) and #7.
- #997–#1000 (iPad, iPhone Duo, Android tablet, foldable): wait on #992/#993 → #7/#38.
- playwright-devices (21:50): #54 merged in its develop (PR #59, 3c7df0e); release cut + npm publish are Shyden's; it sends the version when published. #7: no ETA (fail-fast PR #64 in review).
- Earlier (21:09): #54 first. One iPhone bug is left (a file-input tap after typing opens nothing). ETA for PR #59 merged: tonight if the fix is small, else tomorrow, low confidence. Then the release cut and npm publish are Shyden's. #7: no ETA. It will message when each lands. Don't touch the phones before then.

## Open PRs

| PR            | Ticket       | State                                                                                                                                                                                                                                                                   |
| ------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1138         | #1078 step 1 | MERGED a2dc515c 21:45; worktree + branches removed. deploy-dev run 45841850222 (verify reads the origins directly): read its verify job |
| (no PR yet)   | #1078 step 2 | `../yawelo-idle-1078s` branch `smoke/1078-smoke-reaches-origins`, a5786245 (type fix + no npm cache in verify-holding, #1120 rule). unit 15,149/15,149 + static green by 22:03 WIB; push started; next: PR into develop (Refs #1078), merge on green |
| (no PR yet)   | #1078 step 3 | `../yawelo-idle-1078g` branch `smoke/1078-game-smoke-origin` off develop: red tests in tests/unit/web-smoke-harness.test.ts + stub tests/web/stand-in.ts (returns {}), uncommitted; red run against the stub in flight (red3b.log); next `tests/web/stand-in.ts` (standInHeaders + context.route), config requires DEV_DOOR_SECRET, deploy-dev smoke env |
| #1137 (draft) | #1136        | one-offs reverted (tree = f7270689) + develop merged, local 72359d69 **not pushed**. Two unit runs red on timing only (7 at load 48; 4 as load rose 12→90; both on #971). Re-run unit by hand when load is low, push on green, mark ready |
| #1126         | #1074 AC5    | develop merged c410b14d, unit 15,146/15,146, pushing                                                                                                                                                                                                                                               |
| #1127         | #1123        | develop merged 7a823f70, unit 15,145/15,145, pushing                                                                                                                                                                                  |
| #986 (draft)  | #160         | untouched                                                                                                                                                                                                                                                               |

`$SCRATCH` = `/private/tmp/claude-501/-Users-shyden-Developer-Repos-yawelo-idle/3efc3e75-e1d2-44de-8a14-a6cb5c4216b6/scratchpad` (lost on reboot: then re-run unit by hand). Strict: each merge puts the others behind; merge one, merge develop into the next, unit, push, CI, repeat.

## Tickets awaiting a read to close

- #1115: next deploy-dev's Edge install log. #1118: a run logging "Found in cache" for Node. #1120: changed workflows' next runs log no restore. #1074: after #1126. #1123: after #1127 (ACs evidenced).
- #1136: mirror outage proven (comment 7194360822). AC3 (a newer Edge over an older cached one) planned in `.superpowers/sdd/1136/plan.md` (one-off with an older deb in the cache, then revert). #1139 (P3): cold Edge install ~135 s against its 165 s limit.
- #1072 (P0) blocked by #423 → #635, #343 (Shyden's newsletter-provider pick).

## Resume steps

Local runs started 21:52-21:58 (logs in this session's scratchpad `/private/tmp/claude-501/-Users-shyden-Developer-Repos-yawelo-idle/286b72bd-1c51-4f44-900d-14a51f1da3aa/scratchpad`) are DEAD after `/clear`: step 2 unit re-run (`unit-1078s-2.log`), step 3 red run (`red3.log`), #1136 unit (`unit-1136.log`), pushes of 1074b/1123. If a log lacks its final `Tests` line, re-run it.

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`.
2. Pushes: compare `git ls-remote` of site/1074-failed-read-page-test with local c410b14d (`../yawelo-idle-1074b`) and test/1123-no-email-growth with 7a823f70 (`../yawelo-idle-1123`); if missing, `git push` in each (unit already 15,146/15,145 green). Merge #1126 then #1127 on green (`--match-head-commit` from a file), one at a time, develop into the next between.
3. Step 1 proven: deploy-dev run 45841850222 success, verify line on #1078.
4. Step 2 (`../yawelo-idle-1078s`, a5786245): unit + static green. Check `git ls-remote origin smoke/1078-smoke-reaches-origins` = a5786245 (else push), open the PR into develop "Refs #1078", merge on green.
5. Step 3 (`../yawelo-idle-1078g`, uncommitted red tests in tests/unit/web-smoke-harness.test.ts): read them red, then write `tests/web/stand-in.ts` (`standInHeaders(url, target, door)` exact-origin match + a `context.route` helper used by shell.spec.ts when WEB_SMOKE_URL is set), config refusal without DEV_DOOR_SECRET, deploy-dev smoke env (site workers.dev + DEV_DOOR_SECRET). Plan: `.superpowers/sdd/1078/step1-plan.md`.
6. #1137: unit in `../yawelo-idle-1136` (72359d69) at low load; push on green, mark ready.
7. Device work only after playwright-devices sends the npm version of #54 (its fix merged 21:50; publish is Shyden's).
