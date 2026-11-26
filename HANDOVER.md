# Handover: Yawelo Idle

**Written:** 2026-11-26 15:13 WIB, session `yawelo-idle-a9`. Branch `handover/2026-10-17-d`. develop at fcde8d3c (#1122, #1117, #1124 merged). **No devices available** (relayed by repo-template): park device steps. No Colima, simulator or USB claim. **No local job running.** Session notes (git-ignored): `.superpowers/sdd/1072/data-inventory.md` (incl. ShyDesk's facts; source `shydesk docs/pse-registration.md`), `.superpowers/sdd/1078/step1-plan.md`. Scratch helper: `$SCRATCH/run-when-quiet.zsh <worktree> <label>` waits for 1-min load < 16 (30 min ceiling), runs unit, pushes on green. The laptop's load reached 95 with 3 GB swap today, which timed out unit tests; #1123 covers the no-email one.

## Shyden's decisions today (2026-11-26)

- Rule: CI caches every download and still takes newer versions; **a job holding a secret or write permission restores nothing** (security exception from repo-template#224). Global rule + reference updated; repo-template#224 merged.
- Roadmap webhook: **the dev door lets `POST /hooks/github` through without a pass** (comment on #1078).
- Privacy: **#635, #423, #343 raised to P0**; #423 linked as #1072's blocker (read back).

## Open PRs (worktree, ticket)

| PR | Ticket | State at writing |
|---|---|---|
| #1125 | #1121 (DEV-pass files from repo-template#221) | develop merged in (b063258f); unit + push via run-when-quiet |
| #1126 | #1074 AC5 page test | on 326146c5 (needs develop merged in before merge), CI running |
| #1127 | #1123 growth test, `test/1123-no-email-growth` | pushed 4b54dc36; board-orphans RED on #1136 (my In Progress before its push; fixed, re-runs at the next develop merge); **AC3 proven**: unit 15,121/15,121 at 1-min load 29→95 (comment on #1123). CI running |
| #1137 (draft) | #1136, `ci/1136-edge-no-ubuntu-mirror` (worktree `../yawelo-idle-1136`) | f7270689: no `--with-deps` in ci.yml browsers job, apt lists cached, prefix `msedge-apt-`; red then green locally (42 tests); unit 15,121, pushed; cold run 45778515231 green, saved `msedge-apt-158.0.4370.45-1` WITH lists (one apt-get update, 34.3 MB); one-off run 45781396005: azure.archive blocked, Edge installed from cache (`0 B/221 MB`), BUT security.ubuntu.com still reached (IPv6); second one-off (IPv4+IPv6, run 45782947861): security.ubuntu.com STILL fetched (Get:6-8) though getent gives 0.0.0.0; third one-off 0bd65fe3 adds `Acquire::EnableSrvRecords "false"` (hypothesis: apt's SRV lookup skips /etc/hosts); unit, push and log read running in the background |
| #1138 | #1078 step 1: verify-dev reaches site/sync workers.dev with `DEV_DOOR_SECRET` + door name (`scripts/door-stand-in.ts`), worktree `../yawelo-idle-1078` | 4450a1e1, red 23 then green, unit 15,132; CI running. Real proof = develop's deploy-dev verify job after merge |
| #986 (draft) | #160 | untouched |

Every merge puts the others behind develop (strict hook): merge one, merge develop into the next, `run-when-quiet.zsh`, wait for CI, repeat.

## Tickets

- Closed today: #1103 (evidence 7184244576), #1106 (Sonar develop 0), #1107 (develop sonar-coverage 45769783413).
- #1118: PR #1124 merged as fcde8d3c; board Todo; close after a run logs "Found in cache" for Node.
- #1115: PR #1117 merged as b006a83c; board Todo; close after reading the next deploy-dev's Edge install log.
- **#1139 (P3, 2 pts, new):** cold Edge install took ~135 s against its 165 s limit (run 45778515231).
- Status helper: `zsh $SCRATCH/in-progress.sh <issue>` refuses In Progress unless an open PR names it (memory updated after I repeated the slip).
- #1120: PR #1122 merged as 3dc1a015; board Todo; close after the changed workflows' next runs log no restore.
- **#1074 (In Progress once its PR opens):** ACs evidenced (comment 7184566520) except AC5's page half; the new test was watched red on a planted failure line.
- **#1123 (P0, new):** no-email linear-time test fails on a busy machine (158 ms vs 100 ms).
- **#1072 (P0):** blocked by #423 → #635, #343. #343 is Shyden's newsletter-provider pick.
- **#1078 (P0):** step 1 (CI sends door secret + `x-yawelo-door` to workers.dev addresses) after #1117 merges; webhook decision recorded.
- #784: my "sync never calls `refusal()`" comment was WRONG (it uses `behindDoor`); corrected in place (7178887452).
- #169: pairing-row cleanup AC added.
- **#1136 (P2, new):** a warm Edge cache still fetches 27.5 MB of apt lists from the Ubuntu mirror (measured by ShyTalk PR #376); a mirror outage still fails the install.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. For each open PR: `pr-verdict.sh`; merge green, up-to-date heads (`--match-head-commit` from a file) in order #1125, then the #1074 test PR; after each merge, merge develop into the next and re-run (use `run-when-quiet.zsh`). Clean each worktree + branches and set the ticket's status in the same step.
3. After merges: #1115 close after reading the next deploy-dev's Edge install log; #1118 close after a run logs "Found in cache" for Node; #1120 close after the changed workflows' next runs log no restore (prod ones when Shyden next approves); #1074 close after its test PR.
4. #1123: merge #1127 when green, then close (all 3 ACs evidenced); then #1078: merge #1138, read deploy-dev's verify job on develop, then the smoke/holding/roadmap steps (plan `.superpowers/sdd/1078/step1-plan.md`).
5. #1136 (In Progress): read the IPv6 one-off run's browsers log (every Ubuntu host must show Err/Failed, none Hit) (hosts blocked, warm `msedge-apt-` restore): Edge must install. Post it on #1136, then revert the one-off with a new commit (no force-push) and mark #1137 ready. AC3 (newer Edge over an older cached one) not yet planned: needs an older Edge in the cache. Plan notes: `.superpowers/sdd/1136/plan.md`. AC1 posted on #1136.
