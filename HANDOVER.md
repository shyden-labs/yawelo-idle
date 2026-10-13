# Handover: Yawelo Idle

**Written:** 2026-10-13 00:22 UTC. Nothing local is running. #568 closed; dev deployed and verified at `4ea5a10`. The #536 load sampler runs under launchd and survives `/clear`.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once.

## Progress (from `node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` at 00:21 UTC)

- **By tickets: 27% complete** (93 of 346 in-scope stories closed). Measured pace 4.86 a day over 7 days, which now includes today's first hour (1 closed) (ETA at that pace 2026-12-05). **ETA to release-ready: 2026-12-26 to 2027-02-03** (low to medium confidence).
- **By effort: 1,175 points remaining** across 253 open stories (447 of 1,622 closed). Measured pace 21.86 points a day (ETA at that pace 2026-12-06). **ETA to release-ready: 2026-12-22 to 2027-02-01** (low to medium confidence).
- **Measured:** counts and paces. **Assumed:** the same allowances as before added to the pace ETA (20–30 points a working day; about 30 unfiled prestige stories, 130–180 points; 1.5–2.5 weeks of outside waits). The 12-day slip is the 7-day window dropping a 10-story day for today's 21-minute one: a defect in `packages/progress`, filed as #575.

## Done this session (2026-10-12, evening)

- **#568 closed** (PR #573, `4ea5a10`, dev verified): `fewer regions reached` prices region 1 at 250 owned instead of 2,000. Region 1 becomes the dearer choice from 220; at 250 the day-long `first` search finds the purchase 34 s in after 2 checks instead of walking 25 hourly segments to find none. Thread CPU 53–59 ms → 8–11 ms over 5+5 unit runs (after at higher load). AC3 mutation red (both key checks, and each alone). Correction of the earlier "a smaller count cannot work" comment posted on #568 with the 200–300 scan.
- **#572 filed** (3 points, Todo): six one-off CPU spikes in 127,460 test-runs (up to 87 ms against a 13 ms median), all golden-log replay/walk tests; cause assumed GC, AC1 measures it first.
- **#575 filed** (2 points, Todo, from a side agent's note you relayed): the pace window counts today as a whole day, so the ETA swings at every UTC midnight, on the public roadmap (#341) too.

## Resume steps

1. Run `ListAgents` and `node -v` (prefix `export PATH=/opt/homebrew/opt/node/bin:$PATH;` if not 26). Re-read #568, #572 and #536.
2. **#536 lock (from about 16:46 UTC on 2026-10-13):** report the share of minutes below 16/24/32/48/64 from `.superpowers/sdd/536/load-samples.tsv` beside the pass rate by load (`.superpowers/sdd/536-timeouts.py` over all `m-*.jsonl`, now also `.superpowers/sdd/568/m-568*.jsonl`), then remove the sampler (`launchctl bootout gui/501/uk.co.shyden.load-sample`; delete `~/Library/LaunchAgents/uk.co.shyden.load-sample.plist`). Then put the line and a maximum wait to Shyden before changing `test-lock.zsh` (with its own test).
3. Until the lock lands, a local unit failure that is only a 1 s wall timeout at high load is posted on #536 with its load, never re-run.
4. Then #575 (pace from finished days only; the ETA jumped 12 days at midnight), #572 (spikes), #541 (unit file load limits), #84.

## Lessons recorded this session

- A probe that only tries one side of a threshold proves nothing about the other: #568's earlier "≤200 breaks the case" was read as "no smaller count works"; a scan across the line found 220–280 works. Scan both sides before ruling a parameter out.
- The #536 logger names a test by file and title only (no `describe`), and writes an `outside a test` row with no CPU field (verify-dev's in-process server warm-up, by ruling): filter by key presence and assert exactly one match per run.

- A figure I explain away is still a defect: I wrote off the midnight ETA jump in this file's progress note instead of filing it; #575 came from a side note. A surprise in a measured figure gets a ticket in the same turn.

## Waiting on Shyden

- `handover/overnight-2026-10-05`: one local-only commit, kept until you say.
- Still open from before: Spotlight privacy for `~/Developer/Repos`; the `gh api …/logs` hook; Docker for #467; #451 AC3; #341 AC8 a–d (PR #438 must not merge before that); #343 Buttondown; #333, #425/#426, #345, #455.

## State

- `develop` at `4ea5a10`; `m1/568-dear-count` merged. This file went in on `handover/2026-10-13a`. Open PRs: #438 (#341).
- Worktrees: `../yawelo-idle-341`, `-341-gate`, `../yawelo-idle-develop-bench` (detached at `b3d56c0`, clean).
- Session tools (git-ignored): `.superpowers/sdd/568/` (walk probe, mutate.py, drive.py, measure.py, m-568{b,a}{1..5} runs, PR and comment texts); `.superpowers/sdd/cpu-spikes/` (#572 filer); bench and main `.superpowers/sdd/553/`, `.superpowers/sdd/536/`.
