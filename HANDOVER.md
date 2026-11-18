# Handover: Yawelo Idle

**Written:** 2026-11-19 ~02:50 WIB, session `yawelo-idle-a5`. Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-52` (c5096db pushed, draft PR #1042, uncommitted slice in progress), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at 88eca73; refresh with `git fetch && git checkout --detach origin/develop`). No Colima, simulator or USB claim. Shyden is asleep: anything needing him waits as a question.

## Resume steps

1. `ListAgents`; `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`. Node: `~/.local/share/node/current/bin`.
2. **#52 slice 2 (POST /v1/content-reports + health), in `../yawelo-idle-52`, uncommitted:**
   - Written: `tests/unit/content-report-submit.test.ts` (handler with a stand-in store), `apps/sync-worker/test/content-reports.test.ts` (real D1: 201 row, 422/honeypot write nothing, 10th ok 11th 429, 429 after resolve, 20 concurrent → 10, 409 keeps quota, earlier-day quota rows deleted, health 200), `tests/unit/sync-routes.test.ts` (two new paths), throwing stubs `submitReport` / `REPORT_MAX_BYTES = 0` in `src/content-reports.ts`.
   - Queued behind the test lock when written (background job, DEAD after /clear): a python edit adding stub routes `/v1/content-reports` (POST, 10/60 s) and `/v1/content-reports/health` (GET) with `notYetWritten` handlers to `src/routes.ts`, then tsc + eslint. Check `grep -c notYetWritten apps/sync-worker/src/routes.ts`; if 0, redo it.
   - Then: commit red ("tests first against throwing stubs"), push, read CI red (unit + harness), then implement: `REPORT_MAX_BYTES = 32_768`; handler order body → honeypot (201 + id, no store) → store → 429 `daily_limit` / 409 `already_reported` / 201 `{id}`; UTC day = `toISOString().slice(0, 10)`. D1 store in `routes.ts`: one batch of (quota upsert `n = n + 1`, report insert, `DELETE … utc_day < ?`); migration 0002 gets `n … CONSTRAINT content_report_daily_limit CHECK (n BETWEEN 1 AND 10)` so the 11th fails the batch (rollback); map the CHECK name → over_quota, `UNIQUE constraint failed: content_reports.install_id` → duplicate, else rethrow. Health: `{ok:true}` 200 / 503.
   - Still parked: item ids (no course content until M2); Access (AC5) and rate rule (AC9) need Shyden.
3. **Cut a release** from green develop (88eca73 deployed green, run 44364453926): `release/<date>-<slug>`, PR into main. Proves #783 and #1038. At release: re-encoded promo MP4/WebM/poster to `yawelo-idle-media`, purge `media.yaweloidle.com`, Shyden approves deploy-prod, re-run deploy-door from main. Then shut #1021, #1015, #622, #1038, #783 by hand with evidence. #1013 still needs AC1 (test.yaweloidle.com live), AC2/AC4/AC5 read after the release.
4. **#164 AC2** (P3): rate limits counted in D1.
5. Open question for Shyden: the shyden.co.uk zone's Always Use HTTPS 301 can turn a plain-http POST into a GET before the 308.

## Done this session

- #1018 closed: advisory withdrawn, exception removed (#1044), develop deploy run 44364453926 green on every job. Picomatch memory deleted.
- #1013 old dev cleanup finished (Shyden approved each): Shyden Labs Dev token "yawelo-idle dev deploy (Workers + D1)" deleted and read back; `yawelo-idle-site` Worker already gone; Pages project `yawelo-idle-dev-hosts` left in place by Shyden's choice (Cloudflare refuses: 301 deployments; inert, 404). Old hosts still 308.
- #52: schema test red first (run 44366564259, its 3 new tests only), then migration 0002 (c5096db), CI green on it (run 44368715672).
- The test lock has been held by shyden.co.uk's device run since 18:35Z.
