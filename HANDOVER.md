# Handover: Yawelo Idle

**Written:** 2026-11-20 20:20 WIB, session `yawelo-idle-53`. Branch `handover/2026-10-17-d`. Main is at c634281 (release #1050). Worktrees: `yawelo-idle-52` (927edb1, draft PR #1042), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at develop 70bc717). No Colima, simulator or USB claim. Nothing running; no local job to re-run.

## State

- **Release #1050 is finished.** The 3 promo files were uploaded to R2 `yawelo-idle-media`, purged, and are byte-identical live. deploy-prod 44640895992 verify was re-run: all green. deploy-door 44729311334 from main: success. `test.yaweloidle.com` answers 200 with commit 254318f, the cut's head.
- **Closed with live evidence:** #1015, #622, #1038, #783 (planted PR #1053 refused by `release-cut` by name, then closed; branch and worktree deleted), and #1021.
- **#1013:** the old Worker `yawelo-idle-site` (shyden.co.uk account) and the Pages project `yawelo-idle-dev-hosts` (Shyden Labs Dev; 300 deployments and 3 domains removed with a temporary Pages-only token, which was then deleted) are both gone. The 4 old hosts still answer 308 with path and query kept. Evidence is on #1013.
- **Phones:** Shyden freed them (relayed by repo-template). Yawelo has no run to do: #992/#993 are blocked by playwright-devices#7 (open), and #997–#1000 wait on those.
- Chrome's Cloudflare login is now Shyden Labs again (not Yawelo).
- `@shyden-labs/playwright-devices` `>=` rule: the package isn't in this repo yet. #1003 adds it and must declare a `>=` range.

## Open question to Shyden

- He pasted a panel message saying to change "your domain(s)" nameservers to ns1/ns2.athenapanel.com. My advice was NOT to do this for yaweloidle.com (everything runs on Cloudflare DNS). Ask which domain it was for.

## Resume steps

1. `ListAgents`; then from `../yawelo-idle-dev-scripts` (`git fetch && git checkout --detach origin/develop`; Node: `~/.local/share/node/current/bin`) run `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`.
2. #1013: read the ACs left open (AC1 yawelo.com → yaweloidle.com 301: no DNS records yet, needs Yawelo's Cloudflare login; AC4 promo media in a real browser on the new hosts; AC5). Close it only on measurements.
3. #52 (draft PR #1042) and #164 as in the earlier handover: #52 open items itemId check, AC5/AC9 (Shyden), AC11; #164 two networks through `dev-api.` get separate counts.
