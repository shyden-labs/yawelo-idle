# Handover: Yawelo Idle

**Written:** 2026-11-18 11:05 WIB, session `yawelo-idle-de`. Shyden AFK again from ~10:20 WIB (park what needs him, carry on by Priority). Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-165` (pushed, PR #1037), `yawelo-idle-52` (pushed a9500f9, no PR yet), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts`. No Colima, simulator or USB claim.

## Shyden (when back)

1. **Live since ~11:00 WIB** (Shyden approved deploy-prod 44228785359 and deploy-door 44228839542): yaweloidle.com 200 (b3f8c4b), dev. 401/200 with password (377cde9), dev-api /health ok, dev-holding 200. **test.yaweloidle.com 404**: main's door still maps it to the non-existent yawelo-idle-site-test; the fix (007b7ae) missed the cut by 20 minutes, so it needs the next release (blocked by #1038) and a deploy-door re-run. Evidence on #784, #1013, #1021. Old-host 301s asked of shyden-co-uk-d6 (msg 11:05); record its curl results on #1013.
   1b. **Queued question, #1038 (P1): release #1030 was squashed into main**, so release-cut check (d) refuses the next cut. Options in the ticket (restrict main to merge commits and/or widen check (d)).
2. **Queued question, #164 AC5 (where the rate-limit counts live).** Ask with AskUserQuestion, plain words:
   - **D1 counter** (recommended for simplicity): exact; one database write per request, sharing the free plan's 100,000 writes/day with the game.
   - **Durable Object counter**: exact; its own free allowance (100,000 requests/day); a little more code.
   - **Cloudflare's built-in rate limiter**: no writes, but approximate and per location (Cloudflare docs, read 2026-11-18), so AC2's exact Nth/N+1 boundary would have to be dropped.
     Also confirm the declared limits: `/health` 60/min, `/v1/devices` 10/hour per network.
3. **Production promo upload at the release** (#1015 AC5, #622): upload the re-encoded MP4 (1,921,671 B), WebM and poster to `yawelo-idle-media`, then purge the three `media.yaweloidle.com` URLs (#1033's new README step 4). Needs his approval.
4. **Queued question, #165 / PR #1037 (test order).** The two new property tests (`packages/save/properties/encryption.test.ts`) were written before the code, against the stubs, but never run red: the properties suite is CI-only and only the 21 unit tests were run red locally. They passed in CI (124 ms). Options: (a) accept, since the unit tests cover the same cases red-first; (b) prove them red now with a draft-PR mutation in CI (memory `feedback-a-property-is-proven-red-in-ci`); (c) restart #165 from a fresh branch per "slips mean starting again". PR #1037 is green and up to date but held for this.

## Resume steps

1. `ListAgents`; `npm view picomatch version` (4.0.7 at 08:00; above it → apply, drop #1018's exception); board: `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`.
2. Merge only through the scratchpad helper `merge.sh <pr> <issue>` (merge + Todo in one command); rewrite it from memory `feedback-in-progress-after-the-branch-exists` if the scratchpad is gone.
3. **PR #1037** (#165): green on 14336d3, held for question 4. After his answer: merge (or prove red / restart); #165 stays open for AC4's flow log and AC5 (#166), so Todo at merge.
4. #164 is Todo, open for AC2/AC5 after question 2.
5. **#52 (content reports, P3, In Progress)**, branch `52-content-reports` at a9500f9: slice 1 done (strict body schema, code-point limits, 28 unit tests, mutation-checked). Next slices: (a) migration `0002_content_reports.sql` (design §B.3 tables) with its harness schema test (CI-only suite: push the red test commit first, then the migration); (b) the POST route in `routes.ts` (order: shape 422, honeypot 201 writes nothing, item 422, quota 429, duplicate 409, insert 201) with the quota upsert + insert in one D1 batch; (c) health route. Parked: AC2's item-exists check has no content ids yet (no course content until M2); AC5 and AC9 need Shyden to create the Cloudflare Access application, service token and rate-limit rule. #757 is done (AC6 met by release #1030, shut by hand); #783 still wants a refused non-release PR seen.
6. Next by Priority once those land: everything P0–P2 open is waiting on Shyden or the release (#757, #783, #1013, #784, #1021, #830, #713), on upstream (#1018), or on a time window (#864 closes after 2026-11-18 21:00 UTC, #888 after 2026-11-20 13:00 UTC). P3 candidates: #166 (save push and pull; uses #165 and #164), #127, #52.

## Done this session (2026-11-18)

- Merged: #1019 (new promo, 9a7a6ea), #1032 (versions, 6441406), #1034 (MP4 re-encode 4.98 → 1.92 MB, 6f53e20), #1035 (purge step, a0ffb21), #1036 (#164 input checks and route table, 377cde9; live on dev: 422/413/405/404 by curl).
- In PR: #1037 (#165 save key and encryption), held.
- Closed: #1031, #1033. #1015 AC4 proven (real Chrome plays the new video on dev).
- Found: dev media served stale files from Cloudflare's edge cache (HIT, max-age 4 h) after upload; purged; filed #1033 (P2, 1 pt).
- #622: frame check passed (Shyden: the US flag is fine); shrink done.
- Slips: #1031 and #1033 left In Progress after merge turned board-orphans red on #1034 and #1036; fixed; merges now go through merge.sh.
- Road to Launch page republished 09:30 WIB (version 64).
