# Handover: Yawelo Idle

**Written:** 2026-11-19 (early WIB), session `yawelo-idle-a5`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-52` (a9500f9, draft PR #1042), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached, refresh with `git fetch && git checkout --detach origin/develop`). No Colima, simulator or USB claim.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`. Node: `~/.local/share/node/current/bin`.
2. **Read develop's deploy-dev on 88eca73** (run 44364453926) if not yet read: every job must be green. If green, shut #1018 with that run as evidence (advisory withdrawn, exception gone, PR #1044) and delete memory `project-picomatch-check-every-session` + its MEMORY.md line.
3. **Shyden approved (2026-11-19) removing the old dev setup.** Done: dev-environment secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` deleted and read back. Left, in Cloudflare (Yawelo Chrome profile; shytalk-a3 may have switched that Chrome's Cloudflare login to the ShyTalk account, so check who is signed in first), Shyden confirming each: delete the Pages project `yawelo-idle-dev-hosts` and the old `yawelo-idle-site` Worker in the "Shyden Labs Dev" account, and revoke that account's token the two secrets held. Record on #1013.
4. **Cut a release** from green develop: `release/<date>-<slug>`, PR into main. Proves #783 (a non-release PR refused, Shyden 11-05: at the next cut) and #1038 (`release-cut` passes; ruleset already merge-only). At release: re-encoded promo MP4/WebM/poster to `yawelo-idle-media`, purge `media.yaweloidle.com`, Shyden approves deploy-prod, re-run deploy-door from main. Then shut #1021, #1015, #622, #1038, #783 by hand with evidence. #1013 still needs AC1 (test.yaweloidle.com live), AC2/AC4/AC5 read after the release.
5. **#164 AC2** (P3): rate limits counted in D1. **#52** (P3, draft PR #1042): migration `0002_content_reports.sql` + harness schema test (push red first).
6. Open question for Shyden: the shyden.co.uk zone's Always Use HTTPS 301 can turn a plain-http POST into a GET before the 308.

## Done this session

- #1038: `main` ruleset now `pull_request` with merge only, 0 approvals (Shyden's passkey, read back by API, recorded).
- #1013 AC3: PR #1043 merged (ad8d933). Guard `tests/guards/no-old-hosts.test.ts` (seen red, run 44329242102); every workflow/config/test on yaweloidle.com; `apps/dev-hosts` retired; holding page by door only. Branch deploy run 44332203959 all green.
- #1018: GitHub withdrew GHSA-fc5q-39xc-vjpf 2026-11-18T15:38Z, which turned develop red ("exception matches no finding"); PR #1044 merged (88eca73) with an empty exception list.
- The test lock waited 3 h 43 min behind shyden.co.uk's device run.
