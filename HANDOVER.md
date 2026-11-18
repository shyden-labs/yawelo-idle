# Handover: Yawelo Idle

**Written:** 2026-11-18 (evening WIB), session `yawelo-idle-a5`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-1013` (branch `1013-old-hosts-gone`, draft PR #1043, red guard commit d69b905 pushed), `yawelo-idle-52` (a9500f9, draft PR #1042), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at develop 1d34640). No Colima, simulator or USB claim.

## Resume steps

1. **#1013 AC3 (P0, In Progress, PR #1043): develop is red.** deploy-dev's `verify` and `verify-roadmap` on develop 1d34640 read **301** from `dev.yawelo-idle.shyden.co.uk` (the old host now redirects). Commit d69b905 adds `tests/guards/no-old-hosts.test.ts` (guards suite, CI-only). Steps:
   a. Read PR #1043's CI: the guards job must be **red on that test** (the evidence; record it on #1013).
   b. Then the fix, in a second commit: every workflow URL to `dev.` / `dev-api.` / `dev-holding.yaweloidle.com` (deploy-dev.yml, dev-behind-develop.yml); retire the old Pages adapter (`apps/dev-hosts`, `scripts/dev-hosts-secrets.ts` and its deploy steps, tests `dev-hosts*.test.ts`); drop `HOLDING_HOST` from `apps/site/worker/routes.ts` (holding page by `HOLDING_DOOR` only); `scripts/verify-dev-hosts.ts` keeps its path/method/body checks but takes hosts from `apps/door/worker/door.ts` `DOORS`, drops the pages.dev check; fix comments, wrangler comments and test fixtures (full list: `git grep -n "yawelo-idle\.shyden\.co\.uk" -- . ':!docs' ':!*.md'`).
   c. Unit suite locally, push, then `gh workflow run deploy-dev.yml --ref 1013-old-hosts-gone` and read `verify`, `verify-roadmap`, `verify-holding` green on that SHA. Then ready the PR, merge when green.
2. **Then cut a release** (#1038's ruleset is done): `release/<date>-<slug>` from a green develop, PR into main. It proves #783 (a refused non-release PR, Shyden 11-05: at the next cut) and #1038 (`release-cut` passes). At release: re-encoded promo MP4/WebM/poster to `yawelo-idle-media`, purge `media.yaweloidle.com`, Shyden approves deploy-prod, re-run deploy-door from main. Then shut #1021, #1015, #622, #1038, #783 by hand with evidence.
3. `ListAgents`; `npm view picomatch version` (4.0.7 at 18:00 WIB); `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`. Node: `~/.local/share/node/current/bin`.
4. **#164 AC2** (P3): rate limits counted in D1. **#52** (P3, draft PR #1042): next is migration `0002_content_reports.sql` + harness schema test (push red first).
5. Open questions for Shyden: delete the old `yawelo-idle-site` Worker and `yawelo-idle-dev-hosts` Pages project once #1043 stops deploying it; the shyden.co.uk zone's Always Use HTTPS 301 can turn a plain-http POST into a GET before the 308.

## Done this session

- #1038: `main` ruleset now `pull_request` with merge only, 0 approvals (saved 18:01 WIB with Shyden's passkey, read back by API, recorded on #1038).
- Found develop red (above); filed nothing new: it is #1013 AC3.
- The test lock waited 3 h 43 min behind shyden.co.uk's device run.
