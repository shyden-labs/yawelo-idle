# Handover: Yawelo Idle

**Written:** 2026-10-29 (twenty-fifth session). **Running when written:** nothing.
**Next session:** `ListAgents`, then `board-next`. It names **#728** (P0, In Progress, blocked by #733). The ranking is by design: In Progress before unblocked (`scripts/board-next.ts:8`). Its chain is #728 ← #733 (#762's Task 1) ← #762 ← **#780**, so **#780 is the first workable ticket**.

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## This session

- Pass 8, part 1 of #762's plan (log in `../yawelo-idle-761/.superpowers/sdd/762/plan.md`, backup `plan.md.bak-pass8-2026-10-29`): "side by side" can't live in #762, because a record runs develop's `record-floors.yml`. Shapes counted (`probes/count.py`, `probes/*-sketch.yml`): a dynamic matrix is +29 lines, fixed shards `[0..10]` are +3. Merging the two record jobs was refused by measurement (`04aefda`: 15 statements against 12).
- **Ruled by Shyden: "Drop 3 step labels"** pays for the +3.
- Filed **#780** (P0, 3 points, Todo, on the board; body also in `.superpowers/sdd/762/precursor-issue.md`). #762 is now blocked by #780 (read back through REST; the router refuses a bare GraphQL `addBlockedBy`, so name the repo with `repos/…/issues/N/dependencies/blocked_by`). Rulings commented on #762 (issuecomment-6483613396).

## #780 (next, independent of the -761 merge)

1. Worktree off `origin/develop` (`bb7179e`), branch `tooling/780-rehearse-shards`. Run `npm ci` (memory: a fresh worktree has no node_modules).
2. TDD per its ACs: `rehearse(io, index, total)` (AC2), `checkRehearsal` per-shard folders (AC4), tests that find the three unlabelled steps by artifact (AC5, `record-floors-workflow.test.ts`, `748-coverage-job.ts`), then the YAML (AC1, AC5), and `codeLines` ≤ 105 (AC6), mutation file (AC7).
3. AC3 (the job ceiling) needs act's overhead over a real runner, which #762's pass 8 measures. Every other AC can go first.
4. Squash into one commit, run the scratch-ref record (`CLAUDE.md` Flow), `floors:fetch`, then push with its `Floors:` line.

## #762 state (worktree `../yawelo-idle-761`, HEAD `9e577b1`, not pushed by design)

Mid-merge with `origin/develop` `bb7179e`, uncommitted. **18 files still conflicted** (17 `tests/floors/*.json` and `tests/coverage/record.json`, all to take develop's copy). Shyden ruled "You type the command"; he hasn't run it yet:

```
cd /Users/shyden/Developer/Repos/yawelo-idle-761 && git diff --name-only --diff-filter=U | xargs git checkout --theirs --
```

Once `git diff --name-only --diff-filter=U` is empty: `git add` the 18, check no markers are left (`/usr/bin/grep -rlE '^(<<<<<<<|>>>>>>>)' --include=*.json --include=*.ts .`), run unit under the test lock, then commit the merge (`Refs #762, Refs #771`). Then Task 1 (#733) can start. Tasks 2, 4 and 6 get rewritten on the shard shape (#780), then pass 8 part 2 measures act's overhead.

## Waiting on Shyden

- The `checkout --theirs` command above.
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
- Worktrees: `-761` (#762, mid-merge); `-771`; `-728b`, `-752`, `-36` parked; `-728-probe` has uncommitted probe files, so ask before removing it.
- Phones connected; nothing phone-held runs before the release (#713 AC5).
- Backups kept 30 days: tag `backup/771-pre-squash-2026-10-28`, `~/.claude/hooks/*.bak-2026-10-28-*`, `.superpowers/HANDOVER.bak-2026-10-29-s25`, the plan backup above.
- Restart-safe: no local job runs, the mid-merge lives in `-761`'s `.git`, and nothing needed is in `$TMPDIR`.
- This shell's `grep` is a wrapper that missed a planted control: use `/usr/bin/grep` for searches whose empty result matters.
