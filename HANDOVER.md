# Handover: Yawelo Idle

**Written:** 2026-11-19 15:55 WIB, session `yawelo-idle-a9`, before Shyden's shutdown. Branch `handover/2026-10-17-d`. Develop is at 70bc717 (#1052). Worktrees: `yawelo-idle-52` (927edb1 pushed, draft PR #1042, clean), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at develop). No Colima, simulator or USB claim. Nothing running.

## Waiting on Shyden

1. **Release PR #1050** (`release/2026-11-19-yaweloidle-doors-2` at 254318f, into main): build-and-test, release-cut, deploy-test, sonarcloud, sonar-coverage all success. He said "Not now" at 15:4x WIB. He merges it with "Create a merge commit" and approves deploy-prod. Then: promo media to `yawelo-idle-media`, purge `media.yaweloidle.com`, re-run deploy-door from main; shut #1021, #1015, #622, #1038, #783 with live evidence; read #1013 AC1/AC2/AC4/AC5.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (`git fetch && git checkout --detach origin/develop`; Node: `~/.local/share/node/current/bin`).
2. Read #1050's state. If merged, run the post-merge steps above.
3. **yawelo.com** (Shyden asked 2026-11-19): registered in Yawelo's Cloudflare account, Cloudflare nameservers, but NO DNS records, so it does not resolve. Its 301 to yaweloidle.com is #1013 AC1, not built yet. Build it after the release (proxied record + redirect, then measure `curl -I`).
4. **#52** (draft PR #1042, 927edb1): develop merged in, migration now `0003_content_reports.sql`, routes refuse uncounted, unit 14,696 passed. Open: itemId check (M2 content), AC5 Access and AC9 rate rule (Shyden), AC11 dev read-back.
5. **#164**: AC2's device-token half waits for the first token route; after the release, check two networks through `dev-api.` get separate counts.
6. playwright-devices 0.1.3 is on npm (its #16/#17 closed): #992, #993, #1003 are unblocked on that side.

## Done this session

- This repo's `.claude/settings.local.json` allows `git push origin *:refs/heads/release/*` and `gh pr create --base main --head release/*` (Shyden's choice).
- #1048 filed, fixed and closed: main's history merged into develop (#1049, 254318f, no file changed), the #679 check opened for that merge and closed again (#1052), develop ruleset back to squash only (read back 14:21 WIB). Evidence on #1048.
- #1047 closed as replaced by #1050.
- Progress page republished, version 69 (15:50 WIB).
