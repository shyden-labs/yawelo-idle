# Handover: Yawelo Idle

**Written:** 2026-11-26 22:00 WIB, session `yawelo-idle-5b`. Branch `handover/2026-10-17-d`. develop at a2dc515c (#1138 merged). No Colima, simulator or USB claim held.

## Devices

The real phones are connected (Shyden, via repo-template, 21:06 WIB), but **playwright-devices-ae holds them** for playwright-devices#54 (PR #59). My device tickets cannot start yet:

- #992 (real Android) and #993 (real iPhone), both P0: blocked by playwright-devices#54 (linked 2026-11-26, read back) and #7.
- #997–#1000 (iPad, iPhone Duo, Android tablet, foldable): wait on #992/#993 → #7/#38.
- 22:17: `@shyden-labs/playwright-devices` 0.2.0 on npm with #54's real-phone routes (proven from npm on iPhone Air + both OnePlus). #992/#993 still wait on #7 (emulators): every device run covers every device. Told playwright-devices; it messages when #7 lands. USB phones: playwright-devices, then shyden-co-uk-c0 queued.
- playwright-devices (21:50): #54 merged in its develop (PR #59, 3c7df0e); release cut + npm publish are Shyden's; it sends the version when published. #7: no ETA (fail-fast PR #64 in review).
- Earlier (21:09): #54 first. One iPhone bug is left (a file-input tap after typing opens nothing). ETA for PR #59 merged: tonight if the fix is small, else tomorrow, low confidence. Then the release cut and npm publish are Shyden's. #7: no ETA. It will message when each lands. Don't touch the phones before then.

## Open PRs

| PR            | Ticket       | State                                                                                                                                                                                                                                                                   |
| ------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1138         | #1078 step 1 | MERGED a2dc515c 21:45; worktree + branches removed. deploy-dev run 45841850222 (verify reads the origins directly): read its verify job |
| (no PR yet)   | #1078 step 2 | `../yawelo-idle-1078s` branch `smoke/1078-smoke-reaches-origins`, a5786245 (type fix + no npm cache in verify-holding, #1120 rule). unit 15,149/15,149 + static green; PR #1140 open on a5786245, CI verdict pending; merge on green |
| (no PR yet)   | #1078 step 3 | `../yawelo-idle-1078g` branch `smoke/1078-game-smoke-origin`, commit 50508b3d (stand-in routed to the site origin only; red 3 by name, mutation caught, typecheck+lint clean). Unit 22:13 RED on timing only: 4 timeouts (1 s limit) in unrelated tests at load 307 (#971); re-run at low load, push + PR on rc=0 |
| #1137         | #1136        | 72359d69 pushed (unit 15,140/15,140), marked ready 22:15 WIB; CI running; merge on green |
| #1126         | #1074 AC5    | MERGED 27b7e80a 22:16 WIB; worktree + branches removed. #1127, #1137, #1140 now BEHIND: merge develop into each, unit, push, one at a time |
| #1127         | #1123        | develop merged 7a823f70, unit 15,145/15,145, PUSHED, CI running                                                                                                                                                                                  |
| #986 (draft)  | #160         | untouched                                                                                                                                                                                                                                                               |

`$SCRATCH` = `/private/tmp/claude-501/-Users-shyden-Developer-Repos-yawelo-idle/3efc3e75-e1d2-44de-8a14-a6cb5c4216b6/scratchpad` (lost on reboot: then re-run unit by hand). Strict: each merge puts the others behind; merge one, merge develop into the next, unit, push, CI, repeat.

## Tickets awaiting a read to close

- #1115: next deploy-dev's Edge install log. #1118: a run logging "Found in cache" for Node. #1120: changed workflows' next runs log no restore. #1074: #1126 merged 27b7e80a: read its deploy-dev run on develop, then check every AC before closing. #1123: after #1127 (ACs evidenced).
- #1136: mirror outage proven (comment 7194360822). AC3 (a newer Edge over an older cached one) planned in `.superpowers/sdd/1136/plan.md` (one-off with an older deb in the cache, then revert). #1139 (P3): cold Edge install ~135 s against its 165 s limit.
- #1072 (P0) blocked by #423 → #635, #343 (Shyden's newsletter-provider pick).

## Resume steps

Local runs started 21:52-21:58 (logs in this session's scratchpad `/private/tmp/claude-501/-Users-shyden-Developer-Repos-yawelo-idle/286b72bd-1c51-4f44-900d-14a51f1da3aa/scratchpad`) are DEAD after `/clear`: step 2 unit re-run (`unit-1078s-2.log`), step 3 red run (`red3.log`), #1136 unit (`unit-1136.log`), pushes of 1074b/1123. If a log lacks its final `Tests` line, re-run it.

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`.
2. Pushes: compare `git ls-remote` of site/1074-failed-read-page-test with local c410b14d (`../yawelo-idle-1074b`) and test/1123-no-email-growth with 7a823f70 (`../yawelo-idle-1123`); if missing, `git push` in each (unit already 15,146/15,145 green). Merge #1126 then #1127 on green (`--match-head-commit` from a file), one at a time, develop into the next between.
3. Step 1 proven: deploy-dev run 45841850222 success, verify line on #1078.
4. Step 2: PR #1140 (a5786245). `~/.claude/scripts/pr-verdict.sh 1140`; merge on green (`--match-head-commit` from a file), clean worktree `../yawelo-idle-1078s` and branch, then read the develop deploy-dev verify-roadmap + verify-holding jobs.
5. Step 3 (`../yawelo-idle-1078g`, 50508b3d): if `unit-1078g.log` lacks rc=0, re-run unit; push, PR (Refs #1078), merge on green, then read deploy-dev's smoke job on develop.
6. #1137: unit in `../yawelo-idle-1136` (72359d69) at low load; push on green, mark ready.
7. Device work only after playwright-devices sends the npm version of #54 (its fix merged 21:50; publish is Shyden's).
