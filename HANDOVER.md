# Handover: Yawelo Idle

**Written:** 2026-11-18 08:17 WIB, session `yawelo-idle-de`. Shyden AFK until 10:00 WIB ("don't stop for anything; park what needs him"). Branch `handover/2026-10-17-d`. Worktrees: `yawelo-idle-164` (pushed, PR #1036), `yawelo-idle-1033` (pushed, PR #1035), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts`. No Colima, simulator or USB claim.

## Shyden (when back)

1. **Release PR #1030** still waits for his merge + production approval (unchanged). It also closes #757 AC6 and #783's live check.
2. **Queued question, #164 AC5 (where the rate-limit counts live).** Ask with AskUserQuestion, plain words:
   - **D1 counter** (recommended for simplicity): exact; one database write per request, sharing the free plan's 100,000 writes/day with the game.
   - **Durable Object counter**: exact; its own free allowance (100,000 requests/day); a little more code.
   - **Cloudflare's built-in rate limiter**: no writes, but approximate and per location (Cloudflare docs, read 2026-11-18), so AC2's exact Nth/N+1 boundary would have to be dropped.
     Also confirm the declared limits: `/health` 60/min, `/v1/devices` 10/hour per network.
3. **Production promo upload at the release** (#1015 AC5, #622): upload the re-encoded MP4 (1,921,671 B), WebM and poster to `yawelo-idle-media`, then purge the three `media.yaweloidle.com` URLs (#1033's new README step 4). Needs his approval.

## Resume steps

1. `ListAgents`; `npm view picomatch version` (4.0.7 at 08:00; above it → apply, drop #1018's exception); board: `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts`.
2. #1034's dev deploy (44213572853) is green on every job; recorded on #622 (open until the release).
3. **PR #1035** (#1033): branch updated 08:25 WIB; read CI by name, merge, then close #1033 with evidence (no deploy effect beyond the README/message).
4. **PR #1036** (#164 AC1/3/4): read CI by name; merge when green; #164 stays open for AC2/AC5. After merge, set #164 back to Todo (it stays open).
5. Next by Priority once those land: everything P0–P2 open is waiting on Shyden or the release (#757, #783, #1013, #784, #1021, #830, #713), on upstream (#1018), or on a time window (#864 closes after 2026-11-18 21:00 UTC, #888 after 2026-11-20 13:00 UTC). P3 candidates: #52, #165, #127.

## Done this session (2026-11-18)

- Merged: #1019 (new promo, 9a7a6ea), #1032 (versions, 6441406), #1034 (MP4 re-encode 4.98 → 1.92 MB, 6f53e20).
- Closed: #1031. #1015 AC4 proven (real Chrome plays the new video on dev).
- Found: dev media served stale files from Cloudflare's edge cache (HIT, max-age 4 h) after upload; purged; filed #1033 (P2, 1 pt).
- #622: frame check passed (Shyden: the US flag is fine); shrink done.
- Slip: #1031 left In Progress after merge turned board-orphans red on #1034; fixed (Todo).
