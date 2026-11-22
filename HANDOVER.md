# Handover: Yawelo Idle

**Written:** 2026-11-23 00:40 WIB, session `yawelo-idle-07`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-860`, `yawelo-idle-860-e2e`, `yawelo-idle-1068`, `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. Progress page source `.superpowers/road-to-launch.html` (edited for v88, not yet published). Shyden asleep since about 23:20 WIB (relayed by repo-template-21): park questions, keep working.

## Now (2026-11-22 22:15 to 2026-11-23 00:40 WIB)

### #860 support pages (P0, In Progress), draft PR #1077

- **Rulings (on #860):** copy approved; pages in the full site with /support let through the doors (dev now; production waits on #425/#426, like #1072).
- **ShyDesk (shydesk-b1, on #860):** dev host `https://shydesk.shydesk-non-prod.workers.dev` (moves with shydesk#262, may change with #270), live `https://shydesk.dpdns.org`; `<host>/embed.js` defer; `<shydesk-support product="yawelo-idle" view lang>`; open shadow root, fields by label. Dev ticketPageUrl `https://dev.yaweloidle.com/support/ticket` set and read back. TEST uses live ShyDesk, but test.yaweloidle.com has no full site: the TEST page waits.
- **Branch `860-support-page`** (worktree `../yawelo-idle-860`), tests only: ec5875be + 3a0dd510 (pushed). PR #1077's CI: build-and-test stops at the red unit step, so the harness never runs there. board-orphans went red on #1068 (#1068 now set Todo; the check clears on the next push).
- **Reading CI-only tests red:** (a) scratch `860-e2e-red` (worktree `../yawelo-idle-860-e2e`, 4ec31a4d = develop + copy data, stub, i18n test, `tests/site/support.spec.ts`; copy sources cite only the evidence file, because the copy-source test refuses `#860`): push running in background, then `gh workflow run deploy-dev.yml --ref 860-e2e-red`; read `site-smoke` failing by name. (b) Next: scratch `x/860-harness-red` = (a) + `apps/site/test/site.test.ts` from 3a0dd510, as a draft PR; read "Worker tests" failing by name; then close it and delete both scratch branches.
- **Then the code** (drafts, not yet run, in ignored `.superpowers/sdd/860/`): `worker/support.ts`; wire `index.ts` (ticketRedirect + supportPage before servePages; `pagesFor` lets `passesTheDoor` through); `astro.config.ts` `build.assets: '_site'`, `inlineStylesheets: 'never'`, `vite.build.assetsInlineLimit: 0`; `wrangler.jsonc` var `SHYDESK_HOST`; `src/views/Support.astro` + 4 pages; `src/support/page.ts`. Change the copy sources on the branch too (drop `'#860'`, keep the evidence file).
- **Filed:** #1075 (P2, 1 pt, blocked by shydesk#266), #1076 (P1, 3 pts, dev door `signin`; blocks shydesk#262, which ShyDesk links). Note on #424. Timeout instance on #971.

### #1068 voyage map (P1, Todo until its PR)

- Branch `1068-voyage-map` (worktree `../yawelo-idle-1068`), local commits on 461810ae, not pushed: 3243854f model tests (35 red), 916c1a01 model code (84 green), 51eb34b9 component tests + map copy (22 red locally), d8003276 e2e journeys (`tests/site/roadmap.spec.ts`, to be read red on dev).
- Next: push as `x/1068-…` or open a draft PR naming #1068 at the first push (board-orphans needs `/N-` or a PR); read the e2e red on a deploy-dev scratch; then the Svelte code (VoyageMap with `{ locale }` props, SeaMap, IslandPanel, drawing.ts) and delete the old components per spec §6.

### Parked

- #784 (repo-template#207 still open), #1066 AC4 (no develop deploy since 6104112c).

## Latest (2026-11-22, to 22:15 WIB, session `yawelo-idle-07`)

- **P0 raised by Shyden** (AskUserQuestion, asked by shydesk-b1 for ShyDesk Release 2): #1072, #425, #426, #860 to P0, read back; #784 to P0 too, as #425's blocker (rule #578). board-next now says **#784**.
- **#860 rewritten, no forward** (Shyden confirmed): ShyDesk serves and runs the embed; Yawelo only embeds it and lists its origins. Relayed reachability (Telkomsel OK, Biznet workers.dev OK; IndiHome, XL, Indosat, Smartfren unmeasured) on #860. Origins sent to ShyDesk: `https://dev.yaweloidle.com`, `https://test.yaweloidle.com`; prod `https://yaweloidle.com` is Shyden's.
- **#1068 (P1, In Progress):** spec `docs/superpowers/specs/2026-11-22-roadmap-voyage-map-design.md` and Indonesian evidence `docs/translations/2026-11-22-roadmap-map-id.md` (25 lines, Google read-back id→en plus en→id second source) committed on `1068-voyage-map`. Shyden's rulings on #1068: season in halves, from the later of the two forecasts, hidden with no forecast; the note text and every map label approved. Next: the tests commit (unit + component + e2e, with copy data and compile-only stubs), pushed to a draft PR and read red by name on CI, then the code. Board read: 9 milestone epics M0–M8 with the AC2 titles; #328, #331, #452 have no milestone and get no island.
- **#1066 AC4** still waits on the next develop deploy (none since 6104112c's).
- **#1074 filed** (P1, 5 pts; Shyden raised it from P3: people are asking about progress): Shyden's ruling relayed by shytalk-77: the live roadmap re-reads on visit (last read over 10 min old) instead of the */10 cron; never shows an old board as current while updating; drift accounting moves off `check()`.
- **#1073 closed** (Shyden: "fix the dns immediately"): PROD yaweloidle.com zone got a proxied `A www 192.0.2.1` and a 308 redirect rule matching only `www.yaweloidle.com`; every curl case measured through 1.1.1.1 (evidence on #1073). The Mac's own resolver still had a cached "not found" at 22:28.
- **#784's next step** waits on repo-template-21's DEV-pass pattern (global rule 2026-11-22, repo-template#207, which replaces the door secret) and on Shyden deleting the old key `cfat...c5dc` (Yawelo Chrome).

## Earlier (2026-11-22, to 20:52 WIB, session `yawelo-idle-07`)

- **#1066: started again** (Shyden: "TDD failed then... clean slate, start again"). PR #1069 closed unmerged: its pending-clearing code and seen's sort had no red test first (memory `feedback-failing-test-before-any-code`, fourth instance). New draft **PR #1071**, branch `1066-seen-witness-clears-pending`, worktree `../yawelo-idle-1066b`. Red first: the harness test on CI (run 45020793203, `drift > counts no drift when the witness shows one read after the change`, expected 1 to be 0, the only failure); 12 `seen` tests, then the order test, then 4 `clearSeen` tests, each red locally before its code. **Merged** as `6104112c9bb4` (every step green on head `c6cc30cd7e25`, SonarCloud too); worktree and branches removed. Dev deploy run 45023545667 all green, `verify-roadmap` success. Text edits on #1066's card (13:04:11Z set, 13:07:22Z cleared): health drift 0, pending null, staleReads 0 (comment on #1066). #1066 set Todo (no branch). AC4 waits only on the next develop deploy's `verify-roadmap`. A gate unit run hit a #971 timeout first (load 71, swap 3.5 GB; comment on #971).
- **#1067 closed** with evidence (comment on #1067): webhook 698318626 payload URL set to `https://dev.yaweloidle.com/hooks/github` in Shyden's Chrome (he did the passkey) and read back; deliveries `bcf15f98…`, `c0bd55f0…` went there with 202; health drift 0 after the 13:50:19Z check. Before the change GitHub got 202 straight from the old host (no redirect followed).
- **#1072 filed** (P1, 3 pts, blocked by #425, #426): privacy pages `/privacy` and `/id/privacy` (no trailing slash) live on yaweloidle.com. Asked by shydesk-b1 for ShyDesk #78; answered (not live anywhere public; dev site workers.dev only).
- **#1068: island features approved** by Shyden (option 1 of https://claude.ai/artifact/ErmQbhpvXDPv4U66CLrbQ4), grouping in the #1068 comment. Shipyard and The engine share "Behind the scenes: the tools and the game engine everything else is built on."
- FYI from shytalk-77: Shyden ruled on DEV/TEST auth for every project (DEV gate with no shared secret in builds; TEST no password gate; on/off switch for registrations everywhere). repo-template-21 will send the pattern; change nothing until then.

## Earlier (2026-11-22, to 16:08 WIB, session `yawelo-idle-07`)

- **#1066 (P0, In Progress): cause measured** (comment on #1066). GitHub can answer a read with a card's **new field values and its old `updatedAt`** (run f, read r10; logs in `.superpowers/sdd/1066/`). The read that shows the change does not show the witness yet, so the card goes into `pending`; the next read shows the witness but finds no change, and `pending` is only cleared by a late webhook (`changed()`), so it becomes drift. Test card values cleared and read back.
- **PR #1069 (draft)**, branch `1066-late-witness-clears-pending`, worktree `../yawelo-idle-1066`, head `bfa1844d79f90b4e6d4d3a261529e8b4e1d0e0f3` = **tests only** (expected red): `witness.test.ts` (`account()` reports `seen`; 12 unit tests read red locally) and harness `roadmap.test.ts` "counts no drift when the change shows one read before its witness does". CI was still running at 16:08 WIB.
- **#1067:** AC1 recorded (GitHub docs say nothing about redirects; only 2xx is documented success). **Measured:** the old dev host already answers `308` to POST, yet a board edit at 09:07:25Z reached the dev roadmap (`lastEventAt` 09:07:27.705Z). Not proven whether GitHub followed the 308 or the payload URL was already changed: needs Shyden's Chrome (webhook 698318626 settings + Recent Deliveries).
- Progress page v81 published 16:08 WIB.

## Earlier (to 15:55 WIB)

- **Merged:** PR #1064 (2ba7cfac, playwright-devices 0.1.5), PR #1042 (b59e321e, content reports; #52 stays open, Todo). **Shut by hand with evidence:** #1062, #1003. Worktrees and branches for both removed.
- **#784:** the new DEV key is proven (comment). Left: delete the old key `cfat...c5dc` with Shyden (Yawelo Chrome).
- **#1066 (P0):** AC1 done (comment). All 26 epic-edit deliveries were sent and answered 202, so no webhook was missed. The Worker's accounting counted drift during a burst a second apart. Refuted: text edits not moving `updatedAt`. Next: the stale-fields experiment, then a failing `account()` test.
- **#1067 (P0, 1 point):** the org webhook must move off `dev.yawelo-idle.shyden.co.uk`.
- **#830 / #1068:** Shyden redesigned the public roadmap (all in the #830 comment). The 160 story titles were dropped. The design is one voyage map of the **9 build stages in order**, each island done / under way / not started from its own stories' closed share. The final look is round 6, map 3 (gallery https://claude.ai/artifact/CmgQ6copqWUPo59hK2hktK, source `.superpowers/sdd/830/island-designs-round6.html`, picks in its DB). The page keeps only the map, one progress bar and an expected season. **#1068 filed (P1, 8 points)** for the build. #830 keeps AC1 (simpler page text) and AC3.
- Progress page v80 published 15:55 WIB.

## Shyden's answers today (2026-11-21)

- **Tab icon: #10, twin sparkles on the night square** (from the 56-icon gallery, https://claude.ai/artifact/Cn5v3fC2xDvQJC2GX2szK5). In PR #1056: both `favicon.svg` swapped, pin test seen red first, unit 14,651 green; merged (see below).
- **Nameserver panel message:** ignore it. Nothing to do.
- **api.yaweloidle.com:** "Reserve the address now". PR #1058: assets-only Worker `yawelo-idle-sync` (apps/sync-worker/reserve), 404 "not open yet" en+id (Google read-back matched), noindex, robots disallow; deploy-prod stamps `commit.txt`, `scripts/verify-api.ts` checks it. First push failed two integration lists (script-loads, wrangler-steps dry-runs); fixed in 361123fa.
- **308 vs 301:** keep 308. #1013 AC2 rewritten and met.
- **#1013 AC4** measured in his Chrome: video plays on yaweloidle.com, test., dev-holding. (comment on #1013).
- **yawelo.com:** he signs in, I click. The connected Chrome is NOT the Yawelo login (shows ShyDesk / Shyden Labs Dev accounts). Asked him to open the Yawelo profile, connect Claude there, sign in to Yawelo's Cloudflare.
- **#343 AC2:** follows #635's answer; #343 now blocked by #635 (both P3).
- #1013 set In Progress (branch 1013-api-host).

## Since then

- **#1055 closed** with all four ACs evidenced (comments on #1055): PRs #1056, #1059 (holding page's own icon + CSP `img-src 'self'`), #1060 (`/favicon.ico`, 16/32/48 px; old-name guard reads `.ico` as media). Dev: `/favicon.svg`, `/play/favicon.svg`, `/favicon.ico` all 200, byte-checked. AC3 shell journey on all four browsers (run 44840564327). AC4: Shyden's own Chrome screenshot, plus an iPhone Air Safari tab-overview capture; both in `.superpowers/sdd/1055/` (ignored). Production gets the icon at the next release.
- **#1058 merged**: api.yaweloidle.com reserve, live at the next production release. #1013 is Todo (waits on that release and yawelo.com).
- #1054's board-orphans red is stale (ran while #1055 had no branch and was still open); it clears on that PR's next push.
- My slip: told Shyden the iPhone was "probably locked" when iphone-capture lost it; he said it never locked. Cause unknown; memory updated.

## This session (2026-11-21, 12:40 to 13:25 WIB)

- **#1003: PR #1054 merged** (squash 1c14d579) on playwright-devices 0.1.4. AC5(b) refused in run 44872497230 and AC5(a) in run 44785092678; AC1 to AC3 checked on develop (comment on #1003). playwright-devices#39 was closed by its own session on the AC5(b) run. Worktree and branches removed.
- **Develop is red; dev did not deploy.** Deploy run 44874197584 `test / browsers`: shell.spec's assertion counts were chromium 17, firefox 18, webkit 17, msedge 17. Cause, from Playwright 1.65.1's source: each `expect.poll` attempt is its own `expect` step, and the shared AssertionCounter counts them all. Filed **#1062 (P0, 2 points), blocked by playwright-devices#42**, which playwright-devices-ae is fixing (test first) and will send the version for. #1003 is blocked by #1062, its status is back to Todo, and AC4 is still open.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts` (detach at origin/develop first). It said #784 (P0).
2. #784: check whether repo-template-21 has sent the DEV-pass pattern (repo-template#207); if not, take the next P0 board-next gives that needs nothing outside (#425/#426/#1072/#860 chain) and say what is parked.
3. #1066 AC4: read the next develop deploy's `verify-roadmap` step by name, record it, shut the ticket by hand.
4. #1068: tests commit in `../yawelo-idle-1068` per the spec's section 7, red on CI by name before any code (global rule 2026-11-22).
5. With Shyden: delete the old DEV key (#784); approve the next production release (tab icon, API reserve).
