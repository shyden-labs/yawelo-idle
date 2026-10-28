# Handover: Yawelo Idle

**Written:** 2026-10-29 (twenty-fourth session). **Running when written:** nothing.
**Next session:** `ListAgents`, then `board-next`. It names **#762** (P0, In Progress), which waits on Shyden twice (below).

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## #762 state (worktree `../yawelo-idle-761`, HEAD `9e577b1`, not pushed by design)

**Mid-merge, uncommitted:** `origin/develop` (`bb7179e`, #771) merged in with `--no-commit`. Resolved and staged: `.gitignore`, `scripts/coverage.ts`, `tests/unit/coverage-cli.test.ts`, `tests/unit/record-floors-workflow.test.ts`, plus `tests/unit/rehearse.test.ts` (#771's 3 extensionless imports given `.ts`). Still conflicted: **18 files**, 17 `tests/floors/*.json` and `tests/coverage/record.json`, all to take develop's copy (`floors:fetch` judges against the merge-base's record, `scripts/fetch-floors.ts:287`). `checkout-keeps-uncommitted-work` refused `git checkout --theirs`; Shyden ruled **"You type the command"** (not yet run). The list is `git diff --name-only --diff-filter=U` in the worktree.

Pass 7 of the plan (`yawelo-idle-761/.superpowers/sdd/762/plan.md`, review log) is **not clean**: P7-1, rehearsing every workflow on the measured SHA costs about 95 job-minutes per record (measured from each workflow's latest green run, `probes/wf-cost.sh`) against the `rehearse` job's 10 minutes. **Ruled by Shyden, 2026-10-29: "Practise all, side by side"**: one rehearse job per workflow file (a matrix), each with its own limit; no carry-forward.

## Resume steps

1. If `git -C ../yawelo-idle-761 diff --name-only --diff-filter=U` still lists the 18 files, Shyden has not run his command: do nothing on #762 that needs the merge.
2. Once it is empty: `git add` the 18, check that no conflict markers are left (`/usr/bin/grep -rlE '^(<<<<<<<|>>>>>>>)' --include=*.json --include=*.ts .`), run the unit suite under the test lock, then commit the merge (`Refs #762, Refs #771`). Floors stay red until the record (expected, CLAUDE.md).
3. Rewrite Tasks 2, 4 and 6 for the matrix route, then pass 8 (run the plan's code in a scratch worktree, measure act's overhead over a real runner, fix, log).
4. Task 1 (child processes) does not depend on the route, apart from its checker's one `run:` line: it can start after step 2.
5. When #762's record runs: post its manifest on #771, close #771 by hand, unlink the block.
6. The #771 scratch ref `refs/floors/tooling/771-record-rehearse-job` (`1450a1e`) is still on origin; its delete was refused (final). Shyden deletes it, or rules otherwise.

## Waiting on Shyden

- Run the `checkout --theirs` command for the 18 files (given in chat, 2026-10-29).
- Delete the #771 scratch ref (step 6).
- `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- How to measure a unit test's own CPU now the overlay is refused (#536).
- Offered: a hook refusing a call sent beside a failed Edit.

## Progress (board read 2026-10-29)

- **By tickets:** 32% complete (140 of 443 in-scope stories), 0.57/day over 7 days. ETA 2028-04-11 before outside waits (low confidence: five of seven days at zero).
- **By effort:** 1,323 points remaining across 303 open stories, 1.57 points/day over 7 days. ETA 2029-02-16 before outside waits (low confidence).
- Measured: the board and its 7-day pace. Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone production sign-off at release (no date).

## State

- Main checkout on `handover/2026-10-17-d` (local handover commits). Its CLAUDE.md is OLD; read develop's.
- Worktrees: `-761` (#762, mid-merge, above); `-771`; `-728b`, `-752`, `-36` parked; `-728-probe` has uncommitted probe files, so ask before removing it.
- Phones connected; nothing phone-held runs before the release (#713 AC5).
- Backups kept 30 days: tag `backup/771-pre-squash-2026-10-28`, `~/.claude/hooks/*.bak-2026-10-28-*`.
- Restart-safe: no local job runs; the mid-merge lives in `-761`'s `.git`; nothing needed is in `$TMPDIR` (the cost script is in `.superpowers/sdd/762/probes/`).
- This shell's `grep` is a wrapper that missed a planted control: use `/usr/bin/grep` for searches whose empty result matters.
