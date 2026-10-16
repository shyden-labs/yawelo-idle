# Handover: Yawelo Idle

**Written:** 2026-10-17 (UTC). **Running when written:** nothing. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board picks the next ticket: #621 (waiting on Shyden), so work the highest ticket that does not wait on him.

## Progress (`node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 28% complete** (103 of 370 stories). Measured pace 3.00 a day. Board ETA 2027-01-13 before outside waits. **ETA to release-ready: 2027-02-04 to 2027-02-11** (low confidence).
- **By effort: 1,239 points remaining** across 267 open stories. Measured pace 11.57 points a day. Board ETA 2027-02-01 before outside waits. **ETA to release-ready: 2027-02-23 to 2027-03-07** (low confidence).
- **Measured:** counts, paces, board ETAs. **Assumed:** about 30 unfiled prestige stories (130–180 points), and 1.5–2.5 weeks of outside waits.

## Done this session

- **#624 closed** (P0): `eslint.config.js` uses ESLint core's `defineConfig` and `includeIgnoreFile`; `@eslint/compat` removed (PR #637, `b6b77b8`). Same 381 linted files, 0 warnings, every file resolves to the same config.
- **#627 closed** (P2): every wrangler call in the workflows is checked to read the config it means (PR #639, `648f4e9`). Unit: the parse, fail-closed by step, and the rule that a call never starts below a package root. Integration: wrangler's own reader under `npm exec` from each step's folder, 4 dry runs, 3 planted forms; integration step 22 s of its 1 minute. Seen red in CI by a throwaway mutation PR (#641, closed, branch deleted): exactly the 2 predicted tests.
- **#638 filed** (P3, 5 points): this repo's translation read-back goes through Google Cloud Translation under the shared lock and ledger (shyden.co.uk #841's protocol). Blocks #467 (whose LibreTranslate engine predates the Google rule) and #338. No Google caller exists here today. shyden-co-uk-96 was told.
- Memories: `project-record-floors-runs-on-label-only`, `feedback-node-run-helpers-need-ts-extensions`.

## Resume steps

1. `ListAgents`; `node -v` (26); `board-next.ts`.
2. #621 waits for Shyden: his look and sign-off of release PR #630, then he merges it and approves the production deploy. Then read deploy-prod's jobs by name, confirm `https://yawelo-idle.shyden.co.uk/` and `/id/` from outside (AC9), send shyden-co-uk-96 the media facts (music only, MP4 first, no byte ranges needed), tick #621's ACs, close it, remove worktrees `yawelo-idle-621` and `yawelo-idle-621b`.
3. Meanwhile: #84 (PR #606, worktree `yawelo-idle-84`), then the board's next P2.

## Waiting on Shyden

- His look and sign-off of #621's holding page, then merging #630 and approving the deploy.
- A hook for the `gh api …/logs` escape refusal (missed again this session: 11 times).
- A hook for zsh `for x in $var` (memory `feedback-zsh-for-loop-needs-split`).
- From before: merge repo-template PR #17 (and #15, #13, #7, #5); the Dependabot secret for #604; the shyden.co.uk close hook; the log-store choice (waits on #635).

## State

- Main checkout on `handover/2026-10-17-b` from develop `648f4e9`; this file is its only change.
- Worktrees: `yawelo-idle-621` and `yawelo-idle-621b` (remove after #621 closes); `yawelo-idle-84` (#84, PR #606); `yawelo-idle-36` (#36, parked); `yawelo-idle-341-gate`.
- Session files (git-ignored): `.superpowers/sdd/624/` (lint evidence, mutation runner), `.superpowers/sdd/627/` (probes; `627/627/` holds the worktree's runners, logs and PR bodies), `rt-18/`, `84/`, `607/`, `36/`, `580/`, `341/`.
- Safari: shyden-co-uk-96's last iPhone probe hung safaridriver; Safari may need Stop Session before the next real-iPhone check.
