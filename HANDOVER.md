# Handover: Yawelo Idle

**Written:** 2026-10-12 15:17 UTC: #544 merged; its deploy-dev hit a Cloudflare 504, and this handover's merge redeploys.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once.

## Progress (from `node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` at 09:57 UTC)

- **By tickets: 26% complete** (89 of 344 in-scope stories closed). Measured pace 5.71 a day over 7 days (ETA at that pace 2026-11-26). **ETA to release-ready: 2026-12-17 to 2027-01-26** (low to medium confidence).
- **By effort: 1,186 points remaining** across 255 open stories (433 of 1,619 closed). Measured pace 25.71 points a day (ETA at that pace 2026-11-28). **ETA to release-ready: 2026-12-14 to 2027-01-24** (low to medium confidence).
- **Measured:** counts and paces. **Assumed:** 4–6 stories (20–30 points) a working day; about 30 unfiled prestige stories (130–180 points); 1.5–2.5 weeks of outside waits.

## Shyden's rulings (2026-10-12)

1. **"this also needs to be tested"**: the player's 1e7 buying tests are kept, in pacing; unit plays them at 3,000.
2. **"At file load"**: a tool's one-off setup runs at the test file's load, under #541's load limit.
3. **"squash"**: a PR whose commits move floors is squashed into one commit before record-floors (now in this repo's CLAUDE.md, Flow).
4. **"Lock waits for low load"** (#536 AC2 remedy, 15:15 UTC): `~/.claude/scripts/test-lock.zsh` starts a run only below a measured load line. Recorded in `~/.claude/global-rules/reference/reference-engineering-standards.md` only. The global CLAUDE.md line was removed again because it broke the 33,542-byte ceiling; it goes in when the lock lands, offset by a cut Shyden approves. **"Push it"**: this docs-only handover was pushed past a local unit run whose only failure was a 1 s wall timeout at load 32 (shop-agreement slice 155, posted on #536).

## #544 state (PR #564 merged as `8b96959`; branch head was `53f335c`, one commit with its recorded floors)

- The first record-floors run (38230769084 on `3f60466`) failed in the guards suite: the 72 h Pemandu test had moved to `packages/bots/pacing/` while its literal-floors burn-down entry still named `packages/core/test/`. Fixed by converting it to a recorded floor (`pemandu-perf/72 h return bought`), removing the entry and lowering the literal ceilings to 52/47. That is one of #415's rows (`pemandu-perf.test.ts:134`, 1638).
- build-and-test on `3f60466` also had 24 file-count floor breaches (collection-calls, git-walks, floorless-searches, old-name, licences, supply-chain, raised-limits, line-of, record-floors…). Every one of the seven commits moved them, and CI records floors on the head only, so the seven commits were **folded into one** (`183bdeb`, message in `.superpowers/sdd/544/fold-msg.txt`). Every PR since #547 is a single commit for the same reason. **#565** (8 pts, filed) is the per-commit recording story.
- PR body updated (`.superpowers/sdd/544/pr-body.md`): one commit, #565, the Pemandu floor, ceilings 52/47.
- Local unit on the folded tree: 8,849 passed, 2 failed, both Vitest 1 s **wall** timeouts at load 136 (golden-log slice 97, shop-agreement slice 164), in files #544 doesn't touch. CI passed both on `3f60466`. Posted to #536 as AC3 evidence.

## Resume steps

1. Run `ListAgents` and `node -v` (prefix `export PATH=/opt/homebrew/opt/node/bin:$PATH;` if not 26). Re-read #544 and PR #564 from GitHub.
2. #544 is MERGED: PR #564 merged as `8b96959` at 10:13 UTC, after build-and-test 38234260788 and every-commit 38234261147 were green on `53f335c` (every step read by name). #415 got its row note.
3. Deploy-dev 38234946084 for `8b96959` **failed**: Cloudflare returned 504 on the site Worker's secrets GET (Ray `a4955be88fdac5fb-IAD`, posted on #497). The sync and game Workers deployed; the site stayed at `767869a`'s stamp, and verify was skipped. No re-run: this handover's PR (`handover/2026-10-12e`) into `develop` starts a fresh deploy-dev. Find that run by its merge SHA and read every step by name, verify included. If it is green, set #544 Done and close #544 by hand, naming #564's merge and that deploy run. If Cloudflare fails again, tell Shyden: it is outside our code.
4. Next: the lock plan on #536 (comment 6127185694). Sample the load over a working day: how often it sits below each candidate line, beside the unit pass rate there (`.superpowers/sdd/536/measure.py`). Set a maximum wait that ends with a clear error. Put the line and the maximum to Shyden, then change `test-lock.zsh` with its own test. Ask Shyden whether #565 (per-commit floor recording, 8 pts) is still wanted, given "squash".
5. Then: #553 (10 tests: shop-agreement and golden-log late slices, verify-dev), #536 AC3 (wall timeouts under load; 2 more posted today), #541, #84, #565.

## Waiting on Shyden

- `handover/overnight-2026-10-05`: one local-only commit, kept until you say.
- Still open from before: Spotlight privacy for `~/Developer/Repos`; the `gh api …/logs` hook; Docker for #467; #451 AC3; #341 AC8 a–d (PR #438 must not merge before that); #343 Buttondown; #333, #425/#426, #345, #455.

## State

- `develop` at `8b96959`. Open PRs: #438 (#341).
- This file is **uncommitted** on the #544 branch's working tree: commit it only on a `handover/…` branch, never into #564.
- Worktrees: `../yawelo-idle-341`, `-341-gate`, `../yawelo-idle-develop-bench`.
- Session tools (git-ignored): `.superpowers/sdd/544/` (`fold-msg.txt`, `pr-body.md`, `file.py` + `stories/`, `mut.py`, `probe.config.ts`, `readers.probe.ts`, `base.sha`, `head.sha`), `.superpowers/sdd/536/measure.py`.
