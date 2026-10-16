# Handover: Yawelo Idle

**Written:** 2026-10-17 (UTC). **Running when written:** CI on PR #639 (#627): build-and-test 38977189011 and record-floors 38977190343 on `99ad453`. A local waiter for them dies with this session; re-read them by id. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board picks the next ticket: expect #621 (waiting on Shyden), then the next P2.

## Progress (`node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 28% complete** (102 of 370 stories). Measured pace 2.86 a day. Board ETA 2027-01-18 before outside waits. **ETA to release-ready: 2027-02-09 to 2027-02-16** (low confidence).
- **By effort: 1,242 points remaining** across 268 open stories. Measured pace 11.14 points a day. Board ETA 2027-02-05 before outside waits. **ETA to release-ready: 2027-02-27 to 2027-03-11** (low confidence).
- **Measured:** counts, paces, board ETAs. **Assumed:** about 30 unfiled prestige stories (130–180 points), and 1.5–2.5 weeks of outside waits.

## Done this session

- **#624 closed** (P0): `eslint.config.js` uses ESLint core's `defineConfig` and `includeIgnoreFile` (`eslint/config`); `@eslint/compat` removed. PR #637 merged (`b6b77b8`). Same 381 linted files, 0 warnings, every file resolves to the same config. The guards found a workspace call at collection in the new test, which was fixed before merge.
- **#638 filed** (P3, 5 points): this repo's translation read-back must go through Google Cloud Translation under the shared lock and ledger (shyden.co.uk #841's protocol: `~/.config/shyden/google-translate.lock`, re-read before every request, atomic writes, the `"<date> limit"` key). It blocks #467 (whose LibreTranslate engine predates the Google rule) and #338. Measured: no Google caller exists in this repo today. shyden-co-uk-96 was told.
- **#627 in PR #639** (In Progress): unit `tests/unit/wrangler-steps.test.ts` (45 tests; 34 red against stubs; 16 mutations, 0 wrong) and integration `tests/integration/wrangler-steps.test.ts` (wrangler's own reader under `npm exec` from each step's folder, 4 dry runs, 3 planted forms). AC1 changed with a measured reason (a dry run never prints the Worker name), noted on #627.

## Resume steps

1. `ListAgents`; `node -v` (26); `board-next.ts`.
2. #639: read build-and-test 38977189011 by step name. **The integration step is new work for CI**: read its duration against the 1-minute limit, and read every wrangler-steps test by name. If red, read the error text before any change.
3. Read record-floors 38977190343. If it succeeded, in `../yawelo-idle-627`: `npm run floors:fetch 38977190343`, check every figure only rises, `git add tests/floors && git commit --amend --no-edit`, run the unit suite, then `git push --force-with-lease` (only once no run on the branch is running). If the guards failed, read them first: they run inside record-floors.
4. Merge #639 when green by name on its head; close #627 by hand with its evidence; remove worktree `yawelo-idle-627`.
5. #621 still waits for Shyden: his look and sign-off of release PR #630, then he merges it and approves the production deploy. Then read deploy-prod's jobs by name, confirm `https://yawelo-idle.shyden.co.uk/` and `/id/` from outside (AC9), send shyden-co-uk-96 the media facts, tick #621's ACs, close it, remove worktrees `yawelo-idle-621` and `yawelo-idle-621b`.
6. Then the board's next ticket (handover had #84, PR #606).

## Waiting on Shyden

- His look and sign-off of #621's holding page, then merging #630 and approving the deploy.
- A hook for the `gh api …/logs` escape refusal (missed again this session: 11 times).
- A hook for zsh `for x in $var` (memory `feedback-zsh-for-loop-needs-split`).
- From before: merge repo-template PR #17 (and #15, #13, #7, #5); the Dependabot secret for #604; the shyden.co.uk close hook; the log-store choice (waits on #635).

## State

- Main checkout on `handover/2026-10-17` from develop `b6b77b8`; this file is its only change.
- Worktrees: `yawelo-idle-627` (#627, PR #639); `yawelo-idle-621` and `yawelo-idle-621b` (remove after #621 closes); `yawelo-idle-84` (#84, PR #606); `yawelo-idle-36` (#36, parked); `yawelo-idle-341-gate`.
- Session files (git-ignored): `.superpowers/sdd/624/` (lint evidence, mutation runner), `../yawelo-idle-627/.superpowers/sdd/627/` (probes, mutation runner, PR body), `rt-18/`, `84/`, `607/`, `36/`, `580/`, `341/`.
- Safari: shyden-co-uk-96's last iPhone probe hung safaridriver; Safari may need Stop Session before the next real-iPhone check.
