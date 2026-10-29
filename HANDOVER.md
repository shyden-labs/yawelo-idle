# Handover: Yawelo Idle

**Written:** 2026-10-29 (twenty-fifth session, overnight; Shyden asleep until 06:00 WIB, said to carry on without him). **Running when written:** nothing.
**Next session:** `ListAgents`, then `board-next`. It names **#728** (P0, In Progress, blocked by #733). The ranking is by design: In Progress before unblocked (`scripts/board-next.ts:8`). Its chain is #728 ← #733 (#762's Task 1) ← #762 ← **#780**, so **#780 is the first workable ticket**.

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## This session

- Pass 8, part 1 of #762's plan (log in `../yawelo-idle-761/.superpowers/sdd/762/plan.md`, backup `plan.md.bak-pass8-2026-10-29`): "side by side" can't live in #762, because a record runs develop's `record-floors.yml`. Shapes counted (`probes/count.py`, `probes/*-sketch.yml`): a dynamic matrix is +29 lines, fixed shards `[0..10]` are +3. Merging the two record jobs was refused by measurement (`04aefda`: 15 statements against 12).
- **Ruled by Shyden: "Drop 3 step labels"** pays for the +3.
- Filed **#780** (P0, 3 points, Todo, on the board; body also in `.superpowers/sdd/762/precursor-issue.md`). #762 is now blocked by #780 (read back through REST; the router refuses a bare GraphQL `addBlockedBy`, so name the repo with `repos/…/issues/N/dependencies/blocked_by`). Rulings commented on #762 (issuecomment-6483613396).

## #780 (next; re-scoped, 8 points)

Shyden withdrew "Drop 3 step labels" (it hid 3 untested lines) and ruled **"test the 3 lines, fix the problem"**, then **"Yes, re-scope #780"**. #780's ACs 6-11 (read on GitHub): develop's one-job `rehearse` runs the measured commit's `rehearse.ts`, which runs `act -j rehearse` on the commit's own `record-floors.yml`, traced by `scripts/trace-step.sh` (which measures its own lines by observation: AC7) and joined by `traceTable` (kind `trace` for that file and the tracer). Body source: `../yawelo-idle-761/.superpowers/sdd/762/precursor-issue.md`.

1. **Measure first** (AC6): does act run `record-floors.yml`'s `rehearse` job inside develop's 10-minute job on a runner? If not, stop and report.
2. Worktree off `origin/develop` (`bb7179e`), branch `tooling/780-rehearse-shards`, `npm ci`. TDD per the ACs, then one squashed commit, scratch-ref record, `floors:fetch`, and a push with its `Floors:` line.

## #762 (worktree `../yawelo-idle-761`, HEAD `8fc4704`, not pushed by design)

Merge of develop `bb7179e` committed as `8fc4704`. Unit on the merged tree: 14,250 tests, 9 fail, all floor breaches (expected until the record; list in `.superpowers/sdd/762/unit-merge-fails.txt`). Next: Task 1 (#733, child processes) can start. Tasks 2, 4 and 6 get rewritten on #780's machinery once it lands. #762 is blocked by #780.

## Waiting on Shyden

- Delete the #771 scratch ref `refs/floors/tooling/771-record-rehearse-job` (`1450a1e`); its delete was refused (final).
- `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- How to measure a unit test's own CPU now the overlay is refused (#536).
- Offered: a hook refusing a call sent beside a failed Edit.

## Progress (board read 2026-10-29, after #780 was filed)

- **By tickets:** 32% complete (140 of 444 in-scope stories), 0.57/day over 7 days. ETA 2028-04-12 before outside waits (low confidence: five of seven days at zero).
- **By effort:** 1,326 points remaining across 304 open stories, 1.57 points/day over 7 days. ETA 2029-02-18 before outside waits (low confidence).
- Measured: the board and its 7-day pace. Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone production sign-off at release (no date).

## State

- Main checkout on `handover/2026-10-17-d` (local handover commits). Its CLAUDE.md is OLD; read develop's.
- Worktrees: `-761` (#762, merge committed); `-771`; `-728b`, `-752`, `-36` parked; `-728-probe` has uncommitted probe files, so ask before removing it.
- Phones connected; nothing phone-held runs before the release (#713 AC5).
- Backups kept 30 days: tag `backup/771-pre-squash-2026-10-28`, `~/.claude/hooks/*.bak-2026-10-28-*`, `.superpowers/HANDOVER.bak-2026-10-29-s25`, the plan backup above.
- Restart-safe: no local job runs, and nothing needed is in `$TMPDIR`.
- This shell's `grep` is a wrapper that missed a planted control: use `/usr/bin/grep` for searches whose empty result matters.
