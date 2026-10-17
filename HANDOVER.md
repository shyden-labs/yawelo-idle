# Handover: Yawelo Idle

**Written:** 2026-10-17 (UTC). **Running when written:** nothing local. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board picks the next ticket: #621 (waiting on Shyden), so work the highest one that does not wait on him: **#369**.

## Progress (`node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 28% complete** (105 of 370 stories). Measured pace 3.29 a day. Board ETA 2027-01-06 before outside waits. **ETA to release-ready: 2027-01-25 to 2027-02-01** (low confidence).
- **By effort: 1,213 points remaining** across 265 open stories. Measured pace 15.29 points a day. Board ETA 2027-01-05 before outside waits. **ETA to release-ready: 2027-01-24 to 2027-02-04** (low confidence).
- **Measured:** counts, paces, board ETAs. **Assumed:** about 30 unfiled prestige stories (130–180 points), and 1.5–2.5 weeks of outside waits.

## Done this session

- **#368 closed** (13 points). PR #644 merged into `develop` as `da6f12e` from the tested head `ead29af`, after all three CI runs (39021377777, 39021377797, 39021377764) were read step by step, and the run SHA matched `headRefOid`. deploy-dev 39022034951 was green on `da6f12e` in every job by name. Every AC was read against the merged tree (all 22 removed assertions were found again, ceilings 106/98 → 84/81, 18 floor ids each in one test, `sites` still 256) and posted on #368. The board moved it to Done. No Website story: test infrastructure only.
- Checked: deploy-dev's "Deploy the hostname adapter to production on Pages" step is the dev adapter (`apps/dev-hosts`, dev token). "Production" is Pages' own name for the main slot (#429). It is not the game's production.

## Resume steps

1. `ListAgents`; `node -v` (26); `board-next.ts`.
2. **Release**: when Shyden has opened the PR from `release/2026-10-17-holding-page` (cut `8ff1e5f`), close #630 with a comment pointing at it (`Refs #621`). #630 is develop → main and now also carries #644: it must never be merged. Then #621 waits on his phone sign-off, merge and production approval. After that, read deploy-prod's jobs by name, check `https://yawelo-idle.shyden.co.uk/` and `/id/` from outside (AC9), send shyden-co-uk-96 the media facts (music only, MP4 first, no byte ranges needed), tick #621's ACs, close it, and remove worktrees `yawelo-idle-621`, `yawelo-idle-621b` and `yawelo-idle-release`.
3. **#369** (P2, 13 points): floors for the absence searches in the bots run, player and stream tests. Same method as #368: `tests/watched.ts` for pure checks over fixtures, `againstControl` for empty inputs, split two-case tests, floors recorded by the `record-floors` label and then `floors:fetch`, one squashed commit, mutants predicted first (`.superpowers/sdd/368/mutants.py` in the `yawelo-idle-368` worktree is the model). New worktree from `origin/develop`.

## Waiting on Shyden

- Opening the new release PR (the auto-mode classifier refused `gh pr create --base main`; body in `.superpowers/sdd/release/release-pr.md`), then #621's sign-off, merge and production approval.
- A hook for the `gh api …/logs` escape refusal (12 misses), and one for zsh `for x in $var`.
- From before: merge repo-template PR #17 (and #15, #13, #7, #5); the Dependabot secret for #604; the shyden.co.uk close hook; the log-store choice (waits on #635).

## State

- Main checkout on `handover/2026-10-17-c` from develop `1a4ca2f`; this file is its only change.
- Worktrees: `yawelo-idle-368` (merged; keep until #369 has copied `.superpowers/sdd/368/`, then remove); `yawelo-idle-release` (release cut, frozen: never commit there); `yawelo-idle-84` (merged #84 branch; remove once `.superpowers/sdd/84/` is copied); `yawelo-idle-621`, `yawelo-idle-621b` (remove after #621); `yawelo-idle-36` (#36, parked); `yawelo-idle-341-gate`.
