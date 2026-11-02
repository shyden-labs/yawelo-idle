# Handover: Yawelo Idle

**Written:** 2026-11-02 08:40 UTC (thirty-fifth session), laptop shutting down. **Phones unavailable: no device work until Shyden says.**
**Running when written:** nothing local (no job to re-run). External: CI on PR #849 (head `e39a4eb`) and PR #852 (head `713eef9`).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. Skip #768 and #783 (wait on Shyden).

## Done this session

- Shut: #827 (PR #832), #828 (#835), #829 (#837, #841, #843 dev login cookie), #833 (#836), #838 (#839), #840 (#842), #844 (#845); #846 merged (PR #847, `793c980`), not yet shut.
- Shyden's rulings: no post-launch on the roadmap; no leaks in public (data file, epic names, health off prod); dev login cookie for the WebKit socket 401; public wording neutral (no we/us/our, no I/me/my; tickets are not public wording; visitor consent ticks keep "I/me").
- Filed: #850 (P1, board edit under 10 s: measured 10.6/9.6/11.2 s), #851 (P0, first-mount timeout). #457 amended: prod health read privately with a secret key.

## Next

1. **PR #849 (#848, public wording)**, worktree `../yawelo-idle-826`, branch `fix/public-voice-one-person`, pushed head `e39a4eb` (develop merged in; unit 12,915 green). Re-read with `~/.claude/scripts/pr-verdict.sh 849` (it can return early; use `gh pr checks 849 --watch`), merge if green on head, then shut #848.
2. **PR #852 (#851)**, branch `fix/851-first-mount-warmup`, head `713eef9`. Same: verdict, merge, shut. One of #849/#852 will need develop merged in after the other lands.
3. **#846**: read dev's deploy of `793c980` (verify still reads `/api/roadmap/health` on dev), then shut with that evidence.
4. Then `board-next`. Worktrees `../yawelo-idle-826` and `../yawelo-idle-829w` are clean; `-829w` (branch merged as #841) can be removed.

## Waiting on Shyden

- **Test board** (shyden-labs project 6): keep or delete, his call.
- **Epic Public titles**: none of the 12 epics has one; islands read "Milestone N" / "More to come" until he sets them on the board.
- **ETA confidence rule** (#828, mine): high at 6–7 of 7 days moved, medium 4–5, low otherwise; his to change.
- **Voyage order:** where the three epics with no milestone (#328 prestige, #331 website, #452 analytics) sit on the voyage; default now: after M8, by issue number (`byDelivery` in `apps/site/src/roadmap/voyage.ts`).
- **Other work:** 46 open stories have no epic; the map counts them in one "other work" line, on no island (default, PR #831).
- #768: old dev bucket's r2.dev address off (Shyden: in the morning, 2026-11-02). #783: a planted non-release PR into main seen refused (his to open, or the next release). #784, #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Dead worktrees, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-02 08:40 UTC)

- By tickets: 38% (164 of 437), pace 3.43 a day, ETA 2027-01-21 (medium confidence: 5 of 7 days moved).
- By effort: 1,171 points remaining across 273 open stories, pace 9.29 a day, ETA 2027-03-09 (medium confidence). Both before outside waits (#784's login, device sign-off).
