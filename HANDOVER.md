# Handover: Yawelo Idle

**Written:** 2026-11-28 11:20 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at cce9d2ed (#1153). main at e9345241 (release #1150, door live). No Colima, simulator or USB claim held. board-next: #1078 (P0): AC3 next.

## Open PRs (strict: merge one, merge develop into the next, unit, push, CI, repeat)

| PR           | Ticket | State                                                                                                                                                                                                                                                                |
| ------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (merged)     | #1104  | PR #1146 merged ce06f086; worktree and branches removed. After figures on #1104 (comment 7227399651). Read develop's deploy-dev 46062979196 site-smoke, then shut ticket 1104 by hand (AC3 was PR 1143; AC4: voyage words are English placeholders, no translation). |
| #986 (draft) | #160   | untouched                                                                                                                                                                                                                                                            |

#1147 merged da0925ea (#1139 stays open until a ci.yml browsers Edge install on a branch with da0925ea is read within 440 s).

## Devices

#1149 (P0, filed 2026-11-28) blocks #992/#993: every Yawelo device run removes what it put on a phone, never Chrome/Safari data or Shyden's own (global rule 2026-11-28); free space before/after. Phones cleaned by repo-template-71 at ~02:35 WIB (baseline on #1149). Yawelo has no device code yet.

#992/#993 (P0) now blocked by playwright-devices#68 as well as #7 (comments on both, 2026-11-27): 0.2.0 has real phones but refuses `keyboard.press` (fixed in playwright-devices#67, merged, **unpublished: waits on Shyden approving that repo's `npm` environment**) and a phones-imported spec throws on desktop until #68 (in progress). playwright-devices-25 messages when #67/#68 are on npm. The OPPO is test-only (its used space was test leftovers, not Shyden's data; earlier wording was a guess): factory-reset 2026-11-28 ~09:40 WIB, adb 3b402284 authorised. The iPhone was factory-reset 2026-11-28 and set up with no passcode; both phones released. Yawelo has never run on either phone (no device code), so it left nothing on them.

## Next: #1078 AC3 (remove the dev password gate)

Chrome sign-in proven to reach the door (comment 7233815274), but the site Worker still answers 401 Basic (`apps/site/worker/index.ts:131` `gateWebRequest(request, env.DEV_PASSWORD, …)`), so browsers fail. The origin already requires the door secret (`refusal()`, `apps/door/worker/origin.ts`). Reach listed on that comment: site Worker, deploy-dev.yml (DEV_BASIC_AUTH_PASSWORD at 170/228/235/268/362/466), scripts/dev-secrets.ts, door-in-front test, apps/site/test roadmap harness + tests, tests/unit/dev-config + dev-secrets. TDD; CI-only tests red on a scratch ref first. After it is live: drive Chrome again (Shyden's Cloudflare login is already consented in his Chrome), and Shyden signs in himself in Safari, Firefox, Edge (agent never types his Cloudflare login).

## Parked for Shyden

- Safari/Firefox/Edge sign-in once AC3 is live (#1078 AC5).
- Buttondown: second free account for the dev list (#343); he said yes 09:3x WIB. Next: ask for its API key as dev env secret, naming the live account as untouched.
- #1152 AC4: read the next release's deploy-prod run (one approval; site verify, door deploy, door verify steps by name), then close.

## Done this session

- #1145 merged 9bcaabd6 (#1123's CPU-time growth check). #1123 stays open until a full unit passes at load ≥180.
- #1115 closed: AC2 stall message proven on both step bodies (comment 7217511929); DoD read on run 45911910968 (25 s, 22 s).
- #971: 8 load timeouts at load ~70, swap 5 GB, recorded (comment 7217548726).
- #1104 shut: PR #1146 merged ce06f086; develop deploy-dev 46062979196 green, new journey passing on all 4 browsers (comment 7227658276).
- #1147 merged da0925ea (#1139 open until the next ci.yml Edge install is read).
- #1149 filed (P0), blocks #992/#993; scope comment 7232717912 (site data for Yawelo's own origins removed too). Phones reset by Shyden 2026-11-28: iPhone 487,400,194,048 B free, OPPO 475,717,992 KB free (repo-template-71's reading); baseline for #1149.
- Release #1150 merged e9345241; deploy-prod 46102806468 + deploy-door 46102842543 success; door read live (comment 7233277007).
- #1152 filed (P2, 3 pts; #1151 closed as filed outside file-story); PR #1153 merged cce9d2ed: deploy-door.yml gone, deploy-prod's one job deploys site → verify → door → scripts/verify-door.ts. Worktree and branches removed.
- Progress page v58 published 11:15 WIB (version 178).
- playwright-devices 0.2.1 (#67) on npm; #68 → 0.2.2 later today, playwright-devices-25 messages.
- Release PR #1150 was cut at ce06f086. `yawelo-idle-dev-scripts` needed `npm ci` (stale node_modules failed pre-push lint on scripts/worker-coverage.ts).

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. #1078 AC3 (section above). Tell Shyden: `.superpowers/road-to-launch.v56.html` (a 25 Nov local page copy) was deleted by mistake on 2026-11-28.
