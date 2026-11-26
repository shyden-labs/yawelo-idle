# Handover: Yawelo Idle

**Written:** 2026-11-26 07:40 WIB, session `yawelo-idle-a9`. Branch `handover/2026-10-17-d`. develop at 8f17aa11 (#1116 merged). **No devices available** (relayed by repo-template): park device steps. Worktrees: `yawelo-idle-1074` (PR #1088), `yawelo-idle-1107` (fix PR for #1107), `yawelo-idle-1115` (PR #1117), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts`. No Colima, simulator or USB claim. Session notes: `.superpowers/sdd/1072/data-inventory.md`, `.superpowers/sdd/1078/step1-plan.md` (git-ignored).

## New rule (Shyden, 2026-11-26)

"CI caches every download, and still takes a newer version", global, in `~/.claude/CLAUDE.md` + `reference-engineering-standards.md`. repo-template carries it as **repo-template#224** (that session: PR today, will message the number and the merge). Yawelo's sweep is **#1118** (3 pts, P2, Todo, blocked by repo-template#224 via GitHub link): Node in 6 container jobs (~4.5 s each), Sonar scanner + JRE + plugins (~8 s). Copy #224's steps when its PR opens. The container image pull (~16 s) cannot be cached.

## Now

- **#1107 reopened** (comment 7178733731): `private-contract.test.ts` still sent an over-1-MiB body over the harness socket; it broke #1117's sonar-coverage (run 45723745139, `UND_ERR_SOCKET`). Fix on `fix/1107-contract-413-in-process`: `apps/site/worker/hook-contract.test.ts` judges the Worker's own 413 in-process (red on 413→400 mutation), the networked test removed. Unit 15,095, tsc clean. Push and PR were in progress at writing: check `gh pr list --head fix/1107-contract-413-in-process`.
- **PR #1117** (#1115): red only from that flake. After the #1107 fix merges, merge develop into it (never re-run the failed job).
- **PR #1088** (#1074): develop merged again (unit 15,101), push in progress. Merge when green on the new head. Then #1103's AC2 evidence from it, close #1103.
- **#1106 (Todo):** PR #1116 merged as 8f17aa11. Close once Sonar develop reads 0 (read 1, `body.ts`, while 8f17aa11's analysis was still running).
- **#1072 (P0):** no policy text exists; question for Shyden on raising #423/#635/#343. Pairing cleanup AC added to #169 (comment 7178795020).
- **#1078 (P0):** step 1 waits on #1117 (same workflow file). Webhook route decision parked for Shyden.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. `pr-verdict.sh` for the #1107 PR and #1088; merge each green on its head (`--match-head-commit` from a file); clean worktree + branches and set the ticket's status in the same step.
3. Merge develop into #1117; merge when green; read the next deploy-dev's Edge install times; close #1115.
4. Sonar develop at 0 → close #1106. #1088 evidence → close #1103. #1107 closes after its PR's CI and a clean sonar-coverage on develop.
5. #1078 step 1; #1118 once repo-template#224's PR exists.
6. Ask Shyden (AskUserQuestion): webhook route (#1078); raising #423/#635/#343 (#1072).
