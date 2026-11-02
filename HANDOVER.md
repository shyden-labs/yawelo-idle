# Handover: Yawelo Idle

**Written:** 2026-11-02 14:25 UTC (thirty-sixth session). **Phones unavailable: no device work until Shyden says.**
**Running when written:** nothing local, nothing external.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin`. board-next names #768, which waits on Shyden, as does #783: skip both.

## Done this session

- Merged PR #849, #852, #853, #856. Shut #846, #848, #851, #588 (public Swagger at `/api/docs`, verified on dev in three engines; evidence on the ticket).
- Filed #854 (Indonesian API docs with a machine-translation notice, P3, 3 pts) and #855 (report-a-mistake form copied from shyden.co.uk's design, P3, 8 pts); #854 is blocked by #855.
- Cleanup pass recorded; two remote branches of closed PRs #790/#791 deleted by Shyden.
- repo-template's request (auto-delete merged branches): already true here, replied.

## Shyden's rulings today

- No website link to `/api/docs` for now.
- Indonesian pages translated by tool carry a notice that the text is unconfirmed, and the shyden.co.uk-style report form (not GitHub).
- The report form caps reports per visitor by IP like shyden.co.uk: short-lived counter only, privacy-page line in en + id for his approval (on #855).
- The roadmap launches with the English API docs; Indonesian follows (#854 does not block #759).

## Next

1. Pick by `board-next` (after #768/#783): the unblocked P1s are #589 (private Swagger for health + webhook, the #588 pattern), #655 (SonarCloud), #830, #850. #425/#426/#457/#759 wait on #784 (Shyden's Cloudflare login).
2. Any new public text, docs included: Shyden approves it and it gets Indonesian (or his explicit ruling) before it ships.

## Waiting on Shyden

- **Open PRs with no recent movement:** #602 (Stryker, waits on a runner release), #745 (#728), #767 (#762), and Dependabot #593, #594, #597, #750, #763, #764, #779, #834 (likely failing on `ROADMAP_APP_KEY`, #661 AC1).
- **Test board** (project 6): keep or delete. **Epic Public titles**: none set. **ETA confidence rule** (#828). **Voyage order** for #328/#331/#452. **Other work** line (46 epic-less stories).
- #768 (old dev bucket's r2.dev address off), #783 (planted non-release PR into main), #784, #788, #797.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Worktrees kept: `-36` (open PR #602), `-728b` (PR #745, 10 commits ahead of origin), `-761` (PR #767, 10 ahead), `-752` (no PR, 3 unpushed commits), `-794` (no PR, no upstream), `-728-probe` (uncommitted probe files): ask before removing any.
- Local branches kept: nine `backup/*` (all newer than 30 days) and `tooling/785-nvmrc-exact` `-b`/`-c`/`-d` (earlier attempts, no PR; #789 merged `-e`).
- Scratch refs on origin (Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-11-02 14:25 UTC)

- By tickets: 38% (168 of 439), pace 4.00 a day, ETA 2027-01-09 (medium confidence: 5 of 7 days moved).
- By effort: 1,172 points remaining across 271 open stories, pace 10.71 a day, ETA 2027-02-20 (medium confidence). Both before outside waits (#784's login, device sign-off).
