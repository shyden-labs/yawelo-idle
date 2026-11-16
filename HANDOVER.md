# Handover: Yawelo Idle

**Written:** 2026-11-16 ~14:50 WIB for the laptop shutdown (session `yawelo-idle-74`). Colima, simulators and USB devices were not used, so there are no claims to release. Two local waiters died with the shutdown: a `gh run watch` on deploy-dev run 43824572283 and a `pr-verdict.sh 990` wait. The runs themselves continue on GitHub; re-read them with the commands in step 1. No background subagent.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. board-next names #783 first; it waits for the next release cut (Shyden, 2026-11-05), so skip it. **Physical devices are unavailable** (Shyden, 2026-11-16): park device work.

## In flight

- **#784 (environments), AC2's DEV half merged:** PR 988 squash-merged into develop as `236ac629` (every check and the SonarCloud gate green on head `13a46852`). DEV's Workers and D1 deploy into the non-PROD account (`NONPROD_CLOUDFLARE_*`); its workers.dev subdomain is `yawelo-idle-non-prod`. `apps/dev-hosts` (Pages, still in Shyden Labs Dev) forwards over HTTPS through the door's `pass()` with `DEV_DOOR_SECRET`, so the old dev.yawelo-idle.shyden.co.uk names keep working. A branch deploy at `21bb8205` (run 43811756555) passed every job. **The develop deploy of `236ac629` (run 43824572283) was still in progress at shutdown: read it first.** Board: Todo (no open branch). Still to do on #784: delete the old Yawelo Workers and D1 in Shyden Labs Dev (**ask Shyden first**), create TEST, the doors (AC4; a fresh door secret goes into dev AND production together, because nobody knows the current value), PROD (AC3).
- **#989 (astro 7.4.12 and vite 8.3.8, P2), PR 990**, branch `989-astro-vite`, worktree `../yawelo-idle-989`, head `831f7f6d` (pushed; read by `git ls-remote`). One vite copy at 8.3.8 rather than 8.3.7; the reason is on #989. Local: builds with 0 warnings; typecheck, lint and unit (14,466) pass. CI had not reported at shutdown. If green, squash-merge it, and tell shyden.co.uk's session the projects should now move to vite 8.3.8.
- **App permissions (2026-11-16):** yawelo-idle-agent holds Environments read and write plus Secrets read (Shyden accepted). `DEV_DOOR_SECRET` was set by the App and its value never shown. The pinned manifest is updated and its test green. After any App permission change, delete `~/.claude/state/github-app/yawelo-idle-agent-token.json`.
- **#160 (rotating backups, P3) on draft PR 986**, branch `160-save-backups`, worktree `../yawelo-idle-160`, head `e83c9455`; CI green. It stays draft until the AC3 notice lands. Approved English: restored, "Your latest save was damaged, so the backup saved {when} was loaded."; all damaged, "Your save and all its backups are damaged." with buttons "Start a new game" / "Keep the damaged save and close". Indonesian drafts are in `../yawelo-idle-160/.superpowers/sdd/160/id.json`. The Google read-back resets at 15:00 WIB daily. AC6 phones parked. #987 (diagnostics report) is blocked by #160.

## Resume steps

1. Read the waits: `gh run view 43824572283` (develop deploy of `236ac629`), then `~/.claude/scripts/pr-verdict.sh 990`. Tell Shyden about any failure that turn.
2. #990: every check was green on `831f7f6d` (read 14:58 WIB), but it is BEHIND develop after #988's merge. Update the branch (`gh pr update-branch 990`), wait for CI on the new head, then squash-merge (`--match-head-commit` from a file), clean up its branch and worktree, verify the dev deploy, then close #989 by hand after reading every AC.
3. #784: ask Shyden about deleting the old Yawelo resources in Shyden Labs Dev, then plan TEST.
4. #160: `node scripts/google-read-back.ts id en < .superpowers/sdd/160/id.json` in `../yawelo-idle-160`; show Shyden the writer/reader table; then build the AC3 notice, failing tests first.
5. Then: #127 (i18n runtime) or #163 (device registration). #130: first paint is 14,924 of 15,000 gzipped bytes.
6. #971: 2026-11-16 14:11 timeout (slice 394) posted, and a 2 s-sampled rerun passed; the cause is not named yet. #864 and #888 are watches to 11-19 and 11-20.
7. shyden.co.uk PR 1175 (Node 26.13.1) and PR 1173 (wrangler 4.161.0): follow them once they land (version census).

## Waiting on Shyden

- Deleting the old Yawelo Workers and D1 in Shyden Labs Dev (#784). #160's Indonesian. #783 waits for a release with something to ship.

## Rulings this session (recorded on the tickets)

- #784: keep the old dev names through the move; DEV starts empty; add the dev door secret; Environments read+write for the App; `npx --no wrangler` for the flagged line. Earlier: #830 approved as written; #125 colours; #106/#107 cut to what exists; #635 law research first; #632 phone sign-off protocol.

## Done this session (2026-11-16)

- #162 merged and closed. #160 implemented on PR 986. #987 filed.
- #784: Non-Prod account, token, `DEV_DOOR_SECRET`, PR 988 merged (`236ac629`).
- #989 filed (version census) and on PR 990. #971 occurrence and sampled figures posted.
- Cleanup: 12 merged branches and the -162 and -784 worktrees removed.
