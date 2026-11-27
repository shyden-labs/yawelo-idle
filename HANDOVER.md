# Handover: Yawelo Idle

**Written:** 2026-11-28 03:12 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at da0925ea (#1147 merged). No Colima, simulator or USB claim held. board-next: #1078 (P0, waits on Shyden's deploy-door approval).

## Open PRs (strict: merge one, merge develop into the next, unit, push, CI, repeat)

| PR            | Ticket        | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1146 (draft) | #1104 AC1+AC2 | `../yawelo-idle-1104` `feat/1104-snapshot-in-html` 3c14784c PUSHED (code + tests, develop merged, unit 15,181/15,181). All three reds read first (comments 7226732013, 7227059664 on #1104). deploy-dev run 46061133556 dispatched on the branch: read site-smoke green, then measure after-figures the same way as before (headless Chromium, 5 fresh loads; before: TTFB median 270 ms, drawn median 1080 ms, comment 7227099985). Then CI green on 3c14784c by step, un-draft, merge (`--match-head-commit` from a file), clean up, read the develop deploy's site-smoke, shut ticket 1104 by hand once every AC is evidenced (AC4: copy shown to Shyden; voyage words are English placeholders, no translation). |
| #986 (draft)  | #160          | untouched                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

#1147 merged da0925ea (#1139 stays open until a ci.yml browsers Edge install on a branch with da0925ea is read within 440 s).

## Devices

#1149 (P0, filed 2026-11-28) blocks #992/#993: every Yawelo device run removes what it put on a phone, never Chrome/Safari data or Shyden's own (global rule 2026-11-28); free space before/after. Phones cleaned by repo-template-71 at ~02:35 WIB (baseline on #1149). Yawelo has no device code yet.

#992/#993 (P0) now blocked by playwright-devices#68 as well as #7 (comments on both, 2026-11-27): 0.2.0 has real phones but refuses `keyboard.press` (fixed in playwright-devices#67, merged, **unpublished: waits on Shyden approving that repo's `npm` environment**) and a phones-imported spec throws on desktop until #68 (in progress). playwright-devices-25 messages when #67/#68 are on npm. iPhone needs Shyden's passcode; phones cleaned 2026-11-28 by repo-template-71 (OPPO mostly holds Shyden's own data).

## Parked for Shyden

- Approve deploy-door (production environment) for #1078; then read the door live, message shydesk, then AC3.
- Approve playwright-devices' `npm` publish (unblocks #67 for #992/#993).
- Second free Buttondown account for the dev test list (#343).

## Done this session

- #1145 merged 9bcaabd6 (#1123's CPU-time growth check). #1123 stays open until a full unit passes at load ≥180.
- #1115 closed: AC2 stall message proven on both step bodies (comment 7217511929); DoD read on run 45911910968 (25 s, 22 s).
- #971: 8 load timeouts at load ~70, swap 5 GB, recorded (comment 7217548726).
- #1104 AC1 route measured and written (comment 7217629209); tests written and red.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. Finish #1146 as in the table. A local waiter on run 46061133556 is DEAD after `/clear`: `gh run view 46061133556 --json jobs`.
