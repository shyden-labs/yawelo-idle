# Handover: Yawelo Idle

**Written:** 2026-11-23 04:28 WIB, session `yawelo-idle-07`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-860`, `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts`. No Colima, simulator or USB claim. Shyden asleep since about 23:20 WIB: park questions, keep working.

**Local jobs (die with this session):** watchers for PR #1085 (#860 beacon fix, worktree `../yawelo-idle-860b`) and PR #1087 (#1086 quota fix, worktree `../yawelo-idle-1086`). Re-run `~/.claude/scripts/pr-verdict.sh <pr>`. Merge each when green on a head containing develop (the second needs `gh pr update-branch` after the first merges), Status to Todo in the same call; then read the deploy's jobs by name.

## Now (2026-11-23, to 02:35 WIB)

### #860 support pages (P0, In Progress): PR #1077 merged as 67d248db; fix PR #1085 open

- **All CI-only tests read red before code** (evidence on #1077): dev journeys 16 failed on deploy-dev 45050731695 (page 404); harness 20 failed on scratch PR #1080 (closed; scratch branches and worktree deleted).
- **Code pushed** as 2d9feb4d (`worker/support.ts`, index/routes wiring, `SHYDESK_HOST`, `/_site/` assets, `Support.astro` + 4 pages, `support/page.ts`, copy sources cite the evidence file). Local unit: 25 timeouts at load 305, all in untouched code (comment on #971).
- SonarCloud gate on 8ecbf60d: 77.1% new-code coverage (80% needed; page.ts and index.ts support() untested by unit). Fixed in 99e647dd (page.test.ts, mutation-checked; serveSupport() moved and tested red first).
- PR #1077 CI on 2d9feb4d: unit green, Worker tests 292 passed / 1 failed (`config.test.ts`: `SHYDESK_HOST` missing from `wrangler.roadmap-test.jsonc`), fixed in 8ecbf60d (push running at 02:35).
- **Merged** as 67d248db (every check and step green on e3b14141); worktree and branches removed. AC5 prepared: test files `.superpowers/sdd/860/ac5-photo.png`, `ac5-video.mp4`; script `../yawelo-idle-dev-scripts/.superpowers/ac5.mjs` (needs `DEV_PASSWORD`, `AC5_EMAIL`); shydesk-b1 answered: use `e2e-yawelo-ac5@example.com` (dev mail is not set up, so the piece's "email could not be sent" is expected) and dev Turnstile is the always-pass test key. Run `AC5_EMAIL=e2e-yawelo-ac5@example.com DEV_PASSWORD=… node .superpowers/ac5.mjs` from `../yawelo-idle-dev-scripts` once dev serves 67d248db, then send shydesk-b1 the subject `AC5 check from Yawelo Idle dev (#860)` for the read-back. Then read the deploy's `site-smoke` support journeys.
- **Was next:** read PR #1077's CI on the new head step by step; if green, mark ready and squash-merge into develop (Status mutation in the same call: #860 stays open); after the dev deploy read `site-smoke` (the support journey) by name; then AC5 by hand in a browser: a real ticket with a photo and a video sent from https://dev.yaweloidle.com/support, received in ShyDesk dev (ask shydesk-b1 to confirm receipt). Production half waits on #425/#426 and Shyden's approval of the live ticket address.

- **After the merge:** develop deploy 45069145980 failed `site-smoke`: the 16 support journeys saw Cloudflare's injected analytics beacon (W17's site-wide exception), which the support policy blocked. PR #1085 (tests d3f55aef red, fix 994251ba) admits it like the game's policy.
- **AC5 dev half met** (comments on #860): ticket ccaca7b3 with a photo and a video sent from dev at ~04:1x WIB and read back by shydesk-b1 by 04:20 WIB (both attachments open and play); ShyDesk closed it. **AC4 met** with a second ticket (aa7fa58a, link taken by code, opened on dev showing the ticket; the first failure was my misread token); both test tickets closed by shydesk-b1. `.superpowers/ac5.mjs` now saves the link to the ignored `.superpowers/sdd/860/ac5-ticket-link.txt`; `.superpowers/ac4.mjs` opens `$TICKET_LINK`.
- **#1086 (P0, In Progress), PR #1087**: content reports limited to 50 a day per network (test d996ff3c red first, then e671bf9e in routes.ts); decision on #1086; refusal noted on #590. After merge: exercise the 429 on dev (51 reports from one address) and record it.
- #860 left after #1085: the production half (#425/#426, live ticket address approval) and AC6's policy test is in; then close-out check of every AC.

### #1068 voyage map (P1), branch `x/1068-voyage-map`

- Commits on 461810ae: 3243854f model tests, 916c1a01 model code, 51eb34b9 component tests + map copy, d8003276 dev journeys (read red: 16 failed on deploy-dev 45056613095, evidence on #1068), 7b858fe9 drawing tests (10 red), 79f9d12f drawing, 13f4a594 the page + removals (spec §6). Full unit suite 14,758 passed at 02:28.
- A self-caught slip: `drawing.ts` was first written before its tests; deleted unrun, tests written and read red, module written fresh (memory updated).
- **PR #1082 merged** into develop as d022eb61; the develop deploy (run 45063877258) is all green and `site-smoke` passed the four voyage journeys on all four browsers (24 passed; evidence and AC-by-AC status on #1068: AC1 waits on #830 AC1's text, AC6 on a device run, AC8 on Shyden seeing it on dev). Earlier note (every check and step green on 50e15c54; coverage fixed with four mutation-checked tests and dead fallbacks removed). #1068 set Todo; worktree and branches removed. Next: read the develop deploy's `site-smoke` (the four roadmap journeys) by name, then check AC by AC on dev (AC8: Shyden sees it on dev before production) and close by hand only with every AC evidenced.
- Open: the three old intro paragraphs stay on the page until #830 AC1's new short text; the old copy strings stay while the tests use them to check absence.

### #1078 DEV pass (P1) and #1079 sign-up switch (P2)

- `x/1078-dev-pass` (worktree `../yawelo-idle-1078`), **PR #1084 merged** as ee0f4d13 (green on 31b48060); #1078 Todo, worktree and branches removed. Done on it: library + tests copied (7878e5f0 red, 961ed3bb green), form.ts re-copied with repo-template's chunked-body fix (2d0b1263 red, 4a9b6ac4 green; 108 tests). Its first push died on #1081 (lint out of heap); push again at low load, then set In Progress. Door wiring waits on Shyden's Cloudflare setup.
- `x/1079-signups` (worktree `../yawelo-idle-1079`), **PR #1083 merged** as fe30603a (#1079 Todo). AC2 read back on dev (201 at both addresses, /health commit fe30603a; comment on #1079); TEST and prod switch states wait for those sync deploys; AC3 on #590. Its work: fed69bae tests (11 red), b558e6b0 code (`SIGNUPS`, 503 `signups_closed`; 35 pass). Push, set In Progress, PR.
- #1081 (P2, 3 pts) filed: pre-push lint ran out of Node's 2 GB heap twice under load.

### For Shyden in the morning (parked questions)

1. #830 AC1: approve the roadmap page's new short text (draft in the latest #830 comment); then Indonesian with read-back.
2. #1074: the roadmap's "updating" and "could not update" wording, before translation. Start #1074 after #1068 lands (same page and Worker).
3. #860: approve the live ShyDesk ticket address `https://yaweloidle.com/support/ticket` (shydesk-b1 sets it once he says yes).
4. #1078: the DEV pass's one-time Cloudflare setup (repo-template `docs/dev-pass.md`, "One-time setup"); `dev-signin.shyden.co.uk` does not resolve yet.
5. #784: delete the old DEV key `cfat...c5dc` (Yawelo Chrome); approve the next production release (tab icon, API reserve).


## Latest (2026-11-22, to 22:15 WIB, session `yawelo-idle-07`)

- **P0 raised by Shyden** (AskUserQuestion, asked by shydesk-b1 for ShyDesk Release 2): #1072, #425, #426, #860 to P0, read back; #784 to P0 too, as #425's blocker (rule #578). board-next now says **#784**.
- **#860 rewritten, no forward** (Shyden confirmed): ShyDesk serves and runs the embed; Yawelo only embeds it and lists its origins. Relayed reachability (Telkomsel OK, Biznet workers.dev OK; IndiHome, XL, Indosat, Smartfren unmeasured) on #860. Origins sent to ShyDesk: `https://dev.yaweloidle.com`, `https://test.yaweloidle.com`; prod `https://yaweloidle.com` is Shyden's.
- **#1068 (P1, In Progress):** spec `docs/superpowers/specs/2026-11-22-roadmap-voyage-map-design.md` and Indonesian evidence `docs/translations/2026-11-22-roadmap-map-id.md` (25 lines, Google read-back id→en plus en→id second source) committed on `1068-voyage-map`. Shyden's rulings on #1068: season in halves, from the later of the two forecasts, hidden with no forecast; the note text and every map label approved. Next: the tests commit (unit + component + e2e, with copy data and compile-only stubs), pushed to a draft PR and read red by name on CI, then the code. Board read: 9 milestone epics M0–M8 with the AC2 titles; #328, #331, #452 have no milestone and get no island.
- **#1066 AC4**: done 2026-11-23, #1066 closed.
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
3. (done 2026-11-23: #1066 closed.)
4. #1068: tests commit in `../yawelo-idle-1068` per the spec's section 7, red on CI by name before any code (global rule 2026-11-22).
5. With Shyden: delete the old DEV key (#784); approve the next production release (tab icon, API reserve).
