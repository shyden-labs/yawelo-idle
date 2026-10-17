# Handover: Yawelo Idle

**Written:** 2026-10-18 (UTC). **Running when written:** nothing local. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board picks #621 (waits on Shyden only); the next ticket that does not wait on him is **#619** (P2, 3 points, now unblocked), then #653, then #370.

## Progress (`node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 29% complete** (109 of 373 stories). Measured pace 3.86 a day. Board ETA 2026-12-25 before outside waits. **ETA to release-ready: 2027-01-14 to 2027-01-21** (low confidence).
- **By effort: 1,195 points remaining** across 264 open stories. Measured pace 18.57 points a day. Board ETA 2026-12-21 before outside waits. **ETA to release-ready: 2027-01-09 to 2027-01-20** (low confidence).
- **Measured:** counts, paces, board ETAs. **Assumed:** about 30 unfiled prestige stories (130–180 points), and 1.5–2.5 weeks of outside waits.

## Done this session

- **#652 closed:** PR #654 merged into `develop` as `d90fb50` from the tested head `5d2e702` (build-and-test 20 of 20 steps, every-commit, board-orphans, and mutations `4 of 4 matched; 0 of 1 files refused`; deploy-dev 39066490804: 6 jobs, 54 of 54 steps). `npm run mutate` now runs every file: `runFiles` in `scripts/mutate.ts` prints `REFUSED <file>: <why>` and goes on. Evidence on #652.
- **#653 filed** (P2, 2 points): no tsconfig sets `erasableSyntaxOnly`, so `tsc` and vitest pass parameter properties that `node scripts/*.ts` refuses at load. That cost one mutation run. 9 sites in 4 files; no live case among the 21 node-run modules.
- CI's `floorless-searches` caught a bare `toEqual([])` in a new test. Fixed with the scripted stand-in idiom; the reader, run over both copies, found 1 unproved site then 0.

## Resume steps

1. `ListAgents`; `node -v` (26); `board-next.ts`.
2. **#621**, when Shyden has signed off on his phones, merged #647 and approved production: deploy-prod's jobs by name on the merge SHA; `/` and `/id/` from outside; media facts to shyden-co-uk-96; close; remove worktrees `yawelo-idle-621`, `yawelo-idle-621b`, `yawelo-idle-release`.
3. **#619:** re-read its ACs first (AC3 moved to #649). Extend `scripts/mutations-changed.ts` into the changed-test judge, add the guards test over every `tests/mutations/` file, add `mutations` to develop's required checks and read it back. Branch from `origin/develop` (`d90fb50` or later).
4. Then **#653**, then **#370**.

## Waiting on Shyden

- **#621:** phone sign-off, merge #647 into `main`, approve the production deploy.
- A hook for the `gh api …/logs` escape refusal (15 misses now), and one for zsh `for x in $var`.
- From before: merge repo-template PRs #17, #15, #13, #7, #5; the Dependabot secret for #604; the shyden.co.uk close hook; the log-store choice (waits on #635).

## State

- Main checkout on `handover/2026-10-17-d` (PR #648, this file). `tooling/652-mutate-run-files` deleted locally after the merge.
- Worktrees: `yawelo-idle-release` (frozen), `yawelo-idle-621`, `yawelo-idle-621b`, `yawelo-idle-36` (parked), `yawelo-idle-341`, `yawelo-idle-341-gate`, `yawelo-idle-577`, `yawelo-idle-develop-bench`.
