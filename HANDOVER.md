# Handover: Yawelo Idle

**Written:** 2026-11-26 13:52 WIB, session `yawelo-idle-a9`. Branch `handover/2026-10-17-d`. develop at 8597aac6 (#1119 merged). **No devices available** (relayed by repo-template): park device steps. No Colima, simulator or USB claim. Session notes (git-ignored): `.superpowers/sdd/1072/data-inventory.md` (incl. ShyDesk's facts; source `shydesk docs/pse-registration.md`), `.superpowers/sdd/1078/step1-plan.md`. Scratch helper: `$SCRATCH/run-when-quiet.zsh <worktree> <label>` waits for 1-min load < 16 (30 min ceiling), runs unit, pushes on green. The laptop's load reached 95 with 3 GB swap today, which timed out unit tests; #1123 covers the no-email one.

## Shyden's decisions today (2026-11-26)

- Rule: CI caches every download and still takes newer versions; **a job holding a secret or write permission restores nothing** (security exception from repo-template#224). Global rule + reference updated; repo-template#224 merged.
- Roadmap webhook: **the dev door lets `POST /hooks/github` through without a pass** (comment on #1078).
- Privacy: **#635, #423, #343 raised to P0**; #423 linked as #1072's blocker (read back).

## Open PRs (worktree, ticket)

| PR | Ticket | State at writing |
|---|---|---|
| #1122 | #1120 (P0 security: 8 secret-holding jobs restored npm cache) | on 8597aac6, unit 15,121, CI running |
| #1117 | #1115 (deploy-dev Edge: named stall, **no cache**) | on 8597aac6, unit 15,109, CI running |
| #1124 | #1118 (Node cache in 4 no-secret container jobs, `/__t`) | on 8597aac6, unit 15,115, CI running |
| #1125 | #1121 (DEV-pass files from repo-template#221) | on 8597aac6, unit 15,104, CI running |
| #1126 | #1074 AC5 page test | on 326146c5 (needs develop merged in before merge), CI running |
| (opening) | #1123 growth test, `test/1123-no-email-growth` | unit 15,103; red on the old regex (growth 14.8–16.8 vs 10). AC3 (passes under load) NOT proven: load was ~7 |
| #986 (draft) | #160 | untouched |

Every merge puts the others behind develop (strict hook): merge one, merge develop into the next, `run-when-quiet.zsh`, wait for CI, repeat.

## Tickets

- Closed today: #1103 (evidence 7184244576), #1106 (Sonar develop 0).
- **#1107 (Todo):** fix merged as 8597aac6 (PR #1119). Close once develop's own `sonar-coverage` passes on it.
- **#1074 (In Progress once its PR opens):** ACs evidenced (comment 7184566520) except AC5's page half; the new test was watched red on a planted failure line.
- **#1123 (P0, new):** no-email linear-time test fails on a busy machine (158 ms vs 100 ms).
- **#1072 (P0):** blocked by #423 → #635, #343. #343 is Shyden's newsletter-provider pick.
- **#1078 (P0):** step 1 (CI sends door secret + `x-yawelo-door` to workers.dev addresses) after #1117 merges; webhook decision recorded.
- #784: my "sync never calls `refusal()`" comment was WRONG (it uses `behindDoor`); corrected in place (7178887452).
- #169: pairing-row cleanup AC added.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. For each open PR: `pr-verdict.sh`; merge green, up-to-date heads (`--match-head-commit` from a file) in order #1122, #1117, #1124, #1125, then the #1074 test PR; after each merge, merge develop into the next and re-run (use `run-when-quiet.zsh`). Clean each worktree + branches and set the ticket's status in the same step.
3. After merges: #1107 close on develop sonar-coverage; #1115 close after reading the next deploy-dev's Edge install log; #1118 close after a run logs "Found in cache" for Node; #1120 close after the changed workflows' next runs log no restore (prod ones when Shyden next approves); #1074 close after its test PR.
4. #1123 stays open until a full unit run at high load passes; then #1078 step 1.
