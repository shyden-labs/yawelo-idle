# Handover: Yawelo Idle

**Written:** 2026-11-28 02:50 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at da0925ea (#1147 merged). No Colima, simulator or USB claim held. board-next: #1078 (P0, waits on Shyden's deploy-door approval).

## Open PRs (strict: merge one, merge develop into the next, unit, push, CI, repeat)

| PR | Ticket | State |
| --- | --- | --- |
| #1146 (draft) | #1104 AC1+AC2 | `../yawelo-idle-1104` `feat/1104-snapshot-in-html`, pushed 5e214b3e (tests; unit red read on CI, 36 failed incl. every new test). UNCOMMITTED in the worktree, unit-green locally (47/47 in the 3 files): copy.ts `needsScript` (loading/failed gone), VoyageMap.svelte reads `#roadmap-snapshot` in an effect (no fetch), new `src/roadmap/carried.ts` (`CARRIED_ID`, `carriedText`, test red first + mutation-checked). Still to write AFTER the two CI reds below: Roadmap.astro (`<script is:inline type="application/json" id="roadmap-snapshot"></script>`, noscript shows `needsScript`) and the Worker HTMLRewriter for `/roadmap`, `/id/roadmap` (+ trailing slash) with `carriedText`, `no-store`. Then merge develop, unit, push, CI, measure TTFB and drawn-board time on dev before/after, un-draft, merge. |
| PR 1148 (draft, scratch) | #1104 | `../yawelo-idle-1104red` `scratch/1104-red-ci` cba22e10: Worker harness test only. Read the build-and-test "Worker tests" step: both `carry the held snapshot` cases red by name. Then shut PR 1148, delete branch + worktree. |
| (scratch) | #1104 | `../yawelo-idle-1104e2e` `scratch/1104-red-e2e` cc86bf1c: site journey only; deploy-dev run 46057742165 dispatched on it. Read site-smoke: the `draws the board the page carries…` journey red (it counts page requests for `/api/roadmap.json`; #813 forbids `page.route`). Then delete branch + worktree; comment both reds on #1104. Dev then runs this scratch until the next develop push redeploys develop. |
| #986 (draft) | #160 | untouched |

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
2. Read the two scratch reds (table), clean them up, then finish #1104's code.
