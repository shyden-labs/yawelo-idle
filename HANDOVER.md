# Handover: Yawelo Idle

**Written:** 2026-11-16 12:40 WIB (session `yawelo-idle-74`). Colima not used. A local `gh run watch` on deploy run 43811756555 dies with `/clear` (re-check: `gh run view 43811756555`). No background subagent.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. board-next names #783 first; it waits for the next release cut (Shyden, 2026-11-05), so skip it. **Physical devices are unavailable** (Shyden, 2026-11-16): park device work.

## In flight

- **#784 AC2, DEV into the non-PROD account: PR 988**, branch `784-move-dev`, worktree `../yawelo-idle-784`, head `21bb8205` (pushed; read by `git ls-remote`). It switches the Workers and D1 steps to `NONPROD_CLOUDFLARE_*`; the workers.dev subdomain is `yawelo-idle-non-prod` (assigned by Cloudflare, read in the Yawelo Chrome profile). `apps/dev-hosts` (Pages, stays in Shyden Labs Dev) now forwards over HTTPS through the door's `pass()`, carrying `DEV_DOOR_SECRET`, so dev. still shows the holding page. Rulings (Shyden 2026-11-16, on #784): keep the old dev names, DEV starts empty, add the dev door secret. First CI run: 2 integration failures (script list, `.ts` import), fixed in `21bb8205`; unit 14,479, typecheck and lint pass. **Next:** read dev deploy run 43811756555 (dispatched on the branch). Then read PR CI on 21bb8205 (`~/.claude/scripts/pr-verdict.sh 988`). If both are green, squash-merge into develop. Then the old Yawelo Workers and D1 in Shyden Labs Dev go (ask Shyden before deleting).
- **App permissions:** yawelo-idle-agent now holds Environments read+write (Shyden accepted). `DEV_DOOR_SECRET` was set by the App, value never shown. Manifest updated.
- **Ticket 160 (rotating backups, P3) on draft PR 986**, branch `160-save-backups`, worktree `../yawelo-idle-160`, head `e83c9455` (pushed; read by `git ls-remote`; develop merged in). Red proven in CI (run 43775290374, tag `evidence/160-red`). Implementations in; each backup's write time is in its key and a loaded read returns `savedAt`; "slots" renamed to backups/copies (Shyden: one save per player per course, hidden backups only). Guard fixes: the engines spec no longer intercepts the network (`tests/engines/page-server.ts` + webServer in `playwright.engines.config.ts`), `tests/engines/tsconfig.json` listed in erasable-syntax. SonarCloud S2871 fixed (explicit code-unit sort). Unit 14,496 pass locally; typecheck and lint pass. On 95f2ea1a build-and-test passed (engines spec and guards included); board-orphans failed only on #162 being In Progress before its close (now Done). CI green on e83c9455, every check (build-and-test, coverage, sonar-coverage, sonarcloud, board-orphans). Stays draft until the AC3 notice lands.
- **AC3 UI not built yet.** Approved English (Shyden, 2026-11-16): restored: "Your latest save was damaged, so the backup saved {when} was loaded." (`{when}` from `Intl.RelativeTimeFormat`, numeric auto); all damaged: "Your save and all its backups are damaged." with buttons "Start a new game" / "Keep the damaged save and close". Indonesian drafts in `../yawelo-idle-160/.superpowers/sdd/160/id.json`. **Google read-back refused: the 2026-11-15 Google day's 16,000 were spent (15,977); it resets at midnight Pacific = 15:00 WIB.** Then: read-back table, Shyden's approval, catalogue keys + review.ts evidence, a notice component, tests first.
- AC6 (real IndexedDB on every target): the engines spec covers browsers in CI; real phones parked.
- **#987** filed (P3, 5 pts, blocked by #160): automatic diagnostics report when every backup is damaged (diagnostics only, Shyden). #160's screen promises no report until it lands.

## Resume steps

1. **#784:** finish PR 988 (above), then create TEST in the non-PROD account.
2. After 15:00 WIB: `node scripts/google-read-back.ts id en < .superpowers/sdd/160/id.json` in `../yawelo-idle-160`; show Shyden the writer/reader table; then build the AC3 notice (failing tests first).
3. Prove the engines spec red at the red stage by a mutation PR, as #159 did (the handover rule from last session), or record why CI's guard run is enough.
4. Then: #127 (i18n runtime) or #163 (device registration, now unblocked by 162).
5. **#130**: develop's first paint is 14,924 of 15,000 gzipped bytes; mounting the store crosses it.
6. **#971**: three local timeout runs logged 2026-11-16. **#864**, **#888**: watches to 11-19 and 11-20.

## Waiting on Shyden

- #160's Indonesian (after the 15:00 WIB read-back). #783 waits for the first release with something to ship (Shyden, 2026-11-16). Real phones away. (Sparked Host #073955 already closed; S9382 no longer exists in SonarCloud.)

## Rulings this session (recorded on the tickets)

- #830 Indonesian approved as written: close it after reading the ACs. #125 colours: en-id batik dyes (soga #B5651D, teal #2E8B8B, mengkudu #B03A2E on indigo/gold); id-en per country (England racing green #1F5E3B, USA denim #3B5B8C, Australia ochre #C46A2B on navy #0E1A33/gold #D4AF37). #106/#107: cut to what exists now, file the rest as follow-ups. #635: research the applicable law first (UU 27/2022 etc.), then ask about a professional review. Phone sign-off (#632): full suite on every phone, one at a time, results to Shyden, then he plays one phone briefly and signs off.

## Done this session (2026-11-16)

- #162 D1 migrations: SQL excluded from Sonar coverage (Shyden), PR 983 squash-merged `1998b516`; dev deploy 43782785800 applied 0001 (✅); closed by hand, board Done.
- #160 red proven and implemented on PR 986; #987 filed.
- Progress page republished 08:10 WIB (version 51).
- Cleanup: 12 merged/closed branches and the -162 worktree removed (Shyden approved); mutation/36-stryker deleted on GitHub.
- #784: Yawelo Idle Non-Prod account created; its CI token saved in the dev environment.
