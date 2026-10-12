# Handover: Yawelo Idle

**Written:** 2026-10-12 20:50 UTC. Nothing local is running. The #536 load sampler runs under launchd and survives `/clear`. Dev is deployed and verified at `b3d56c0`.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once.

## Progress (from `node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` at 20:49 UTC)

- **By tickets: 27% complete** (92 of 345 in-scope stories closed). Measured pace 6.14 a day over 7 days (ETA at that pace 2026-11-23). **ETA to release-ready: 2026-12-14 to 2027-01-22** (low to medium confidence).
- **By effort: 1,173 points remaining** across 253 open stories (446 of 1,619 closed). Measured pace 27.57 points a day (ETA at that pace 2026-11-24). **ETA to release-ready: 2026-12-10 to 2027-01-20** (low to medium confidence).
- **Measured:** counts and paces. **Assumed:** 20–30 points a working day; about 30 unfiled prestige stories (130–180 points); 1.5–2.5 weeks of outside waits.

## Done this session (2026-10-12)

- **#567 closed** (PR #570, `b8ea129`): the effort line now reads "N points remaining across M open stories"; the "storys" plural fixed; the close-out hook accepts it.
- **#553 closed** (PR #569, `b3d56c0`): the golden player resumes mid-open; each open is cut into `max(2, ceil(work/4000))` pieces (work = hours-weighted events × words held). 380 slices, 25 opens in 3–5 pieces (`GOLDEN_OPEN_PARTS`), 24 shop-free slices proven by their own tests (`GOLDEN_SHOP_FREE_SLICES`), log byte-identical. AC1: heaviest golden/shop test 77 → 40 ms; no unit test over 70 ms. Plan `docs/superpowers/plans/2026-10-13-m1-553-half-slices.md`.
- **#568 measured** (comment on #568): the cost is the `first` answer (24 h `nextPurchaseTick` from nothing held); a smaller dear count (≤200) breaks the case, so the cut must come from that search's work.

## Shyden's rulings (2026-10-12)

1. #553: "Halve every slice", "Halve, player resumable", then "Third part, heaviest opens", "splitting 3, 4, 5 etc is ok. it's doesn't have to halved", and for pieces with no shop read "Prove them shop-free" (all recorded on #553).
2. "Lock waits for low load" (#536 AC2); load sampler allowed; "squash" a PR whose commits move floors; "At file load" for a tool's one-off setup; #565 dropped.

## Resume steps

1. Run `ListAgents` and `node -v` (prefix `export PATH=/opt/homebrew/opt/node/bin:$PATH;` if not 26). Re-read #536 and #568.
2. **#536 lock (from about 16:46 UTC on 2026-10-13):** report the share of minutes below 16/24/32/48/64 from `.superpowers/sdd/536/load-samples.tsv` beside the pass rate by load (`.superpowers/sdd/536-timeouts.py` over all `m-*.jsonl`), then remove the sampler (`launchctl bootout gui/501/uk.co.shyden.load-sample`; delete `~/Library/LaunchAgents/uk.co.shyden.load-sample.plist`). Then put the line and a maximum wait to Shyden before changing `test-lock.zsh` (with its own test).
3. Until the lock lands, a local unit failure that is only a 1 s wall timeout at high load is posted on #536 with its load, never re-run.
4. **#568** (1 point): cut the `first` answer's work in `packages/core/test/rate-memo.test.ts › fewer regions reached` (probe `.superpowers/sdd/568/parts.test.ts`, experiment `dear.py`); keep AC3's mutation (`reached` dropped from both `pricedAt` key checks) red.
5. Then #541 (unit file load limits), #84.

## Lessons recorded this session

- A cut by events missed the resume's weight, and a cut by weight missed purchase-heavy shop checks: measure each test family's cost before choosing a cut. The cost model (buckets × words) is in `cutOpen`'s doc.
- A renumbered corpus needs its floors retired by hand: the recorder refuses lowering, rightly.
- A mutation predicted inert killed 11 slices (the review count identifies a stop): predict from what reads a value, not from what it was added for.

## Waiting on Shyden

- `handover/overnight-2026-10-05`: one local-only commit, kept until you say.
- Still open from before: Spotlight privacy for `~/Developer/Repos`; the `gh api …/logs` hook (missed the escape flag again today); Docker for #467; #451 AC3; #341 AC8 a–d (PR #438 must not merge before that); #343 Buttondown; #333, #425/#426, #345, #455.

## State

- `develop` at `b3d56c0`, checked out here; this file goes in on a `handover/…` branch. Open PRs: #438 (#341).
- Worktrees: `../yawelo-idle-341`, `-341-gate`, `../yawelo-idle-develop-bench` (detached at `b3d56c0`, clean, fresh `npm ci`).
- Session tools (git-ignored): bench `.superpowers/sdd/553/` (measure copy, `m-*` runs, mutation logs, probes); main `.superpowers/sdd/553/`, `.superpowers/sdd/568/`, `.superpowers/sdd/536/`.
