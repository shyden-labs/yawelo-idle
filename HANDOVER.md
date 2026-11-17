# Handover: Yawelo Idle

**Written:** 2026-11-17 08:50 WIB for session `yawelo-idle-d1`. Colima, simulators and USB phones were not claimed. No background subagent. A local deploy waiter dies with the session; re-read with step 1. Road to Launch page republished 08:45 WIB (version 56).

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## The rule that now leads (Shyden, 2026-11-17)

`~/.claude/global-rules/same-tests-on-every-device-before-device-runs.md`: open `unified-tests` tickets come before all other work, and no device or simulator run happens except one that `measures #N` of them (hook-enforced). Two groups: desktop browsers; phones and tablets (real phones, plus iPad and iPhone Duo in the iOS Simulator, Android tablet and foldable in the emulator). No desktop browser emulates a phone. The device runner is built ONCE for every project in the new repo `shyden-labs/playwright-devices` (its session is `playwright-devices-36`; first ticket shyden-labs/playwright-devices#7). Yawelo builds no runner and had no device-runner code to remove.

Current totals: desktop chromium 17, firefox 17, webkit 17 (web 1 + engines 10 + site 6, develop deploy run 43992705377 of `8102adc2`, 2026-11-17); real phones and tablets: 0, not yet measured.

## In flight

- **#996 (group tags + per-group totals)** merged as `da9437f0` (PR 1002). Board: Todo. Shut it by hand once the develop deploy of `da9437f0` or later prints `Target totals: desktop: chromium N, firefox N, webkit N` with equal N per suite (deploy run 43995171002 was in progress).
- **#989 (astro 7.4.12, vite 8.3.8)** merged as `632151f2` (PR 990). Shut it by hand once its develop deploy passes verify-dev and both smoke jobs (AC4); then tell shyden-co-uk's session the projects should move to vite 8.3.8.
- **#992 Android, #993 iPhone** (2 points each, wiring only) are blocked by shyden-labs/playwright-devices#7 (linked and read back). #997 iPad and #998 iPhone Duo wait on #993; #999 Android tablet and #1000 foldable on #992. #160 is blocked by #992 and #993 (its AC6).
- **#160 (backups), draft PR 986**, worktree `../yawelo-idle-160`. Shyden approved the Indonesian as written (Google read-back in `.superpowers/sdd/160/readback.json`). Next: the AC3 notice: catalogue keys `save.restored` ({when} via `Intl.RelativeTimeFormat`), `save.allDamaged`, `save.startNew`, `save.keepAndClose` in `packages/ui/src/i18n/catalogue.ts`, each Indonesian line's review block in `review.ts` with two sources (KBBI words: simpanan, rusak, cadangan, dimuat, permainan, pertahankan, tutup) and a record in `docs/translations/`, then a `SaveNotice.svelte` rendered in a `svelte/server` test like `Shell.test.ts`. Failing tests first. The save layer already returns `back`, `savedAt` and `allCorrupt`.

## Resume steps

1. `gh run list -R shyden-labs/yawelo-idle --branch develop --workflow deploy-dev.yml -L 3`; for the newest green run, `gh run view <id> --log | grep -o 'Target totals:.*' | sort -u`. Shut #996 and #989 by hand on that evidence; tell Shyden any failure that turn.
2. #160's AC3 notice as above.
3. Follow shyden-labs/playwright-devices#7; when it lands, start #992 and #993.
4. Later: #784 (ask Shyden about deleting the old Yawelo resources in Shyden Labs Dev), #127, #163.

## Done this session (2026-11-17)

- Deploy of `236ac629` green. PR 990 (#989), PR 1001 (#995) and PR 1002 (#996) merged; #995 shut on measured totals. #991 (deepmerge advisory withdrawn by GitHub) filed, fixed on PR 994 (`18e19416`) and closed. #995 merged. #992, #993, #995 to #1000 filed, labelled `unified-tests`, P0, scored, linked.
- Rulings: #160 Indonesian as written; #632 stays P5; build the phone runner now (as the shared repo); playwright-devices placement (relayed).
