# Handover: Yawelo Idle

**Written:** 2026-11-11 01:45 WIB (sixty-fifth session, overnight), ready for the **laptop shutdown** Shyden asked for. Nothing runs locally: the PR-verdict waiter was stopped (it was only polling; nothing to re-run). No Colima or device claim held. **Phones:** none needed. Everything is committed and pushed except this handover branch's own commits.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. Each worktree below needs `npm ci` only if its `node_modules` was lost.

## Done this session

- **Merged into develop:** #944 (#942, Node's pin moved to `docker/node/Dockerfile`), #952 (#305, spec records the 2026-10-04 decisions), #946 (#458, daily Dependabot check, `4d971e6de171136a85a200d6c79c6c74f84b748f`).
- **Closed:** #305; #655 (AC5: Dependabot's own run scanned #949, gate OK).
- **#942 AC3 met:** Dependabot opened #947 (Node 26.13.0) three minutes after the move.
- **Shyden's rulings (2026-11-10, on #784):** CI's checks move to workers.dev with the 11-15 account move; the door deploys from its own hand-started workflow from main.
- #458 AC0 recorded and its stale #455 blocker removed; ShyDesk's PSE text recorded on #929.
- Progress page republished (v27, 01:40 WIB).

## Open PRs (merge each only when green on its head and containing develop's head; `gh pr update-branch <n>` when behind)

| PR | What | Worktree | Last state |
| --- | --- | --- | --- |
| #943 | #784 door deploy (`deploy-door.yml`, door secrets, `tempPath`) | `../yawelo-idle-784` (`feat/784-door-deploy`) | red only on Sonar **tssecurity:S8707** at `scripts/secrets-file.ts:29` (path from the command line), even with `tempPath`; behind develop |
| — | #784 door check (`door-check.ts`, `door-check.yml`, `door-cron`) | same worktree, `feat/784-door-check` (pushed `5cdd2ec6`, contains #943) | open its PR after #943 merges |
| #945 | #715 verify names its copy | `../yawelo-idle-715` | green, behind develop |
| #947 | Dependabot Node 26.13.0 (+ pin test moved) | `../yawelo-idle-947` | green, behind develop |
| #948–#950 | Dependabot npm bumps | — | green; behind or unknown |
| #951 | Dependabot Playwright 1.65.0 (+ image pins moved to v1.65.0-noble) | `../yawelo-idle-951` | green, behind develop |

## Resume steps

1. **#943's S8707:** Sonar's taint check does not accept `tempPath` as a sanitiser. Options: write to a fixed name under `RUNNER_TEMP` with no path argument at all, or ask Shyden to mark it Safe in SonarCloud. The first is a code change, tests first.
2. Update and merge the green PRs one at a time (each merge puts the rest behind). After #947: record #942 AC4 (laptop's 26.13.0: ICU 78.3, CLDR 48.0, tz 2026e) and #793 AC6 (CI's Node changed with the bump), close #942, check #793.
3. **#458 AC3:** planted run 42914796681 (`dependabot-daily.yml`, `plant_failure=true`) was started at 01:20 WIB. Read its log and the issue it opened ("Dependabot has stopped updating"); Shyden confirms it reached him, then close the issue as a planted test and close #458. The scheduled run at 01:53 UTC may also report the 2026-11-04 minimatch failures (fixed by #872) until 20:34 UTC today.
4. After #945 merges: the next deploy-dev `verify-holding` log shows the dev copy's line (#715 DoD), then close #715.
5. **#467:** Google's allowance resets at 08:00 UTC (15:00 WIB). The population is 15 Indonesian strings: `apps/site/src/copy.ts` (`COPY.id` less "Yawelo Idle", and `LEGAL.id`) and `packages/ui/src/Shell.svelte`'s `lang="id"` section; write them as a JSON array and run `node scripts/google-read-back.ts id en < texts.json`.
6. **PARKED until 2026-11-15:** #784 go-live (account, keys, `production` secrets `DOOR_ORIGIN_DOMAIN`/`DEV_DOOR_SECRET`/`TEST_DOOR_SECRET`, `door-cron` environment with `DOOR_ANALYTICS_TOKEN`, CI to workers.dev, door-host guard AC1b, daily dispatch of `door-check.yml`).

## Waiting on Shyden

- **#106 and #107 scope:** both lean on later stories (no real course packs, most kinds `{ id }` only, no Steam or mobile build); their ACs need re-scoping.
- **Sonar exclusion** of `docker/node/Dockerfile` (S6471 on a file no image is built from), reversible.
- **#458:** confirm the planted issue reached you; the `dependabot-down` label was not added (the shared reporter has none).
- **#717:** the outside timer's alert channel is your call.
- From before: stray `~/Developer/Repos/scratch-928-*`/`scratch-ho-*` logs; #830 roadmap text; Sparked Host ticket #073955; Epic #6 close; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only, ahead of origin).
- `origin/develop` at `4d971e6de171136a85a200d6c79c6c74f84b748f`.
- Worktrees: `-dev-scripts` (detached), `-458` (merged, removable), `-715`, `-784`, `-947`, `-951`.
