# Handover: Yawelo Idle

**Written:** 2026-10-16 (UTC). **Running when written:** nothing. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board picks the next ticket: expect #621.

## Progress (`node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 27% complete** (101 of 369 stories). Measured pace 2.71 a day. Board ETA 2027-01-23 before outside waits. **ETA to release-ready: 2027-02-14 to 2027-02-21** (low confidence).
- **By effort: 1,239 points remaining** across 268 open stories. Measured pace 10.86 points a day. Board ETA 2027-02-08 before outside waits. **ETA to release-ready: 2027-03-02 to 2027-03-14** (low confidence).
- **Measured:** counts, paces, board ETAs. **Assumed:** about 30 unfiled prestige stories (130–180 points), and 1.5–2.5 weeks of outside waits.

## #621 (P0, In Progress): ready for Shyden's look

- Done this session: dev deploy for `b396120` and then `8ff1e5f`, every job green by name. Both phones opened the dev copy and captured 45 s each: 40 of 40 iPhone frames and 47 of 47 Android frames differ, and the 10.0 s promo looped about 4 times. Evidence is on #621. Phones handed back to shyden-co-uk-96.
- #633 (P0) is closed: `every-commit` runs only on PRs into develop (PR #634, `8ff1e5f`). Release PR #630 is now at `8ff1e5f`, with every check passing by name and no `list`/`every-commit`.
- Observation for Shyden's look (not measured as a defect): the "Yawelo Idle" heading looks lighter on Android Chrome than on iPhone Safari.

## Resume steps

1. `ListAgents`; `node -v` (26); `board-next.ts` (expect #621).
2. Open this branch's PR into develop (docs only, one commit), and merge when green by name.
3. Wait for Shyden's look and sign-off of #630. He merges #630 and approves the production deploy. Then read deploy-prod's jobs by name, confirm `https://yawelo-idle.shyden.co.uk/` and `/id/` from outside (AC9), and send shyden-co-uk-96 the media facts (music only, MP4 first, no byte ranges needed). Tick #621's ACs and close it by hand. Remove worktrees `yawelo-idle-621` and `yawelo-idle-621b`.
4. Then #624 (P0, lint deprecations), #627 (P2, wrangler-config guard), then #84 (PR #606).

## Decisions from Shyden this session

- **Shyden lives in Indonesia, not the UK.** Shyden Labs is not registered anywhere yet; it will be registered in Indonesia. Recorded in global CLAUDE.md (Business line), the identity reference file and memory `user-lives-in-indonesia`. **#635** (P3, 3 points) settles which data-protection laws apply, and blocks #246, #423 and #452. The spec's line 463 and #246 still say "UK GDPR" until #635 lands.
- **Log store:** the Axiom viewer cannot read a locked archive (Axiom keeps data in your own storage only on enterprise BYOC). Shyden asked for free options. Two reports: `.superpowers/sdd/rt-18/viewer-plus-archive-research.md` (paid; best is Grafana Cloud + S3 Object Lock in London via Athena, about $0.10/month) and `free-viewer-research.md` (self-hosted Grafana on the Oracle VM + an R2, B2 or Oracle locked bucket, $0). Shyden has not chosen: the region question waits on #635 (AC4 re-ranks the reports).
- **Old branches:** 42 provably merged remote branches deleted (tip inside develop). Kept: 5 Dependabot and 3 work branches with open PRs, `main`, `develop`, this handover branch, and `m1/35-pacing-bots` (no PR, not merged).
- **Translation overspend** (ledger 17,005 on 10-14 and 54,178 on 10-15, against a 16,000 cap): the only writer is shyden.co.uk's `scripts/i18n-google-read-back.mjs`. Handed to shyden-co-uk-96 to trace, fix and report to Shyden. Not ours to touch.

## Waiting on Shyden

- His look and sign-off of #621's holding page, then merging #630 and approving the deploy.
- A hook for the `gh api …/logs` escape refusal (missed again this session: 10 times).
- A hook for zsh `for x in $var` (memory `feedback-zsh-for-loop-needs-split`).
- From before: merge repo-template PR #17 (and #15, #13, #7, #5); the Dependabot secret for #604; the shyden.co.uk close hook.

## State

- Main checkout on `handover/2026-10-16-h`, recreated from develop `8ff1e5f`; this file is its only change.
- Worktrees: `yawelo-idle-621` and `yawelo-idle-621b` (merged, remove after #621 closes); `yawelo-idle-84` (#84, PR #606); `yawelo-idle-36` (#36, parked); `yawelo-idle-341-gate`.
- Session files (git-ignored): `.superpowers/sdd/rt-18/` (log research, 2 new reports), `621/` in `yawelo-idle-621`, `84/`, `607/`, `36/`, `580/`, `341/`.
