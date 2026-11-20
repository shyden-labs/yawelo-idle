# Handover: Yawelo Idle

**Written:** 2026-11-20 15:40 WIB, session `yawelo-idle-03`, before Shyden's laptop shutdown. Branch `handover/2026-10-17-d`. Main is at c634281 (release #1050 merged 2026-11-19 23:49 UTC). Worktrees: `yawelo-idle-52` (927edb1, draft PR #1042), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at develop 70bc717). No Colima, simulator or USB claim. Nothing running; no local job to re-run.

## State

- **Release #1050 is merged and deployed to production** (deploy-prod run 44640895992: build-and-test, coverage, deploy all success). Its **verify failed only on the 3 promo media files**: `media.yaweloidle.com` still serves the old poster (43,632 B), MP4 (4,360,966 B) and WebM (1,715,107 B); main expects 54,602 / 1,921,671 / 1,814,372. The dev bucket already matches main byte for byte (measured 2026-11-20).
- The upload is blocked on Shyden: the only connected Chrome is signed in to Cloudflare as the Shyden Labs login, which cannot see Yawelo's account. He chose "Sign in Yawelo here" (he signs that Chrome in to yaweloidle@gmail.com himself; never type a password).
- **Open question to Shyden:** he pasted a panel message saying to change "your domain(s)" nameservers to ns1/ns2.athenapanel.com. I advised NOT to do this for yaweloidle.com (all hosts, R2 domains and redirects live on Cloudflare DNS); mail needs only MX/SPF/DKIM records in Cloudflare. Ask which domain and what it was for.
- **Shyden ruled 2026-11-20:** delete the old Worker `yawelo-idle-site` (prod account) and Pages project `yawelo-idle-dev-hosts` (Shyden Labs Dev) after the release is live and checked; recorded on #1013. Before and after each delete, `curl -sI` both old hosts. Old hosts currently answer **308** (not 301) to the new hosts: compare with #1013's wording.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (`git fetch && git checkout --detach origin/develop`; Node: `~/.local/share/node/current/bin`).
2. Once Chrome is on Yawelo's Cloudflare: upload the 3 files from `apps/site/media` (main) to R2 `yawelo-idle-media`, check content types, purge the 3 `https://media.yaweloidle.com/<file>` URLs (README step 4), `curl -sI` each (not HIT, new size), then re-run deploy-prod's verify (`gh run rerun 44640895992 --failed`) and re-run deploy-door from main.
3. Then close #1021, #1015, #622, #1038, #783 with live evidence; read #1013 AC1/AC2/AC4/AC5.
4. Delete the two old Cloudflare resources per the ruling above, with the before/after redirect measurement.
5. yawelo.com: no DNS records yet; its 301 to yaweloidle.com is #1013 AC1 (proxied record + redirect, measure `curl -I`).
6. #52 (draft PR #1042) and #164 as in the previous handover: #52 open items itemId check, AC5/AC9 (Shyden), AC11; #164 two networks through `dev-api.` get separate counts.
7. New global rule (2026-11-20): `@shyden-labs/playwright-devices` declared as `>=` range, never pinned; check this repo's package.json.
