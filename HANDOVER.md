# Handover: Yawelo Idle

**Written:** 2026-11-11 01:10 WIB (sixty-fifth session, overnight; Shyden asleep until about 06:00 and asked for no pause). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- **Merged:** PR #944 (#942: Node's pin moved to `docker/node/Dockerfile`, `74af5bd6`), PR #952 (#305: spec records the 2026-10-04 decisions, `d31a0d3c`). #305 closed.
- **#942 AC3 met:** Dependabot opened #947 (Node 26.13.0) three minutes after the merge. #655 closed (AC5: Dependabot's own run scanned #949, gate OK).
- **Shyden's rulings (2026-11-10, on #784):** CI's checks move to workers.dev **with the 11-15 account move**; the door deploys from **its own hand-started workflow from main**.
- #458's AC0 measured and recorded; its stale "Blocked by #455" link removed (the shared reporter exists as `scripts/issue-report.ts`).
- ShyDesk's PSE text (relayed by the ShyDesk session) recorded on #929.

## Open PRs (all into develop; merge each only when green on its head and containing develop's head)

| PR | Ticket | Branch / worktree | State at writing |
| --- | --- | --- | --- |
| #943 | #784 door deploy (`deploy-door.yml`, `scripts/door-secrets.ts`, `scripts/secrets-file.ts` with `tempPath`) | `feat/784-door-deploy` in `../yawelo-idle-784` | Sonar fixes pushed (`8cae4472`), CI running |
| (none yet) | #784 door check (`scripts/door-check.ts`, `door-check.yml`, `door-cron` env) | `feat/784-door-check` in `../yawelo-idle-784`, local only, contains #943 | Open its PR after #943 merges: `git merge origin/develop`, unit, push |
| #945 | #715 verify names its copy | `fix/715-verify-names-its-environment` in `../yawelo-idle-715` | coverage fix pushed (`bc362d62`); behind develop |
| #946 | #458 daily Dependabot check | `feat/458-dependabot-daily` in `../yawelo-idle-458` | Sonar fixes pushed (`adec2e06`) |
| #947 | Dependabot Node 26.13.0 (#942 AC4, #793 AC6) | `../yawelo-idle-947` | pin test moved to 26.13.0 (`4314900f`) |
| #948–#950 | Dependabot npm bumps | — | #949, #950 green before #952 merged |
| #951 | Dependabot Playwright 1.65.0 | `../yawelo-idle-951` | image pins moved to v1.65.0-noble (`cf46d65b`) |

## Resume steps

1. Read each PR's verdict (`~/.claude/scripts/pr-verdict.sh <n>`); for one green but behind develop, `gh pr update-branch <n>` and wait; merge with `--match-head-commit` from a file. After #947 merges: #942 AC4 (ICU 78.3 / CLDR 48.0 measured on 26.13.0) and #793 AC6 (CI's Node changed with the bump), then close #942 and check #793.
2. After #946 merges: dispatch `dependabot-daily.yml` on develop with `plant_failure=true` (AC3); Shyden confirms the issue reached him. Note: the two 2026-11-04 minimatch failures stay in its window until 2026-11-11 20:34 UTC, so the first scheduled run (01:53 UTC) may open an issue about them (fixed by #872).
3. After #945 merges: the next deploy-dev `verify-holding` log shows the dev copy's line (#715 DoD), then close #715.
4. **#467** (M2 chain): Google's daily allowance was spent (15,845 of 16,000 on 2026-11-10's Google day); it resets at 08:00 UTC. The population is 15 Indonesian strings: `apps/site/src/copy.ts` (`COPY.id` less "Yawelo Idle", and `LEGAL.id`) and `packages/ui/src/Shell.svelte`'s `lang="id"` section; write them as a JSON array and run `node scripts/google-read-back.ts id en < texts.json`.
5. **PARKED until 2026-11-15:** #784 go-live (account, keys, door secrets `DOOR_ORIGIN_DOMAIN`/`DEV_DOOR_SECRET`/`TEST_DOOR_SECRET` in `production`, `door-cron` environment with `DOOR_ANALYTICS_TOKEN`, CI to workers.dev, door-host guard AC1b, daily dispatch of `door-check.yml`).

## Waiting on Shyden

- **#106 and #107 scope:** both lean on later stories (no real course packs; most kinds are `{ id }` only; no Steam or mobile build), so their ACs need re-scoping before work.
- **Sonar exclusion** of `docker/node/Dockerfile` (docker:S6471 "runs as root" on a file no image is built from), in `sonar-project.properties`; reversible.
- **#458 AC3:** the `dependabot-down` label is not added (the shared reporter has no labels); confirm the planted issue reached you.
- From before: stray `~/Developer/Repos/scratch-928-*`/`scratch-ho-*` logs; #830 roadmap text; Sparked Host ticket #073955; Epic #6 close; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only, ahead of origin).
- `origin/develop` at `d31a0d3c7eb30770ce814af7b725079abb33f2ac`.
- Worktrees: `-dev-scripts` (detached), `-458`, `-715`, `-784`, `-947`, `-951`.
