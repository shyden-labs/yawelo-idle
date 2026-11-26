# Handover: Yawelo Idle

**Written:** 2026-11-26 21:18 WIB, session `yawelo-idle-5b`. Branch `handover/2026-10-17-d`. develop at f9b23473. No Colima, simulator or USB claim held.

## Devices

The real phones are connected (Shyden, via repo-template, 21:06 WIB), but **playwright-devices-ae holds them** for playwright-devices#54 (PR #59). My device tickets cannot start yet:

- #992 (real Android) and #993 (real iPhone), both P0: blocked by playwright-devices#54 (linked 2026-11-26, read back) and #7.
- #997–#1000 (iPad, iPhone Duo, Android tablet, foldable): wait on #992/#993 → #7/#38.
- playwright-devices' answer (21:09): #54 first. One iPhone bug is left (a file-input tap after typing opens nothing). ETA for PR #59 merged: tonight if the fix is small, else tomorrow, low confidence. Then the release cut and npm publish are Shyden's. #7: no ETA. It will message when each lands. Don't touch the phones before then.

## Open PRs

| PR            | Ticket       | State                                                                                                                                                                                                                                                                   |
| ------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1138         | #1078 step 1 | develop merged, unit 15,145/15,145, pushed e78d43b7; CI running at 21:16 (board-orphans green). Merge when green                                                                                                                                                       |
| #1137 (draft) | #1136        | one-offs reverted (tree = f7270689) + develop merged, local 72359d69 **not pushed**. Two unit runs red on timing only (7 at load 48; 4 as load rose 12→90; both on #971). Re-run unit by hand when load is low, push on green, mark ready |
| #1126         | #1074 AC5    | green on 4223390c, BEHIND                                                                                                                                                                                                                                               |
| #1127         | #1123        | 4b54dc36, BEHIND, board-orphans red (old #1136 status slip, re-runs on develop merge)                                                                                                                                                                                  |
| #986 (draft)  | #160         | untouched                                                                                                                                                                                                                                                               |

`$SCRATCH` = `/private/tmp/claude-501/-Users-shyden-Developer-Repos-yawelo-idle/3efc3e75-e1d2-44de-8a14-a6cb5c4216b6/scratchpad` (lost on reboot: then re-run unit by hand). Strict: each merge puts the others behind; merge one, merge develop into the next, unit, push, CI, repeat.

## Tickets awaiting a read to close

- #1115: next deploy-dev's Edge install log. #1118: a run logging "Found in cache" for Node. #1120: changed workflows' next runs log no restore. #1074: after #1126. #1123: after #1127 (ACs evidenced).
- #1136: mirror outage proven (comment 7194360822). AC3 (a newer Edge over an older cached one) planned in `.superpowers/sdd/1136/plan.md` (one-off with an older deb in the cache, then revert). #1139 (P3): cold Edge install ~135 s against its 165 s limit.
- #1072 (P0) blocked by #423 → #635, #343 (Shyden's newsletter-provider pick).

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`.
2. If the unit logs are lost or not rc=0, re-run unit in `../yawelo-idle-1078` and `../yawelo-idle-1136` (under test-lock), then push each.
3. #1138: on green CI, merge (`--match-head-commit` from a file), then read develop's deploy-dev verify job; continue #1078 plan `.superpowers/sdd/1078/step1-plan.md`. Then #1126, #1127, #1137 in turn; clean each worktree and branch at merge.
4. Device work only after playwright-devices messages that #54 has been released.
