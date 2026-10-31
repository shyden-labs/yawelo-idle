# Handover: Yawelo Idle

**Written:** 2026-10-31 (thirty-first session). **Running when written:** nothing local. External: CI on PR #820 (head `0fd1ce86`, in progress when written).
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin` (v26.12.1). The non-prod login is in `DEV_PASSWORD` / `DEV_BASIC_AUTH_PASSWORD`, loaded by `~/.zshenv` only in `yawelo-idle*` folders.

## Done this session

- #813 split (Shyden's rulings, recorded on #813): six P0 children, each linked as a sub-issue and as a "Blocked by" of #813: #814 real GitHub test board (5), #815 site harness to the real game Worker (3), #816 dev-hosts to the real dev Workers (2), #817 real D1 failure, no injected throw (3; Shyden: try a real failure, come back if impossible), #818 pre-push test with the real tools on a broken copy, CI only (2), #819 real beacon (1). #813 itself re-scored to 2 (AC4's guard test only).
- #819: PR #820 (`test/819-real-beacon`, worktree `../yawelo-idle-819`), loads the real beacon at `beacon.min.js/v8b253dfea2ab4077af8c6f58422dfbfd1689876627854` and checks `window.__cfBeacon.load === 'single'`. Local format, lint, typecheck and unit (12,677) green.

## Next

1. Run `~/.claude/scripts/pr-verdict.sh 820` (background). If green on the head SHA, read the jobs by name, see the beacon test pass in the web job's log, squash-merge into develop, close #819 by hand, remove `../yawelo-idle-819`.
2. If the web job fails on the beacon, read why (CI network, CSP, the version path) before any change.
3. Then the next child of #813 by board-next (all P0). #814 needs the App to create a test board in shyden-labs; if it cannot, ask Shyden. If a Dependabot PR then fails on the missing key, tell Shyden: he adds `ROADMAP_APP_KEY` as a Dependabot secret (ruling on #814).
4. #768 still waits on Shyden (old bucket and r2.dev off).
5. The phones are shared: message busy sessions before driving one.

## Waiting on Shyden

- #768: old bucket and r2.dev address off. #784 (Gmail and Cloudflare login), #788, #797, `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). Dead worktrees, safe to remove after a look: `../yawelo-idle-794`, `-761`, `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing.
- Scratch refs on origin, now pointless (deleting them is Shyden's call): `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`.

## Progress (board, measured 2026-10-31)

- By tickets: 35% (150 of 426), pace 1.43 a day, ETA 2027-05-13 (low confidence: 4 of 7 days moved nothing).
- By effort: 1,192 points remaining across 276 open stories, pace 3.57 a day, ETA 2027-09-30 (low confidence). Both before outside waits (#784's login, device sign-off).
