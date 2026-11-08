# Handover: Yawelo Idle

**Written:** 2026-11-08 (fifty-seventh session). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- 2026-11-08 (fifty-seventh session; Shyden back, relayed by repo-template-27). **Every parked question asked and answered**, each recorded on its ticket: #858 support link in the site footer + game settings, opens in the browser, optional player ID (a random code the game assigns) with a privacy line, shyden.co.uk told; #828 ETA confidence rule kept; #452 voyage order kept after M8; #103 split (#103 keeps unique ids + no empty strings + counts; Encounter tags, review blocks, cross-references moved to **#922**, P3, 3 pts, blocked by #102/#110/#462; AC6 floor dropped by the 2026-10-30 rule).
- **#784:** Google refused the Yawelo Gmail ("device ... used too many times for verification"); Shyden: scan with his other Android phone once another session frees it.
- **#655 SonarCloud:** project `shyden-labs_yawelo-idle` created (new code = previous version, automatic analysis off, read back). Shyden set `SONAR_TOKEN` (Actions + Dependabot). On his request the App got read-only **Secrets** and **Dependabot secrets** (names only); the local pin `~/.claude/scripts/github-app/app_manifest.py` updated test-first (ShyDesk keeps its old set; backups `*.bak-yawelo-secrets-read-2026-11-08`); App read back both secret names. Shyden chose a **separate pull-request workflow** (measures coverage itself; deploys untouched; no job-level `if`). After the security review, two jobs: `sonar-coverage` (installs, measures, uploads; no secret) and `sonarcloud` (token; downloads, scans, verdict; runs no project code). **Both** become required at AC1. **PR #923** on `655-sonarcloud`, head `7b71a9b7ca3777f7eabf72f3313d9bac8edbdfc3` (worktree `../yawelo-idle-655`); laptop: format, lint, typecheck clean, unit 13,788/13,788; mutation pass 8/8 caught. Board In Progress.

## Running

- Nothing.

## Resume steps

0. `ListAgents`, then board-next. #655 (P1) is in hand.
1. **PR #923:** `~/.claude/scripts/pr-verdict.sh 923`. The `sonarcloud` check fails at its first step ("SONAR_TOKEN is missing") until Shyden makes the `sonarcloud` environment with the token (commands given in chat: `gh api -X PUT repos/shyden-labs/yawelo-idle/environments/sonarcloud`, `gh secret set SONAR_TOKEN --repo shyden-labs/yawelo-idle --env sonarcloud`, then delete the repo-wide Actions copy; keep the Dependabot one). Then: first scan's findings (AC4) fixed or accepted by him, merge, make `sonarcloud` required on develop + main and add it to `tests/unit/required-checks.test.ts` (AC1), prove one Dependabot PR (AC5).
2. Then #103 (unique ids, no empty strings), M2.
3. **On a repeat of the 1 s unit timeouts** (#859, #917): measure swap, load, `memory_pressure`, busy sessions; file a ticket.
4. **#793 AC6:** when Dependabot opens its docker PR for `.github/node`, read its setup-node log line, then shut #793. **#888:** shut after 2026-11-20 with the deploy-dev tally. **#864:** watch site-smoke reds until 2026-11-19.
5. By board: #783 (P0) waits for the next release cut; #784 waits for the phone.

## Waiting on Shyden

- The `sonarcloud` environment + token (#655). The second Android phone for the Yawelo Gmail (#784). #830 copy approval.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-655`.
- Open PRs: #602 (Stryker, waits for a runner release), #923 (#655).
