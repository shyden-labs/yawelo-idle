# Handover: Yawelo Idle

**Written:** 2026-11-18 06:35 WIB, session `yawelo-idle-63`, before a laptop restart. Branch `handover/2026-10-17-d`; every worktree clean and pushed (`yawelo-idle-1015` at `6389f0f`, `yawelo-idle-160` at `35dd400`). No Colima, simulator or USB claim. Local background waiters (polling only) die with the restart: nothing is lost. Road to Launch page republished 06:41 WIB (version 63).

## Shyden

1. **Release yaweloidle.com: PR #1030** (`release/2026-11-18-yaweloidle` → `main`). `release-cut`, build-and-test, coverage, sonar all green; the red `deploy`/skipped `verify` are the first TEST deploy from before the TEST key existed (not required). **Merge it** (merge commit), then Actions → deploy-prod → **Review deployments → production → Approve**. Claude then curls https://yaweloidle.com and asks the shyden.co.uk session for the 301 from the old address.

## Next session

`ListAgents`; **`npm view picomatch version`: a release above 4.0.7 is applied at once and #1018's exception dropped (Shyden, 2026-11-18)**; then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh it first). Node: `~/.local/share/node/current/bin`.

## Resume steps

1. **TEST is live** (deploy-test run 44199225894 green; the TEST address answers 200; recorded on #784). Nothing to do.
2. **PR #1019** (#1015, new promo video): branch was updated onto develop; read its checks. When green and no dev deploy runs: copy `../yawelo-idle-1015/apps/site/media/yawelo-idle-promo*` to the scratchpad, upload all three to R2 `yawelo-idle-media-dev` (Yawelo Chrome profile, bucket page, file input), curl-compare with the repo copies, merge, read the dev deploy's verify-holding. Production bucket only at the next release, with Shyden's approval. Then check whether the new video settles #622.
3. After the release: #1013's per-host curls, the 301s with shyden-co-uk-ec, the old Worker's custom domain removal (shyden.co.uk's account).
4. **#1031** (P2): align versions with the other projects (census from steadyhand: 8+ items; run `census.py` for the full list).
5. **#164** (rate limits and validation, M4) is next in M4; larger than its 3 points; weigh D1 writes per request first.

## Done (2026-11-17/18)

- Merged into develop: #1012, #1014, #1017, #1020, #1022, #1023, #1024, #1027, #1028.
- Closed: #1010 (SonarCloud 114 → 0), #1011, #106 (content build), #163 (device registration, live on dev).
- Media live on `media.yaweloidle.com` and `dev-media.yaweloidle.com` (Yawelo's production account, proven by curl).
- Filed: #1013, #1015, #1016, #1018, #1021, #1025, #1026, #1029, #1031.
- #864 and #888 tallies posted; they close after their windows (2026-11-18 21:00 UTC, 2026-11-20 13:00 UTC).
- #160: draft PR 986, waits on #992/#993.
