# Handover: Yawelo Idle

**Written:** 2026-11-14 09:07 WIB (session `yawelo-idle-f6`). Colima not used. **Shyden is AFK, possibly for days**: keep going without him.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. board-next says #783 (waits on the next release cut); P0-P2 otherwise all wait.

## In flight: #124 (Platform interface), PR #967, Status In Progress

- Worktree `../yawelo-idle-124`, branch `124-platform`, pushed head `da9da974` (stage 1). Plan, red logs, mutation predictions and results in `../yawelo-idle-124/.superpowers/sdd/124/`.
- Stage 1 deliberately leaves out the `eslint.config.js` wiring, so CI shows `tests/guards/platform-only-config.test.ts` red (guards run only in CI). The wired file is saved at `.superpowers/sdd/124/eslint.config.wired.js` (it adds the `platformOnlyBlock` import and `platformOnlyBlock,` before `coreDeterminismBlock,` with a comment).
- **Resume:** (1) `~/.claude/scripts/pr-verdict.sh 967` until CI is done; confirm the guards step is red ONLY on platform-only-config tests (record the run id and failing names on the PR). (2) Apply the wiring (`cp .superpowers/sdd/124/eslint.config.wired.js eslint.config.js`, check `git diff` is just those lines), run `npm run lint` and the unit suite, commit `Refs #124`, push. (3) Merge on green (squash, `--match-head-commit` from a file). (4) Verify the dev deploy; shut the ticket by hand with evidence; no Website story (nothing player-visible; say so on the ticket).

## Done this session

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

1. **#104 (UI catalogues), in progress, NOT pushed:** worktree `../yawelo-idle-104`, branch `104-ui-catalogues`, local commit `89ba4964` (wip). Plan and red/plant logs in `../yawelo-idle-104/.superpowers/sdd/104/`. Built test-first: `packages/ui/src/i18n/{catalogue,review,same-in-both}.ts`, `t`/`parts`/`slots`, the Shell on the catalogue, content exports `reviewSchema`/`missingEvidence`/`Review`; every guard seen red by a planted defect. Only red left: 5 "can ship" tests (review blocks are `draft`). **After 15:00 WIB 2026-11-14:** Google read-back of the 4 Indonesian strings (`game.name` is allow-listed), write each claude-checked block (2 sources, back-translation, label audit for ≤3 words), `docs/translations/2026-11-14-ui-catalogue-id.md`; run the unit suite; squash the wip into one commit; push; set #104 In Progress; PR `Refs #104`; merge on green.
2. **#830 after 15:00 WIB 2026-11-14** (Google day resets): drafts in `.superpowers/sdd/830/830-id.json` (+ `830-en.json`). Run `node scripts/google-read-back.ts id en < 830-id.json` and `en id < 830-en.json` from `-dev-scripts`; write `docs/translations/<date>-roadmap-id.md` (table like `2026-10-16-holding-page-id.md`); implement in `apps/site/src/copy-en.ts` / `copy.ts` test-first; merge to develop when green; leave #830 open for Shyden.
3. **PARKED until 2026-11-15:** #784 go-live.

## Waiting on Shyden (AFK)

- #830 final reading of the Indonesian; #106/#107 scope; Sonar exclusion of `docker/node/Dockerfile` (S6471); Sparked Host ticket #073955; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). `origin/develop` at `2edbe543` (#965).
- Worktrees: `-dev-scripts` (detached at origin/develop `1fae584d`), `-104` (branch `104-ui-catalogues`, local only).
