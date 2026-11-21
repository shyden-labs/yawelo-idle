# Handover: Yawelo Idle

**Written:** 2026-11-21 ~08:30 WIB, session `yawelo-idle-53`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-1055` (`1055-favicon-ico`, 70edd1a9, PR #1060), `yawelo-idle-1003` (869c6656, draft PR #1054), `yawelo-idle-52` (draft PR #1042), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. A background CI waiter on #1060 dies with this session: re-read with `gh pr checks 1060`.

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

- **Merged:** #1056 (1fa928b6), #1058 API reserve (afbd9fb8), #1059 holding icon + CSP `img-src 'self'` (dc78cf9c). Their worktrees and branches removed. #1013 back to Todo (no branch; waits on the prod release and yawelo.com).
- **#1055 evidence posted** (comment on #1055): AC1 picked; AC2 SVG measured on dev (dev-holding, dev site Worker `/favicon.svg` and `/play/favicon.svg` 200, bytes = design; Chrome fetched it, no `/favicon.ico`, no console error); AC3 shell journey passed on chromium/firefox/webkit/msedge in #1003's run 44840564327.
- **AC2's `.ico` was missing**: PR #1060 adds `docs/design/tab-icon/twin-sparkles.ico` (16/32/48 PNG-in-ICO, made with sharp from a scratch script) and copies in `apps/site/public` and `apps/site/holding/public`; the old-name guard now reads `.ico` as media. CI re-running on 70edd1a9.
- **AC4** (real tab screenshot in Shyden's Chrome and on a phone) needs Shyden: my screen captures showed his personal tabs, so I deleted them and stopped.
- #1054's board-orphans red was #1055 briefly without a branch; refresh with `gh pr update-branch 1054`.

## Resume steps

1. `ListAgents`; `gh pr checks 1060`.
2. #1060 green: squash-merge (SHA from a file), wait for the dev deploy (loop on `gh run view <id> --json status` until completed; `gh run watch` returned early once), curl `/favicon.ico` on dev-holding and on `https://yawelo-idle-site-dev.yawelo-idle-non-prod.workers.dev` (dev password in `~/.config/shyden/yawelo-dev.env`): 200, bytes = twin-sparkles.ico. Remove worktree and branch.
3. Ask Shyden (AskUserQuestion, plain words) for AC4: screenshots of the Yawelo Idle tab at dev-holding.yaweloidle.com in his Chrome and on his phone (prod gets the icon at the next release). Then shut #1055 by hand with all evidence.
4. #1003: still blocked by playwright-devices#39 (no release past 0.1.3); `gh pr update-branch 1054`.
5. yawelo.com: wait for Shyden to connect the Yawelo Chrome profile and sign in to Yawelo's Cloudflare, then add records + redirect (308, path kept) and curl it.
6. #830 AC2 epic titles table waits for Shyden.
7. Next ticket: `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`.
