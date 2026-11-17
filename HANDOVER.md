# Handover: Yawelo Idle

**Written:** 2026-11-18 05:50 WIB, session `yawelo-idle-63` (worked overnight while Shyden slept). Colima, simulators and USB phones not claimed; no background job running. Road to Launch page republished 05:45 WIB (version 62).

## Morning list (Shyden)

1. **Release yaweloidle.com** (3 min). The cut `release/2026-11-18-yaweloidle` (develop `8589170a`, dev deploy run 44156280034 green on every job) is pushed. Opening its PR into `main` was refused to Claude by the permission check, so:
   a. Open https://github.com/shyden-labs/yawelo-idle/compare/main...release/2026-11-18-yaweloidle → **Create pull request**, title "Release 2026-11-18: yaweloidle.com", body from `.superpowers/sdd/1013-release-pr-body.md`.
   b. When `release-cut` and the checks are green, **Merge pull request** (merge commit).
   c. Actions → deploy-prod (the run it starts) → **Review deployments → production → Approve**.
   It puts the holding page on https://yaweloidle.com in Yawelo's own account. Claude then proves it with curl and asks the shyden.co.uk session for the 301 from the old address. The push also started deploy-test, which fails at its key step until item 2 is done; it is not required for the release.
2. **TEST key** (10 min), unblocks TEST deploys (#784). In the Yawelo Chrome profile, account **Yawelo Idle Non-Prod**:
   a. Workers & Pages → Create → Start with Hello World → name `yawelo-idle-holding-test` → Deploy (a key limited to one Worker cannot create it).
   b. Manage account → Account API tokens → Create Token → Custom → Workers → **Specified Workers: yawelo-idle-holding-test**, role **Editor** → name "GitHub Actions: TEST deploys" → Create.
   c. https://github.com/shyden-labs/yawelo-idle/settings/environments → `test` (the release push may already have created it; else New environment) → add secrets `TEST_CLOUDFLARE_API_TOKEN` (the key) and `NONPROD_CLOUDFLARE_ACCOUNT_ID` (the Non-Prod account id from its dashboard URL).
3. **Keep the Yawelo Chrome window unlocked** for a few minutes when convenient, so Claude can upload #1015's new video to the dev bucket (the locked screen blocked it overnight).

## Next session

`ListAgents`; **`npm view picomatch version`: a release above 4.0.7 is applied at once and #1018's exception dropped (Shyden, 2026-11-18)**; then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh it first). Node: `~/.local/share/node/current/bin`.

## Done overnight (2026-11-17/18)

- Merged into develop: #1017 (#1013: production on yaweloidle.com, media on media.yaweloidle.com), #1020 (#1018 picomatch exception), #1022 (#1021 test door), #1023 and #1024 (#1010, closed: SonarCloud code smells 114 → 0).
- Production key and account id saved in `production` (read back). R2 on in Yawelo's production account; `media.yaweloidle.com` and `dev-media.yaweloidle.com` live and proven (curl: byte-identical, 206, CORP cross-origin, nosniff). The shyden.co.uk session moved its pages to them.
- #757: fix was already live; the release above is its last AC.
- #106 re-scoped (Shyden's 2026-11-16 ruling); follow-ups #1025, #1026 filed and linked.
- #106 closed (content build and contentVersion, PR #1027, dev deploy green); follow-ups #1025, #1026.
- #163 closed (anonymous device registration, PR #1028; live on dev: `POST /v1/devices` 201, a field 400, GET 405). Follow-up #1029 (timing, after #166).
- #864 and #888 tallies posted (no smoke failures); they close when their windows end (#864 after 2026-11-18 21:00 UTC, #888 after 2026-11-20 13:00 UTC).

## In flight

- **#164** (rate limits and validation for every sync endpoint) is next in M4 and now unblocked; it is larger than its 3 points (shared validation, D1-backed limits, a route guard, a 413 boundary). Weigh the D1 writes per request before starting.
- **PR #1019** (#1015, new promo video): green on `5e9ba3f8`. Before merging, with no dev deploy running: upload the three files from `../yawelo-idle-1015/apps/site/media/` to R2 `yawelo-idle-media-dev` (Yawelo Chrome profile, bucket page, file input; copy them to the scratchpad first), curl-compare with the repo copies, merge, read the dev deploy's verify-holding. The production bucket gets them at the next release, with Shyden's approval (the yaweloidle.com release carries the old files). Then check whether the new video settles #622 (no Taj Mahal or Devanagari).
- **#1013** after the release: curl each host, then the 301s with shyden-co-uk-ec; old Worker's custom domain removal is in shyden.co.uk's account.
- **#160**: draft PR 986, waits on #992/#993.
