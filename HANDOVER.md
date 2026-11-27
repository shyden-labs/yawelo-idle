# Handover: Yawelo Idle

**Written:** 2026-11-28 02:07 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at 9bcaabd6 (#1145 merged). No Colima, simulator or USB claim held. board-next: #1078 (P0, waits on Shyden's deploy-door approval).

## Open PRs (strict: merge one, merge develop into the next, unit, push, CI, repeat)

| PR | Ticket | State |
| --- | --- | --- |
| #1147 | #1139 | `../yawelo-idle-1139` ceae000b (develop merged, unit 15,175/15,175), PUSHED, CI running. Merge on green (`--match-head-commit` from a file), clean worktree + branches, close #1139 once the next ci.yml browsers Edge install is read within 440 s. |
| #1146 (draft) | #1104 AC1+AC2 | `../yawelo-idle-1104` `feat/1104-snapshot-in-html` d1034f25 = tests only. Unit red read on CI by name (36 failed incl. every new test; job 1 build-and-test). |
| #1148 (draft, scratch) | #1104 | `../yawelo-idle-1104red` `scratch/1104-red-ci` 13e3b2ae: only the harness (apps/site/test/roadmap/routes.test.ts) + site e2e (tests/site/roadmap.spec.ts) tests on develop's code. Read on #1148's build-and-test "Worker tests" step: the 2 `carry the held snapshot` cases red by name. Read deploy-dev run 46054395810 (dispatched on the scratch branch) site-smoke: the `draws the board the page carries…` journey red. Then close #1148, delete branch + worktree, comment both reds on #1104. |
| #986 (draft) | #160 | untouched |

## #1104 code (after both reds are read)

Route + measured cost: #1104 comment 7217629209. In `../yawelo-idle-1104`:
1. `Roadmap.astro`: `<script is:inline type="application/json" id="roadmap-snapshot"></script>` (empty) before the map; `<noscript>` shows `copy.voyage.needsScript`.
2. `copy.ts`: drop `loading` and `failed` from `VoyageCopy`/`VOYAGE_PLACEHOLDER`; add `needsScript: 'The map needs JavaScript to show.'` (Shyden 2026-11-27, "Say JS is needed"; English placeholder on both pages, no translation now).
3. `VoyageMap.svelte`: drop the fetch effect, `failed` and the loading/alert lines; read `#roadmap-snapshot` text once on init (try JSON.parse, ignore errors) into `show()`.
4. Worker (`apps/site/worker/index.ts`): for GET `/roadmap`, `/id/roadmap` (and trailing slash), fetch the asset, `HTMLRewriter` sets `script#roadmap-snapshot` inner content (html: true) to `JSON.stringify(snapshot).replaceAll('<', '\\u003c')`, `Cache-Control: no-store`. A pure helper for the escaping with a unit test.
5. Unit, push, CI green, measure page TTFB and drawn-board time on dev before and after (promised on the ticket), un-draft, merge.

## Devices

#992/#993 (P0) now blocked by playwright-devices#68 as well as #7 (comments on both, 2026-11-27): 0.2.0 has real phones but refuses `keyboard.press` (fixed in playwright-devices#67, merged, **unpublished: waits on Shyden approving that repo's `npm` environment**) and a phones-imported spec throws on desktop until #68 (in progress). playwright-devices-25 messages when #67/#68 are on npm. iPhone needs Shyden's passcode; the OPPO is 98% full (its dialog breaks Android runs; shyden.co.uk#1272).

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
2. #1147: read CI by step, merge, clean up.
3. #1148 + deploy-dev 46054395810: read the reds, close and clean up, then write #1104's code (above).
