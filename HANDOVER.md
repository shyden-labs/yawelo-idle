# Handover: Yawelo Idle

**Written:** 2026-11-08 (fifty-seventh session). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- 2026-11-08 (fifty-seventh session, continued). Parked questions answered earlier today: #858 (support link; shyden.co.uk ruled it Yawelo Idle's only, nothing filed there), #828, #452, #103 split to #922.
- **#655 SonarCloud:** PR #923 merged into develop as `f8f8d0af` (the integration list now has `scripts/sonar-verdict.ts`; first scan's S4624 fixed; **S9382 accepted by Shyden**, recorded on #655). CI was green on the head, every step run: `sonar-coverage`, `sonarcloud` (gate OK, so the `sonarcloud` environment's token works), build-and-test, coverage, board-orphans. **PR #924** merged as `620616c4` (pins both Sonar jobs in `tests/unit/required-checks.test.ts`; watched red). Making them required: the App gets HTTP 403 on branch protection, so it is **Shyden's step** (commands in Waiting on Shyden).

- **#925 (legal pages English only, Shyden's global rule 2026-11-08):** filed (P2, 3 pts, parent #331); #423, #246, #338, #858 bodies now say English only, #467 noted. Branch `925-legal-english-only` in worktree `../yawelo-idle-925`, **committed locally as `48e68c19`, NOT pushed**: Claude Code stopped the push (pre-push checks) for low system memory. Removes `/id/privacy` and its strings, `LEGAL` holds the English text, `i18n.ts` legal pages English-only, no switcher, the one allowed note line in Indonesian (Google read-back exact, ledger 6,456/16,000 on 2026-11-08). Unit 13,804/13,804, format/lint/typecheck clean, each planted form watched red, `astro build` checked by hand.

## Running

- Nothing. The #925 push is DEAD: re-run `git -C ../yawelo-idle-925 push -u origin 925-legal-english-only` once memory allows.

## Resume steps

0. `ListAgents`, then board-next. #655 (P1) is in hand.
1. **#925:** push (above), open the PR (body: what, evidence, `Refs #925`), CI green on head by step name, squash-merge, shut #925 after checking every AC (AC5's harness tests in `apps/site/test/site.test.ts` run in CI).
2. **#655 AC1:** once Shyden has run the protection commands, read both branches back (`gh api repos/shyden-labs/yawelo-idle/branches/<b>/protection/required_status_checks`). Then open a throwaway draft PR with untested new code: SonarCloud's gate should return `ERROR`, `sonarcloud` goes red naming it, and the PR shows as blocked (DoD "planted ERROR watched red"); close it and delete its branch.
3. **#655 AC5:** prove one real Dependabot PR is scanned and its verdict read (Dependabot gets the Dependabot copy of `SONAR_TOKEN`). **AC6** and the DoD's "one planted ERROR watched red": check what the ticket's comments already prove; fill any gap. Then shut #655.
4. Then #103 (unique ids, no empty strings), M2. #830: draft the roadmap page text and park the approval question here.
5. **On a repeat of the 1 s unit timeouts** (#859, #917): measure swap, load, `memory_pressure`, busy sessions; file a ticket.
6. **#793 AC6:** when Dependabot opens its docker PR for `.github/node`, read its setup-node log line, then shut #793. **#888:** shut after 2026-11-20 with the deploy-dev tally. **#864:** watch site-smoke reds until 2026-11-19.
7. By board: #783 (P0) waits for the next release cut; #784 waits for the phone.

## Waiting on Shyden

- **#655 AC1, make both Sonar checks required** (the App cannot edit protection):
  ```
  gh api -X PATCH repos/shyden-labs/yawelo-idle/branches/develop/protection/required_status_checks --input - <<'JSON'
  {"strict": true, "checks": [{"context": "build-and-test", "app_id": 15368}, {"context": "board-orphans", "app_id": 15368}, {"context": "coverage", "app_id": 15368}, {"context": "sonar-coverage", "app_id": 15368}, {"context": "sonarcloud", "app_id": 15368}]}
  JSON
  gh api -X PATCH repos/shyden-labs/yawelo-idle/branches/main/protection/required_status_checks --input - <<'JSON'
  {"strict": false, "checks": [{"context": "build-and-test", "app_id": 15368}, {"context": "sonar-coverage", "app_id": 15368}, {"context": "sonarcloud", "app_id": 15368}]}
  JSON
  ```
- Delete the repo-wide Actions `SONAR_TOKEN` (`gh secret delete SONAR_TOKEN --repo shyden-labs/yawelo-idle`; keep the Dependabot copy). Optional: mark S9382 Accepted in SonarCloud. The second Android phone for the Yawelo Gmail (#784). #830 copy approval.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-655`, `-925`.
- Open PRs: #602 (Stryker, waits for a runner release).
