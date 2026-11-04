# Handover: Yawelo Idle

**Written:** 2026-11-04 03:10 UTC (thirty-seventh session). **Phones unavailable: no device work until Shyden says.**
**Running when written:** nothing local, nothing external.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. #783 waits on #762; skip it.

## Done this session

- #859 closed as not planned (Shyden: "Close it, watch for repeats"). Measured: slice 354 needs ~0.03 s CPU; CPU load up to 127 (36 busy loops) gave 0 of 12,915 failures twice; load average does not track the wait for a core. Cause of the 11-03 timeout unmeasured (open suspect: memory pressure during device runs). **At the next laptop unit timeout, capture memory_pressure, vm.swapusage, vm.loadavg and running sessions at once, then file a ticket.** No load wait built.
- ShyDesk change (shyden-labs/shydesk#30, via `shydesk-42`): filed **#860** (support + ticket pages embed `/support-api/embed.js`; site Worker forwards `/support-api/*` with the forward key and client IP, 8 MB bodies; P3, 5 pts, blocked by shyden-labs/shydesk#26). #858 no longer uses the dead `/contact?product=` link and points at #860.

## Next

1. Pick by `board-next` (skip #783): the unblocked P1s are #589 (private Swagger for health + webhook, the #588 pattern), #655 (SonarCloud), #830, #850. #425/#426/#457/#759 wait on #784 (Shyden's Cloudflare login).
2. Any new public text, docs included: Shyden approves it and it gets Indonesian (or his explicit ruling) before it ships.

## Waiting on Shyden

- **Parked questions (he declined the batch 2026-11-03; ask again on his return, one at a time):** #784 next steps (Yawelo's Gmail, Cloudflare sign-up, buy the two domains; Chrome's Cloudflare is on his shyden1988uk login now, ShyTalk needs its own back); delete test board project 6 or keep; ETA confidence rule (6-7 days high, 4-5 medium); voyage map layout (#328/#331/#452 after M8; 46 epic-less stories in one 'other work' line).
- **ShyDesk support (Shyden 2026-11-03, via ShyTalk's session):** Yawelo uses ShyDesk (session `shydesk-b4`); no FreeScout, no Brevo, no Zoho. Asked shydesk-b4 for mail routing, contract, member lookup, staff access and its blocker story; filed as **#858** (P3, 3 pts, blocked by shyden-labs/shydesk#27); its first AC is Shyden's placement ruling. Then tell shyden-co-uk-e0 the placement and ticket (shyden.co.uk copies Yawelo/ShyTalk). Placement of the contact link is Shyden's call.
- **Open PRs with no recent movement:** #602 (Stryker, waits on a runner release), #745 (#728), #767 (#762), and Dependabot #593, #594, #597, #750, #763, #764, #779, #834 (the `ROADMAP_APP_KEY` Dependabot secret now exists, so re-run them; #661's code ACs remain).
- **Epic Public titles**: none set (his copy).
- #784 (Gmail, Cloudflare login, buy domains). #788 needs its measurements first (mine), then his route.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Worktrees kept: `-36` (open PR #602), `-728b` (PR #745, 10 commits ahead of origin), `-761` (PR #767, 10 ahead), `-752` (no PR, 3 unpushed commits), `-794` (no PR, no upstream), `-728-probe` (uncommitted probe files): ask before removing any.
- Local branches kept: nine `backup/*` (all newer than 30 days) and `tooling/785-nvmrc-exact` `-b`/`-c`/`-d` (earlier attempts, no PR; #789 merged `-e`).
- Scratch refs on origin (Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-04 03:08 UTC)

- By tickets: 39% (170 of 441), pace 4.29 a day, ETA 2027-01-07 (medium confidence: 5 of 7 days moved).
- By effort: 1,171 points remaining across 271 open stories, pace 12.00 a day, ETA 2027-02-10 (medium confidence). Both before outside waits (#784's login, device sign-off).
