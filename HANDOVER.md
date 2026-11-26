# Handover: Yawelo Idle

**Written:** 2026-11-27 01:05 WIB, session `yawelo-idle-5b`. Branch `handover/2026-10-17-d`. develop at 75906185 (#1127 merged). No Colima, simulator or USB claim held. board-next: #1078 (P0, in hand).

## Devices

#992/#993 (P0) wait on playwright-devices#7 (emulators; ETA ~7 Dec, low confidence): every device run covers every device. playwright-devices messages when #7 is on npm or the ETA moves. #997–#1000 wait on #992/#993. Don't touch the phones.

## Open PRs (strict: merge one, merge develop into the next, unit, push, CI, repeat)

| PR | Ticket | State |
| --- | --- | --- |
| #1141 | #1078 step 3 | CLOSED by Shyden's ruling "Real door later" (2026-11-27): CI's #813 no-stand-ins guard refused the door stand-in. Worktree + branches removed. The game smoke gets a CI machine pass through the real front door in AC1's PR (comment on #1078). Old notes: | `../yawelo-idle-1078g`: develop merged → ea9ad24c, unit 15,156/15,156, PUSHED. CI running; merge on green (`--match-head-commit` from a file), clean worktree + branches, read develop deploy-dev's smoke job, post on #1078. Unit timeouts at high load are #971. |
| #1137 | #1136 | AC3 proven (comment 7204079569), one-off reverted: head 78863834 (tree = fb1ea1f3). CI running; merge on green. |
| #1142 | #1078 AC1 | `../yawelo-idle-1078d` 5fa5b213 PUSHED (unit 15,170). CI running; merge on green; then read the first develop deploy-dev's mint step + smoke/site-smoke (proof of the token), post on #1078. deploy-door waits for Shyden; after: read the door live, message shydesk-c8, then AC3 (drop origin password, separate PR). |
| (none) | #1115 AC3 | `../yawelo-idle-1115` branch `ci/1115-edge-limit` (npm ci done): tests/unit/edge-install-trusted.test.ts changed to 370 s / 7 min (measured 16–123 s, comment 7201478677), NOT committed; red run queued (`$S/red-1115.log`). After red: deploy-dev.yml both Edge steps 165→370, timeout-minutes 3→7, comment; unit, push, PR. |
| (none) | #1139 | After #1137 merges (same ci.yml step): browsers Edge limit 440 s / 8 min from measured 146 s (comment 7203350866), test first. |
| #986 (draft) | #160 | untouched |

`$S` = `/private/tmp/claude-501/-Users-shyden-Developer-Repos-yawelo-idle/2d13e26f-1c1d-49df-86af-e3a45baedf18/scratchpad` (lost on reboot).

## #1078 AC1 next (after #1141): wire the DEV-pass door

- shydesk-c8 holds shyden-labs/shydesk#302 until Yawelo's door on dev.yaweloidle.com serves `POST /__devpass/embed?for=shydesk.shydesk-non-prod.workers.dev` (repo-template door, `signin` set). Told ETA ~29 Nov WIB, low confidence (door deploy waits for Shyden, AFK; told 2026-11-27). Message it when on dev or the ETA moves.
- Only dev.yaweloidle.com must load ShyDesk (tests/site/support.spec.ts in site-smoke uses `HOLDING_DOOR`). The workers.dev host need not.
- shyden-co-uk-c0: the sign-in swaps a machine pass for an embed pass, but the door's embed route reads only the `__Host-devpass` cookie. CI's site-smoke must set the machine pass as that cookie (Playwright `addCookies`, host-only). Comment 7200057006 on #1078.

## Parked for Shyden (AFK from 2026-11-27 ~02:00 WIB for over a day)

- Approve deploy-door (production environment) once AC1 merges into develop.
- Sign up a second free Buttondown account for the dev test list (#343, his pick).

## Done this session

- Closed #1074 (AC5 page test ran in CI, 27 → 28) and #1123 (all ACs evidenced, merged 75906185).
- #1078 steps 1 and 2 proven on develop (deploy-dev 45841850222, 45871133201; comments on #1078).
- #1120 AC4: deploy-dev trusted jobs restore nothing (comment 7197649899); still needs dependabot-daily, deploy-door, deploy-test, deploy-prod, rollback-prod next runs.

## Tickets awaiting a read to close

- #1115: AC3 needs ≥5 deploy-dev install-time reads. #1118: check its remaining ACs. #1136: AC3 plan in `.superpowers/sdd/1136/plan.md`. #1139 (P3).
- #1072 (P0) blocked by #423 → #635, #343 (Shyden's newsletter-provider pick).

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. #1137 (merge develop, unit, push, merge on green), then #1078 AC1: wire the DEV-pass door, CI machine pass as `__Host-devpass` cookie for site-smoke AND the game smoke through dev.yaweloidle.com (no door stand-in in browser tests, #813).
