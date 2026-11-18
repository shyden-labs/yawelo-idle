# Handover: Yawelo Idle

**Written:** 2026-11-19 03:50 WIB, before a laptop shutdown, session `yawelo-idle-a5`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-52` (99b2aa7 pushed, draft PR #1042, clean), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at 88eca73; refresh with `git fetch && git checkout --detach origin/develop`). No Colima, simulator or USB claim. Nothing running.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`. Node: `~/.local/share/node/current/bin`. It names #783 (P0), which is proven only at the next release cut.
2. **Shyden's answers (2026-11-19 03:45 WIB), recorded on the tickets:**
   - **Release cut: approved ("Cut it").** Not done before the laptop shutdown. Push `release/2026-11-19-yaweloidle-doors` at develop's head if still 88eca73 (deploy-dev 44364453926 all green; re-read develop first), PR into main, read `release-cut`. If the permission check refuses the push again, tell Shyden it needs a permission rule. At release: promo MP4/WebM/poster to `yawelo-idle-media`, purge `media.yaweloidle.com`, he approves deploy-prod, re-run deploy-door from main. Then shut #1021, #1015, #622, #1038, #783 with evidence; #1013 AC1/AC2/AC4/AC5 read after.
   - **#164 AC2:** count tokenless requests in D1 by a keyed one-way hash of the network part of the address, deleted after its window; one privacy-page line (en + id, Google read-back). Next after the cut.
   - **#52 AC6:** the "Delete my data" half moved to #174 (comment added there).
   - Still open: the shyden.co.uk zone's Always Use HTTPS 301 can turn a plain-http POST into a GET before the 308.
3. **#52** (P3, draft PR #1042, CI green on 99b2aa7, run 44389587912): POST /v1/content-reports + health done (see PR body). Left: itemId check (M2 content), AC5 Access + AC9 rate rule (Shyden), AC6 delete half moved to #174, AC11 dev read-back via the staff API.

## Done this session

- #1018 closed (advisory withdrawn, #1044, develop deploy green). Memory removed.
- #1013 old dev cleanup finished: Shyden Labs Dev token deleted; old Worker already gone; Pages project `yawelo-idle-dev-hosts` left as Shyden chose (Cloudflare refuses: 301 deployments; inert). Old hosts still 308.
- #52: schema red (44366564259) then migration 0002 (c5096db); endpoint red (b676376, 14 unit, CI 44388451683) then green (99b2aa7); D1 tests proven by throwaway PR #1045 (6 write-dependent tests red, run 44389997171), closed, branch and worktree removed.
- Progress page republished, version 67.
