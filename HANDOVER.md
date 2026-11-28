# Handover: Yawelo Idle

**Written:** 2026-11-28 10:27 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at ce06f086. No Colima, simulator or USB claim held. board-next: #1078 (P0): release PR #1150 open, waits on Shyden merging.

## Open PRs (strict: merge one, merge develop into the next, unit, push, CI, repeat)

| PR           | Ticket | State                                                                                                                                                                                                                                                                |
| ------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (merged)     | #1104  | PR #1146 merged ce06f086; worktree and branches removed. After figures on #1104 (comment 7227399651). Read develop's deploy-dev 46062979196 site-smoke, then shut ticket 1104 by hand (AC3 was PR 1143; AC4: voyage words are English placeholders, no translation). |
| #1150        | #1078  | Release cut `release/2026-11-28-dev-pass-door` at ce06f086 into main; 27 checks green, CLEAN, 10:24 WIB. Waits on Shyden: merge, approve deploy-prod.                                                                                                                |
| #986 (draft) | #160   | untouched                                                                                                                                                                                                                                                            |

#1147 merged da0925ea (#1139 stays open until a ci.yml browsers Edge install on a branch with da0925ea is read within 440 s).

## Devices

#1149 (P0, filed 2026-11-28) blocks #992/#993: every Yawelo device run removes what it put on a phone, never Chrome/Safari data or Shyden's own (global rule 2026-11-28); free space before/after. Phones cleaned by repo-template-71 at ~02:35 WIB (baseline on #1149). Yawelo has no device code yet.

#992/#993 (P0) now blocked by playwright-devices#68 as well as #7 (comments on both, 2026-11-27): 0.2.0 has real phones but refuses `keyboard.press` (fixed in playwright-devices#67, merged, **unpublished: waits on Shyden approving that repo's `npm` environment**) and a phones-imported spec throws on desktop until #68 (in progress). playwright-devices-25 messages when #67/#68 are on npm. The OPPO is test-only (its used space was test leftovers, not Shyden's data; earlier wording was a guess): factory-reset 2026-11-28 ~09:40 WIB, adb 3b402284 authorised. The iPhone is being factory-reset with no passcode (unavailable until Shyden says done). Yawelo has never run on either phone (no device code), so it left nothing on them.

## Parked for Shyden

- Merge release PR #1150 and approve deploy-prod; then I dispatch deploy-door from main (`gh workflow run deploy-door.yml --ref main`), he approves its production environment, I read the door live on dev.yaweloidle.com, message shydesk, then #1078 AC3.
- Buttondown: Shyden said 2026-11-28 09:3x WIB he'd make a second free account for the dev list now (#343). Next: ask for its API key as the dev environment secret, naming the live account as not to be touched.
- playwright-devices#67/#68 on npm: asked playwright-devices-25 for order and ETA 2026-11-28 (no waiting npm run seen at 09:30 WIB).

## Done this session

- #1145 merged 9bcaabd6 (#1123's CPU-time growth check). #1123 stays open until a full unit passes at load ≥180.
- #1115 closed: AC2 stall message proven on both step bodies (comment 7217511929); DoD read on run 45911910968 (25 s, 22 s).
- #971: 8 load timeouts at load ~70, swap 5 GB, recorded (comment 7217548726).
- #1104 shut: PR #1146 merged ce06f086; develop deploy-dev 46062979196 green, new journey passing on all 4 browsers (comment 7227658276).
- #1147 merged da0925ea (#1139 open until the next ci.yml Edge install is read).
- #1149 filed (P0), blocks #992/#993; scope comment 7232717912 (site data for Yawelo's own origins removed too). Phones reset by Shyden 2026-11-28: iPhone 487,400,194,048 B free, OPPO 475,717,992 KB free (repo-template-71's reading); baseline for #1149.
- Release PR #1150 opened (cut at ce06f086, all green). `yawelo-idle-dev-scripts` needed `npm ci` (stale node_modules failed pre-push lint on scripts/worker-coverage.ts).

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. Read PR #1150: if merged, follow "Parked for Shyden" step 1; else take the next ticket that waits on nobody. Tell Shyden: `.superpowers/road-to-launch.v56.html` (a 25 Nov local page copy) was deleted by mistake on 2026-11-28.
