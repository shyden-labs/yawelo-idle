# Handover: Yawelo Idle

**Written:** 2026-11-19 06:55 WIB, session `yawelo-idle-a9`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-164` (branch `164-rate-limits`, 1eb09d5 pushed; draft PR #1046), `yawelo-idle-52` (99b2aa7 pushed, draft PR #1042, clean), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at 88eca73). No Colima, simulator or USB claim. Shyden says the real phones are unavailable for now.

## Waiting on Shyden

1. **Release cut:** approved, but the permission check refused `git push origin <develop sha>:refs/heads/release/2026-11-19-yaweloidle-doors` (2026-11-19 06:05 WIB). It needs a permission rule from him, or he pushes it. Develop was still 88eca73. After the cut: PR into main, read `release-cut`, promo media to `yawelo-idle-media`, purge `media.yaweloidle.com`, he approves deploy-prod, re-run deploy-door from main. Then shut #1021, #1015, #622, #1038, #783 with evidence; #1013 AC1/AC2/AC4/AC5 read after. The door change in #1046 also reaches the live door only with a release.
2. **Privacy line, final English** (to show him with the read-back): "...and each count is deleted the next time the server is used after its time window ends" (the ending changed after his "only when traffic arrives" answer; he approved the draft with that change promised).

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (Node: `~/.local/share/node/current/bin`).
2. **#164 AC2 (In Progress, PR #1046):** D1 tests seen red on the stub (run 44424102026: the 4 `limits.test.ts` tests only). Store written and pushed at 1eb09d5; read its CI by job name (`~/.claude/scripts/pr-verdict.sh 1046`), then mark the PR ready.
3. Then: merge once green and `DEV_RATE_KEY` exists, check deploy-dev, prove on dev (11th registration from one network → 429 with Retry-After at dev-api.yaweloidle.com; workers.dev directly, since the door passes addresses only after the next release). #164 stays open for the device-token half (no route takes a token yet).
4. **#52** (P3, draft PR #1042): renumber its migration to 0003 if #1046 merges first (comment on #1042).

## Done this session

- #164: Shyden's rulings recorded (deletion only when traffic arrives; privacy line approved). Measured: cross-zone subrequests carry `CF-Connecting-IP: 2a06:98c0:3600::103`, so the door now passes the caller's address. Commits red then green with mutations each: network part, keyed hash and window, door address, router 429, fail-closed for state-changing routes (security review), privacy line en + id (Google read-back), sync deploy secrets.
