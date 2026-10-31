# Handover: Yawelo Idle

**Written:** 2026-10-31 (thirtieth session). **Running when written:** nothing local, nothing external.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin` (v26.12.1). The non-prod login is in `DEV_PASSWORD` / `DEV_BASIC_AUTH_PASSWORD`, loaded by `~/.zshenv` only in `yawelo-idle*` folders (other projects use the same names).

## Done this session

- #783 + #757: PR #809 merged (`ffd8b907`), the release-cut check. `main` now requires release-cut through the ruleset "main: release cuts only" (GitHub Actions, not strict); `main`'s classic rule has strict off; `develop` is unchanged. All read back by API and recorded. Both tickets are back in Todo: #783 waits for a non-release PR into `main` to be seen refused (the local hook stops the agent opening one); #757 waits for AC6, the next release cut merging green.
- #810 closed: PR #811 merged (`a359d321`), which closes the `pull_request_target` gaps in `tests/unit/workflow-secrets.ts`.
- #768 AC4 done on Telkomsel (no Biznet available, Shyden): the video plays on laptop Chrome, Android Chrome and iPhone Safari, on both `dev` and `dev-holding`. Recorded on the ticket.
- Filed #812 (P2, 3 pts, blocks #632): the agent taps and types on the iPhone itself through shyden.co.uk's WebDriverAgent setup (recipe on the ticket).

## Next

1. board-next says #768 (P0, In Progress). Its last step is Shyden's: turn off the old dev-account bucket and its r2.dev address, then shut #768 by hand. Until then, take the next ticket that does not wait on him.
2. The phones are shared: message busy sessions before driving one (memory "Ask before driving a shared phone").

## Waiting on Shyden

- #768: old bucket and r2.dev address off. #784 (Gmail and Cloudflare login), #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Dead worktrees, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-10-31)

- By tickets: 36% (150 of 419), pace 1.43 a day, ETA 2027-05-08 (low confidence: 4 of 7 days moved nothing).
- By effort: 1,174 points remaining across 269 open stories, pace 3.57 a day, ETA 2027-09-25 (low confidence). Both before outside waits (#784's login, device sign-off).
