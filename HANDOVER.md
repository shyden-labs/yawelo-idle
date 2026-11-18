# Handover: Yawelo Idle

**Written:** 2026-11-18 15:30 WIB, session `yawelo-idle-de`, before a laptop shutdown. Branch `handover/2026-10-17-d`. Every worktree clean and pushed: `yawelo-idle-52` (a9500f9, draft PR #1042), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No background job, server, Colima, simulator or USB claim. Road to Launch page republished 15:30 WIB.

## Resume steps

1. **FIRST: Claude in Chrome work not finished (#1038).** `main`'s ruleset "main: release cuts only" (id 26270384) must admit merge commits only. The change was filled in on GitHub (Settings → Rules → Rulesets → that ruleset: "Require a pull request before merging" ticked, approvals 0, Allowed merge methods = Merge only), then GitHub asked for Shyden's passkey ("Confirm access") and it was never saved; the shutdown loses the filled form. Redo it in the **Yawelo Chrome profile** (the App gets 403 on rulesets), let Shyden click "Use passkey", then read back: `gh api repos/shyden-labs/yawelo-idle/rulesets/26270384 --jq '[.rules[]|.type+" "+((.parameters.allowed_merge_methods//[])|join(","))]'` must show `pull_request merge`. Record it on #1038. #1038 then waits only for the next release cut to pass `release-cut` (PR #1039 merged cd3119a: check (d) accepts the one squash b3f8c4b by name).
2. `ListAgents`; `npm view picomatch version` (4.0.7 at 15:25; above it → apply, drop #1018's exception); `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh it first). Node: `~/.local/share/node/current/bin`.
3. **Merge only through a helper** that runs `gh pr merge --squash --match-head-commit` and the board Status → Todo in one command (memory `feedback-in-progress-after-the-branch-exists`; the scratchpad `merge.sh` dies with the shutdown, rewrite it). Every In Progress ticket needs an open PR naming it: a branch without `/N-` does not count.
4. **Next release** (needs #1038's ruleset first): carries the test-door fix (007b7ae) so `test.yaweloidle.com` stops answering 404, plus today's promo re-encode and the purge step. At release: upload the re-encoded MP4 (1,921,671 B), WebM and poster to `yawelo-idle-media`, purge the `media.yaweloidle.com` URLs (README step 4), Shyden approves deploy-prod, then re-run deploy-door from main (Shyden approves). Then shut #1021, #1015, #622 by hand with evidence; #783 wants a refused non-release PR seen.
5. **#164 AC2** (P3): rate limits counted in **D1** (Shyden chose 2026-11-18). Route table and limits exist (routes.ts: health 60/60 s, devices 10/3600 s). Tests first: 429 + Retry-After at the exact boundary, counts surviving isolate restarts.
6. **#52** (P3, draft PR #1042): slice 1 on its branch (strict body). Next: migration `0002_content_reports.sql` + harness schema test (CI-only: push the red test first), POST route, health. Parked: item ids (no content until M2); AC5/AC9 need Shyden (Access app, service token, rate-limit rule).
7. Open questions for Shyden: delete the old `yawelo-idle-site` Worker and `yawelo-idle-dev-hosts` Pages project (nothing live on them); the shyden.co.uk zone's Always Use HTTPS 301 can turn a plain-http POST into a GET before the 308.

## Live state (measured 2026-11-18)

- yaweloidle.com 200 (b3f8c4b); dev.yaweloidle.com 401, 200 with the dev password (develop); dev-api.yaweloidle.com/health ok; dev-holding.yaweloidle.com 200; **test.yaweloidle.com 404** (step 4).
- Old hosts: all four `*.yawelo-idle.shyden.co.uk` answer 308 to their yaweloidle.com twins, path and query kept (shyden.co.uk#1191, verified here).
- Door secrets set (dev, test, production); ShyDesk dev key stored as `SHYDESK_API_KEY`/`SHYDESK_API_BASE` in `dev` (Shyden asked); GET /feed 200.

## Done this session

- Merged: #1019, #1032, #1034, #1035, #1036, #1039, #1040; release #1030 into main (by Shyden).
- Shut: #1031, #1033, #757. Filed: #1033, #1038.
- #1037 shut and deleted per Shyden's TDD ruling; #165 redone test-first (property tests seen red in CI, tag `evidence/165-property-red`).
