# Handover: Yawelo Idle

**Written:** 2026-10-28 (twentieth session). **Running when written:** record run **40646855523** (develop's `record-floors.yml` on `9ea878f`, GitHub-side; it survives `/clear`). Three earlier runs each refused something (two falling floors, lowered by hand; test and mutation files in the coverage record); each is accounted for in the commit message. The local waiter dies with the session, so re-wait with step 1.
**Next session:** `ListAgents`, then `board-next`. It names #728 (blocked); the chain is #728 ← #733 (#762) ← **#771**, so **resume #771**.

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## Resume steps (#771, worktree `../yawelo-idle-771`, branch `tooling/771-record-rehearse-job`)

1. HEAD `9ea878f` (one squashed commit, **not pushed to the branch**; on scratch ref `refs/floors/tooling/771-record-rehearse-job`; probe-stamped). Pre-squash commits are tagged `backup/771-pre-squash-2026-10-28`. Wait for the run: `~/.claude/scripts/wait-run.sh /Users/shyden/Developer/Repos/yawelo-idle-771 40646855523 <file holding 9ea878f's SHA>` (write it with `git rev-parse HEAD > file`). Read both jobs by name. It runs develop's OLD workflow (no rehearse job). That is expected.
2. Green: `npm run floors:fetch 40646855523` in the worktree, then `git commit --amend` (message file: re-create from `git log -1 --format=%B`). Expected floor moves:
   - `record-floors-workflow/steps` 13→19.
   - `record-floors/workflow-steps` 133→139.
   - `supply-chain/pinned-uses` and `versioned-uses` 52→57.
   - `workflow-runners/labels`, `workflow-secrets/repo-jobs` and `workflow-timeouts/repo-jobs` +1.
   - New: `record-floors-workflow/sha-checkouts` 3, `rehearse/listed-files` 11.
   - The coverage record: the new files at 0 untested; `coverage.ts` statements 49→49 and arms 23→21; `record-floors.yml` 105→105.
3. Then the full unit suite by hand (green). Then the mutation files on the laptop (unit targets, under `test-lock.zsh heavy`): `npm run mutate -- tests/mutations/771-record-rehearse.ts`. 718, 728 and 748 changed too; CI's `mutations` job runs them, and `771-measure-cli.ts` (integration) runs there only. A prediction that misses means fix, re-record, re-probe.
4. First push of the branch with a `Floors:` line. **Before the merge, dispatch the BRANCH's workflow** on the same SHA (`gh workflow run record-floors.yml --ref tooling/771-record-rehearse-job -f branch=… -f sha=…`, scratch ref still at HEAD): it is the only real run of the new `rehearse` job before develop depends on it (side-agent note, adopted). Read every job green and the manifest. Then the PR into develop. The body gives `codeLines` 105 → 105 and the AC3 layout note (gate = `rehearse`'s first step; a separate gate job measured 114). Set #771 to In Progress once the branch is pushed. DoD: after the merge, the next record shows `rehearse` green; write its manifest on #771.
5. Then #762 pass 7 (plan `yawelo-idle-761/.superpowers/sdd/762/plan.md`).

Plan + review log + execution notes: `../yawelo-idle-771/.superpowers/sdd/771/plan.md` (git-ignored).

## Done this session

- #771 planned (3 passes, spikes run), then built: `scripts/record-gate.ts`, `scripts/rehearse.ts` (act 0.2.89, SHA-256 pinned), `scripts/rehearsal.ts`, the `coverage.ts measure rehearsal/` check, the `rehearse` job, `/rehearsal/` ignored, and the lint-ignores probe now reads anchored entries.
- **Shyden ruled "Count them as not code"** (2026-10-28), then made it **global**: "we still need to make sure mutations correctly exist without any gaps and they work as intended". `tests/mutations/*.ts` is `not-code` in #771. The global CLAUDE.md coverage line, the reference ("Mutation files are not code; they are proven instead") and `global-rules/pending-mutation-files-proven.md` record it. Proofs here: the existing guard, #761 (anchors; unblocked from #733; near-duplicate #666), and **#775** (predicted tests exist; a target change re-runs its file; P2, 5 points).
- **Shyden ruled "Start line in the workflow" (2026-10-28). The coverage rule and the collection-calls rule clash over any new script's start file, so each script starts from an inline `node --input-type=module -e` line. The general fix rides on #733 (comment there).
- **Filed:**
  - #773: record-minimums gets the same gate. P2, 2 points, blocked by #771.
  - #774: V8 counts a statement after a throwing call as run. P0, 5 points. The blind form is added to `global-rules/reference-guard-forms-and-floors.md`.
- Comments on #771 (layout measurements; the ruling), #464 (act as a CI tool) and #733.

## Waiting on Shyden

- `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- Phones unavailable: device runs parked (#713 AC5).

## Progress (board read 2026-10-28)

- **By tickets:** 32% complete (140 of 440 in-scope stories), 0.57/day over 7 days (0, 1, 3, 0, 0, 0, 0). ETA 2028-04-05 before outside waits (low confidence: four of seven days at zero).
- **By effort:** 1,309 points remaining across 300 open stories, 1.57 points/day over 7 days. ETA 2029-02-07 before outside waits (low confidence).
- Measured: the board and its 7-day pace. Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone sign-off (no date). Filed +7 points (#773, #774); nothing closed.

## State

- The main checkout is on `handover/2026-10-17-d` (local handover commits, not pushed). Its CLAUDE.md is OLD; read develop's.
- Worktrees:
  - `-771`: #771, above.
  - `-761`: #762, local `9e577b1`, not pushed by design.
  - `-728b`, `-752` and `-36`: parked.
  - `-728-probe`: uncommitted probe files; ask before removing.
- A branch cut before #771 lacks `scripts/rehearse.ts`, so its next record fails at the rehearse step. Merge develop first (`-761`, `-752`, `-728b`).
- Backups kept 30 days: as before, plus tag `backup/771-pre-squash-2026-10-28`.
