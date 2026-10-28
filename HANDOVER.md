# Handover: Yawelo Idle

**Written:** 2026-10-28 (twenty-third session). **Running when written:** a LOCAL mutation batch in `../yawelo-idle-771` (771, 748, 718, 728 files on `09e406e`). It dies with the session: if no `mutate-*-b.log` ends in `matched`, re-run step 1.
**Next session:** `ListAgents`, then `board-next`. It names **#771** (P0, In Progress): resume it.

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## Resume steps (#771, worktree `../yawelo-idle-771`, branch `tooling/771-record-rehearse-job`)

Pushed head `66bad12` (PR #777). Local, NOT pushed: `402ddb2`, `09e406e` (HEAD, in `.superpowers/sdd/771/local-head.sha`). Both commits passed the unit suite (158 files, 14090 tests).

1. Read `.superpowers/sdd/771/mutate-{771-record-rehearse,748-coverage-job,718-scratch-ref,728-coverage-unit}-b.log`; each must end `N of N matched`. Re-run any missing one: `source ~/.claude/scripts/test-lock.zsh heavy && npm run mutate -- tests/mutations/<f>.ts > .superpowers/sdd/771/mutate-<f>-b.log 2>&1; echo "rc=$?"` (background).
2. All matched: run the unit suite again, push (no running CI on the branch now), update `pr-head.sha` from `git rev-parse HEAD`, wait for PR #777's three required runs with `~/.claude/scripts/wait-run.sh` per run id, and read every job and step by name.
3. Floors: the two commits add no test (14090 before and after), so no floor should move. If CI's guards say otherwise, label `record-floors` after squashing (CLAUDE.md flow).
4. Green on `headRefOid`: squash-merge into develop with `--match-head-commit "$(cat .superpowers/sdd/771/pr-head.sha)"`.
5. DoD: the next develop record shows `rehearse` green; post its manifest on #771 and close it by hand.
6. The scratch ref `refs/floors/tooling/771-record-rehearse-job` still exists on origin; its delete was refused as "Git Destructive" (final). Shyden deletes it, or rules otherwise.
7. Then #762 pass 7 (plan `yawelo-idle-761/.superpowers/sdd/762/plan.md`); merge develop into #762's branch first.

## Done this session

- PR #777 CI on `66bad12`: build-and-test (36 steps) and board-orphans (10) green; **mutations red**: `748-coverage-job.ts` 6 of 8, `718-scratch-ref.ts` 16 of 18 (728 and both 771 files matched). Cause: #771 added a SHA-tip test and an AC6 credential test that also catch older mutants, and I had edited 748/718/728 but run only the new 771 file before pushing.
- `402ddb2`: 748 and 718 rows gain the extra reds, labelled as added after the run. Sibling rows predicted first in `771-record-rehearse.ts` test each explanation (reach of `needs`, list spelling, rehearse checkout, workflow permissions); all matched. The rehearse-checkout row found a hole: an ordering of indexes passes when a step is missing (-1 sorts first). Fixed there.
- `09e406e`: three more such orderings fixed in `record-floors-workflow.test.ts`, each first watched staying green under its row. Predictions log: `.superpowers/sdd/771/stale-predictions.md` (one of mine was wrong: 718 write-permission).
- Filed **#778** (P2, 3 points): the same blind form in `coverage-table.test.ts:231`, an offset mix in `supply-chain.test.ts:315`, and a guard. AST sweep: 17 sites in 508 files.
- **#775** gained AC6 (a local `npm run mutate:changed`), Estimate 5 → 8: the mechanism for running every changed mutation file before a push.
- **#536** comment: two 1 s timeouts during a local mutation run at load 70-106 on 6 cores. Own CPU not measured: the overlay method is refused by `local-suites-unit-only` (cannot read an overlay config), and that refusal is final. The same row matched in CI and in the next local run.

## Waiting on Shyden

- Delete the #771 scratch ref (step 6).
- `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- Offered: a hook refusing a call sent beside a failed Edit.
- How should a unit test's own CPU be measured now that the overlay route is refused (#536)?

## Progress (board read 2026-10-28)

- **By tickets:** 32% complete (140 of 443 in-scope stories), 0.57/day over 7 days. ETA 2028-04-11 before outside waits (low confidence: five of seven days at zero).
- **By effort:** 1,323 points remaining across 303 open stories, 1.57 points/day over 7 days. ETA 2029-02-16 before outside waits (low confidence).
- Measured: the board and its 7-day pace. Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone production sign-off at release (no date).

## State

- The main checkout is on `handover/2026-10-17-d` (local handover commits, not pushed). Its CLAUDE.md is OLD; read develop's.
- Worktrees: `-771` (#771, above); `-761` (#762, local `9e577b1`, not pushed by design); `-728b`, `-752`, `-36` parked; `-728-probe` has uncommitted probe files, so ask before removing it.
- Phones: OnePlus CPH2653 and iPhone Air connected; nothing phone-held is runnable before the release (#713 AC5's production half).
- Backups kept 30 days: tag `backup/771-pre-squash-2026-10-28`, plus the hook backups `~/.claude/hooks/*.bak-2026-10-28-*`.
