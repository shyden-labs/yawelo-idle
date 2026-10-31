# Handover: Yawelo Idle

**Written:** 2026-10-31, ~17:40 WIB (twenty-eighth session), for a laptop restart. **Running when written:** nothing (no local job; nothing to re-run).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` (expect #768, in progress). Node: `~/.local/share/node/current/bin` (v26.12.1).

## Done this session

- **#765 closed as not planned**: a hook held 252 s at load 30 still pushed fine (git reconnects before sending the pack), so the 408s were the unstable Wi-Fi. Measurement in the ticket's comment.
- **#768 dashboard (AC2a)**, Shyden approved "Yes, that name": `dev-holding.yawelo-idle.shyden.co.uk` added to the Pages project `yawelo-idle-dev-hosts` (status "Verifying" at 17:10); Cloudflare added its proxied CNAME to `yawelo-idle-dev-hosts.pages.dev` itself. It answers 403 until the adapter maps it.

## Resume steps (#768, branch `website/768-own-media-address`, worktree `../yawelo-idle-768`, local WIP commit `34531ab`, not pushed)

1. Committed so far: `DEV_MEDIA` = `PROD_MEDIA` with origin `https://dev-media.shyden.co.uk` (test first); media README rewritten (phone DNS tip gone, AC6); adapter maps `dev-holding…` to a new `HOLDING` binding (hosts.ts, wrangler.jsonc, regenerated types, harness test); holding-dev `workers_dev: false`; `DEV_HOLDING_URL` in deploy-dev.yml; dev-config tests for all of it.
2. Still red: `tests/unit/verify-prod.test.ts` ~line 461 uses `DEV_MEDIA` as a host sending no headers. No host now has `sizeOnPastEnd: false` or a `null` header, so decide: drop that dead support in `scripts/verify-prod.ts` / `MediaHost`, or keep it with a local test host. Keep it simple.
3. Sweep: `git grep -n "workers.dev\|two names"` for prose still calling the phone-check copy a workers.dev address (README.md line 33, website spec amendments).
4. AC5 guard as a **plain test** (floors and mutation files were dropped 2026-10-30): built pages for production and both dev copies load nothing from `r2.dev`, `workers.dev`, `pages.dev`, `github.io`, `netlify.app`, `vercel.app`, `web.app`, `firebaseapp.com`; watch it fail once.
5. Run the unit suite, squash the WIP commit into a proper message, push, PR into develop, CI green by step name, merge. Then AC4 needs Shyden on Biznet: both dev copies play the video in Chrome. Then he turns off the old dev-account bucket and its r2.dev address.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Live worktree `../yawelo-idle-768` (#768). Dead worktrees from before, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.
- Waiting on Shyden: #784 (Gmail and Cloudflare login for Yawelo), #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## Progress (board, measured 2026-10-31 17:35)

- By tickets: 36% (149 of 417), pace 1.29 a day, ETA 2027-05-28 (low confidence: 4 of 7 days closed nothing).
- By effort: 1,171 points remaining across 268 open stories, pace 3.14 a day, ETA 2027-11-08 (low confidence). Both before outside waits (#784's login, device sign-off, AC4 on Shyden's phone).
