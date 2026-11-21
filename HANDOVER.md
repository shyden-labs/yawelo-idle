# Handover: Yawelo Idle

**Written:** 2026-11-21 ~07:30 WIB, session `yawelo-idle-53`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-1055` (`1055-holding-icon`, PR #1059), `yawelo-idle-1013` (`1013-api-host`, PR #1058, updated with develop on GitHub: `git pull` first), `yawelo-idle-1003` (869c6656, develop merged in, draft PR #1054), `yawelo-idle-52` (draft PR #1042), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. A background CI waiter on #1058 and #1059 dies with this session: re-read with `gh pr checks <n>`.

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

- **#1056 merged** (1fa928b6); dev deploy 44838963428 all 9 jobs green; old branch and worktree removed.
- **Gap found:** dev-holding.yaweloidle.com/favicon.svg answered 404: the holding page builds from `apps/site/holding/public`, which had no icon, and its CSP img-src named only the media host. **PR #1059** adds the file and `img-src 'self'`; tests red first; unit 14,661 green.
- **#1058**: Sonar new-code coverage was 44%; verify-api now fully tested (98.6%, only the entry line not), five mutations caught (one revert needed Shyden's OK after a hook refusal; given). board-orphans went red in the moment #1055 had no branch; #1058 updated with develop, CI re-running.
- **#1003** branch has develop (with the icon) merged in and pushed.

## Resume steps

1. `ListAgents`; `gh pr checks 1058` and `gh pr checks 1059`.
2. #1059 green: squash-merge, wait for the dev deploy, then curl `https://dev-holding.yaweloidle.com/favicon.svg` (200, bytes = docs/design/tab-icon/twin-sparkles.svg) and the game's `/play/favicon.svg` on dev (password, headless Playwright per memory), screenshot real tabs in Chrome, close #1055 with evidence. Remove its worktree and branches.
3. #1058 green: squash-merge; live with the next production release (Shyden approves); deploy-prod's verify-api proves AC1's API host. Remove its worktree and branches.
4. #1003: read its CI on 869c6656 (Edge shell journey should now pass); still blocked by playwright-devices#39 (no release past 0.1.3).
5. yawelo.com: wait for Shyden to say the Yawelo Chrome profile is connected and signed in to Yawelo's Cloudflare, then add records + redirect (308, path kept) and curl it.
6. #830 AC2 epic titles table waits for Shyden.
7. Next ticket: `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`.
