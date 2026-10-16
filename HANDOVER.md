# Handover: Yawelo Idle

**Written:** 2026-10-16 (UTC). **Running when written:** nothing this session started. CI on PR #606 (head `afebaca`) was not re-read this session. The #536 load sampler still runs under launchd.
**Next session:** a hook names it "Yawelo Idle"; type `/color green` once. The board picks the next ticket: expect #84.

## Progress (`node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`)

- **By tickets: 28% complete** (100 of 361 stories). Measured pace 2.57 a day over 7 days. Board ETA 2027-01-26 before outside waits. **ETA to release-ready: 2027-02-18 to 2027-02-25** (low confidence).
- **By effort: 1,208 points remaining** across 261 open stories. Measured pace 10.71 points a day. Board ETA 2027-02-06 before outside waits. **ETA to release-ready: 2027-03-01 to 2027-03-12** (low confidence).
- **Measured:** counts, paces, board ETAs. **Assumed:** about 30 unfiled prestige stories (130–180 points), and 1.5–2.5 weeks of outside waits.

## Done this session (global rules, Shyden 2026-10-16)

- **Every app logs, AFTER its release, from one repo-template design.** He chose: research log stores, self-host free on the Oracle servers if it fits, never blocking a release; the game's log stays on the player's device "for now". `~/.claude/CLAUDE.md` line 38 and `reference-engineering-standards.md` updated, with his words. Privacy amendments (steadyhand session): personal data is refused by default; a needed field must point to its privacy-policy section, and the stated retention is enforced.
- **repo-template#18** (log store research and choice, 5 pts) and **#19** (logging module and tests, allow-list, 8 pts; blocked by #16 and #18).
- **This repo's apps**: none keeps a diagnostic log. Filed #612 (game, on-device, 5), #613 (sync Worker, 3), #614 (web Worker, 2), #615 (site Worker, 3), #616 (dev-hosts, 1) and #617 (Steam app, 2; blocked by #256 and #612). All are P5, Todo, labelled `post-launch`, and blocked by repo-template#19. Comment on #193 (M5 audit log) carrying the privacy-policy pointer rule.
- **Every project files tickets the same way as yawelo-idle** (whole procedure; the template form gets an "Announce" box). `CLAUDE.md` line 13 and `reference-identity-and-agile.md` updated. Filed **repo-template#20** (form, docs, `scripts/file-story.ts`, 5 pts; blocked by #6).
- All three project sessions told (steadyhand-b5, shytalk-22, shyden-co-uk-96).
- Research report (sources quoted): `.superpowers/sdd/rt-18/log-store-research.md`. Its top pick is VictoriaLogs (Apache-2.0, arm64), behind Caddy with a token per project, fed by `fetch` in `waitUntil` from Workers. Oracle's own page, re-read here: Always Free A1 is **2 OCPUs and 12 GB in total** (not 4/24), with idle reclaim under 20% use over 7 days. ShyTalk's planned 2 OCPU / 12 GB LiveKit VM would use all of it.

## #84 (In Progress, P2, 13 pts): PR #606 (draft), carried over, not re-read

- Worktree `/Users/shyden/Developer/Repos/yawelo-idle-84`, branch `properties/84-measured-minimums` at `afebaca` (per the last handover), pushed.

## Resume steps

1. `ListAgents`; `node -v` (26); `board-next.ts` (expect #84).
2. `git -C ../yawelo-idle-84 rev-parse HEAD > ../yawelo-idle-84/.superpowers/sdd/84/head.sha`; read CI on that head by step name (`wait-run.sh` per run id from `gh run list --branch properties/84-measured-minimums`).
3. Task 7 Step 2: CI mutations on a throwaway draft PR off the head. Design and cautions in `../yawelo-idle-84/.superpowers/sdd/84/mutations-ci.md`; exact titles in `properties-titles.txt` there. Predictions first, then the whole verdict; close the throwaway unmerged.
4. Task 7 Step 3: mark #606 ready, merge into develop once green on its head, tick ACs 1–9 on #84 with citations, close by hand. Then #609.
5. repo-template#18, when it comes up: write `docs/logging.md` from the research file above, then ask Shyden to choose the store (AC2). It needs the real free capacity of the Oracle servers first (step under "Waiting").
6. When the board names #603: do its AC1 check first.

## Waiting on Shyden

- **Oracle servers:** a read-only look at the console for what each VM uses (shytalk-22 says the repo does not record it, and the prod VM is his call). That decides whether a log server fits for free.
- **Licence call for a self-hosted server we run:** Loki/Grafana, OpenObserve and Parseable are AGPL-3.0; Graylog is SSPL. Our licence rule covers shipped code and build tools, not a server we only run.
- Merge repo-template PR #17 (and #15, #13, #7, #5) into `main`.
- A hook for the `gh api …/logs` escape-sequence refusal (missed 8 times).
- Add the agent App's key to Dependabot's secret store for #604 (blocked by #36 anyway). After #36 merges: add `mutation` to develop's required checks.
- Delete the throwaway branches `test/341-mutations` (remote), `backup/341-drift-check-3-commits`, and `handover/2026-10-16-c`, `-d`, `-e` (local)?
- Install the shyden.co.uk close hook. Earlier asks still open: `handover/overnight-2026-10-05`, Spotlight privacy, Docker for #467, #451 AC3, #343, #333, #425/#426, #345, #455.

## State

- Main checkout on `handover/2026-10-16-f` from develop `2d2a59e`; this file is its only change.
- Worktrees: `yawelo-idle-84` (#84); `yawelo-idle-36` (#36, parked behind #603, draft PR #602); `yawelo-idle-341-gate` detached, clean. repo-template: `repo-template-16` (#16, PR #17).
- Session files (git-ignored): `.superpowers/sdd/rt-18/` (research, filer), `84/`, `607/`, `36/`, `580/`, `341/`.
