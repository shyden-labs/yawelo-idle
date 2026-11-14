# Handover: Yawelo Idle

**Written:** 2026-11-14 13:52 WIB (session `yawelo-idle-f6`). Colima not used. **Shyden is AFK, possibly for days**: keep going without him.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. board-next says #783 (waits on the next release cut); P0-P2 otherwise all wait.

## Done this session

- **#124 closed** (2026-11-14): Platform interface, web implementation, contract suite and the platform-only lint ban. PR #967 squash-merged as `24587498`; dev deploy run 43547152881 verified this commit, smoke on every target green. Guard seen red in CI run 43544474563 before the wiring. Evidence on #124; session logs in `.superpowers/sdd/124/` (ignored). Real-browser IndexedDB proof is #146 AC5. Worktree and branch removed.
- Progress page republished 09:56 WIB (version 42); its source is `.superpowers/road-to-launch.html` (ignored), rebuilt from the published page.

- **#966 filed** (P3, 3 pts): the site and holding page have no og:/twitter: tags. Shyden ruled 2026-11-14 (via shyden.co.uk): a real 1200×630 screenshot of the top of each page, per language, from the built site, committed, with og:image:width/height/alt; a test fails on missing, wrong size or one flat colour. Recorded on #966.

- **#964 closed** (2026-11-14): deliveries for 11-07 and 10-23 expired (GitHub keeps ~3 days; read in Chrome, the API 404s for the operator); cause unmeasurable; practice for the next drift in memory `project-roadmap-drift-read-deliveries-within-3-days`.

- **#933 closed** (2026-11-14): Shyden: "933 redone test first". PR #965 merged as `2edbe543`: counters written new test-first (red 14/28), a runner-construction defect CI found fixed test-first (red 10/11), CI run 43530965451 printed counts in all 4 suites, no `unknown`.

- **#957 closed**: banner measured on dev by headless Playwright with `DEV_PASSWORD` (`~/.config/shyden/yawelo-dev.env`), evidence on the ticket. Shyden: never ask him to type the dev password again (memory `feedback-dev-access-without-shyden`). `dev.yawelo-idle.shyden.co.uk` = holding page; the full site = `yawelo-idle-site-dev.shyden-labs-dev.workers.dev`.
- **#933**: run 43415406638 on `6a4116d3` all green; roadmap 35 assertions on each of 5 targets, posted (comment 6851640260). **PR #963** opened.
- **#830** decision (Shyden, 18:40 WIB, recorded on the ticket): build the Indonesian with Google read-back; **may merge into develop** once read-back matches; ticket stays open for his reading before production.

- **#933**: PR #963 merged as `1fae584d`; branches and worktrees removed. **Left open, Status Todo**: AC6's "tests fail first" has no recorded red run; measured today that 4 of 7 counter tests fail with counting broken (comment 6851905334). Shyden rules: accept, or redo test-first.
- **#712** tally posted and closed (49 deploys, 48 green, 0 transient). **#964 filed** (P2, 3 pts): the 2026-11-07 missed webhook (#523/#590 at 00:10:56–00:11:17 UTC; unmeasured hypothesis: a read going backwards) and the unexplained 2026-10-23 drift 1851. Needs Shyden's consent to read org webhook deliveries; else measure `/api/roadmap/health` at the next drift.
- **#864** tally posted (0 site-smoke reds since #865). P0–P2 otherwise all wait: #783/#757/#713 on the next release cut, #425/#426/#457/#759 on #784, #888/#864 are watches to 11-19/11-20, #812 needs a phone.
- Progress page republished 18:57 WIB (version 40).

## Resume steps

1. **#104 on PR #968** (head `fc07c55b`, one commit on develop `24587498`; #104 In Progress): `~/.claude/scripts/pr-verdict.sh 968` until every required check is done (it can return in progress). Green on the head SHA (`git -C ../yawelo-idle-104 rev-parse HEAD`) → squash-merge into develop with `--match-head-commit`, verify the dev deploy, shut the ticket by hand with evidence, note on #104 why no `Website: announce` (the shell copy is not new), remove worktree `../yawelo-idle-104`. Red → fix test-first in a new commit on the branch. Done 13:45 WIB: Google read-back id→en (Google day 11-13) matched all 4; Google's own en→id not run (67 chars left); second sources KBBI (kbbi.kemendikdasmen.go.id; kemdikbud host no longer answers), Wiktionary, the site's shipped id copy. Evidence `docs/translations/2026-11-14-ui-catalogue-id.md`. Unit 174 files / 14,250 passed after `npm ci`; a first run failed 106 (no `fake-indexeddb` installed, and 1 s timeouts at load avg 196 from peer sessions; load not proven the cause).
2. **#830 after 15:00 WIB 2026-11-14** (Google day resets): drafts in `.superpowers/sdd/830/830-id.json` (+ `830-en.json`). Run `node scripts/google-read-back.ts id en < 830-id.json` and `en id < 830-en.json` from `-dev-scripts`; write `docs/translations/<date>-roadmap-id.md` (table like `2026-10-16-holding-page-id.md`); implement in `apps/site/src/copy-en.ts` / `copy.ts` test-first; merge to develop when green; leave #830 open for Shyden.
3. **PARKED until 2026-11-15:** #784 go-live.

## Waiting on Shyden (AFK)

- #830 final reading of the Indonesian; #106/#107 scope; Sonar exclusion of `docker/node/Dockerfile` (S6471); Sparked Host ticket #073955; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). `origin/develop` at `2edbe543` (#965).
- Worktrees: `-dev-scripts` (detached at origin/develop `1fae584d`), `-104` (branch `104-ui-catalogues`, local only).
