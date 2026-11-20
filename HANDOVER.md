# Handover: Yawelo Idle

**Written:** 2026-11-21, session `yawelo-idle-53`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-1055` (`1055-tab-icon`, local 5a91762a; remote has a later update-branch merge, `git pull` first, PR #1056), `yawelo-idle-1013` (`1013-api-host`, 361123fa, PR #1058), `yawelo-idle-1003` (cd7f4f2, draft PR #1054), `yawelo-idle-52` (927edb1, draft PR #1042), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached). No Colima, simulator or USB claim. A background CI waiter on #1056 and #1058 dies with this session: re-read with `gh pr checks 1056` / `gh pr checks 1058`.

## Shyden's answers today (2026-11-21)

- **Tab icon: #10, twin sparkles on the night square** (from the 56-icon gallery, https://claude.ai/artifact/Cn5v3fC2xDvQJC2GX2szK5). In PR #1056: both `favicon.svg` swapped, pin test seen red first, unit 14,651 green; all CI green on 5a91762a, then branch updated with develop (CI re-running).
- **Nameserver panel message:** ignore it. Nothing to do.
- **api.yaweloidle.com:** "Reserve the address now". PR #1058: assets-only Worker `yawelo-idle-sync` (apps/sync-worker/reserve), 404 "not open yet" en+id (Google read-back matched), noindex, robots disallow; deploy-prod stamps `commit.txt`, `scripts/verify-api.ts` checks it. First push failed two integration lists (script-loads, wrangler-steps dry-runs); fixed in 361123fa, CI re-running.
- **308 vs 301:** keep 308. #1013 AC2 rewritten and met.
- **#1013 AC4** measured in his Chrome: video plays on yaweloidle.com, test., dev-holding. (comment on #1013).
- **yawelo.com:** he signs in, I click. The connected Chrome is NOT the Yawelo login (shows ShyDesk / Shyden Labs Dev accounts). Asked him to open the Yawelo profile, connect Claude there, sign in to Yawelo's Cloudflare.
- **#343 AC2:** follows #635's answer; #343 now blocked by #635 (both P3).
- #1013 set In Progress (branch 1013-api-host).

## Resume steps

1. `ListAgents`; `gh pr checks 1056` and `gh pr checks 1058`. If red, read `gh run view <id> --log-failed`.
2. #1056 green on head: squash-merge into develop, wait for the dev deploy, curl `/favicon.svg` and `/play/favicon.svg` on dev hosts (200, body = twin-sparkles.svg), screenshot a real tab (AC4), close #1055 with evidence. Then merge develop into `1003-shared-playwright-devices` so Edge's shell journey passes.
3. #1058 green: squash-merge. It goes live with the next production release (Shyden approves); then `verify-api.ts` in deploy-prod proves AC1's API host.
4. When Shyden says the Yawelo profile is connected and signed in: in Yawelo's Cloudflare, yawelo.com zone: add proxied records and a redirect rule to https://yaweloidle.com (path and query kept, 308), then curl it. Then #1013 can close (AC1 api host after the release).
5. playwright-devices#39 still open (no release past 0.1.3): when released, `npm install` in `../yawelo-idle-1003`, re-plant AC5(b) in one commit, see it refused in CI, revert.
6. #830 AC2 epic titles table still waits for Shyden (comment on #830).
7. Next ticket: `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`.
