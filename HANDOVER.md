# Handover: Yawelo Idle

**Written:** 2026-11-19 07:45 WIB, session `yawelo-idle-a9`. Branch `handover/2026-10-17-d`. Develop is at 195d3b8 (#1046), deploy-dev 44427054104 green on every job. Worktrees: `yawelo-idle-52` (99b2aa7 pushed, draft PR #1042, clean), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at 195d3b8). No Colima, simulator or USB claim. Nothing running. Shyden says the real phones are unavailable for now.

## Waiting on Shyden

1. **Release cut:** approved, but the permission check refused `git push origin <develop sha>:refs/heads/release/2026-11-19-yaweloidle-doors` (06:05 WIB). It needs his permission rule or his push. Cut at develop's head (now 195d3b8, which adds the door's `x-yawelo-client` header). Then: PR into main, read `release-cut`, promo media to `yawelo-idle-media`, purge `media.yaweloidle.com`, he approves deploy-prod, re-run deploy-door from main. Then shut #1021, #1015, #622, #1038, #783 with evidence; #1013 AC1/AC2/AC4/AC5 read after.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git fetch && git checkout --detach origin/develop`; Node: `~/.local/share/node/current/bin`).
2. **#164** (P3, Todo): AC1, AC3, AC4, AC5 and AC2's network half are done and proven live (comment of 2026-11-19: 10th registration 201, 11th 429 with Retry-After 1646). Open: AC2's device-token half, with the first route that takes a token. After the release, check that two networks through `dev-api.` get separate counts.
3. **#52** (P3, draft PR #1042): renumber its migration `0002_content_reports.sql` to 0003, since #1046 took 0002, and add its tables to `apps/sync-worker/test/schema.test.ts`'s list. Then: the itemId check (M2 content), AC5 Access and AC9 rate rule (Shyden), AC11 dev read-back.

## Done this session

- #164 AC2 (network half) and AC5: PR #1046 merged as 195d3b8, red then green for each step. Evidence is on #164.
- `DEV_RATE_KEY` set in the dev environment at Shyden's request.
- Progress page republished, version 68 (07:40 WIB).
