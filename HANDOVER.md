# Handover: Yawelo Idle

**Written:** 2026-11-09 15:05 WIB (sixty-first session, stopped for a laptop shutdown). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. It names #783, which cannot close before the release cut (Shyden, 2026-11-05), so go to step 1.

## Done this session

- **#784 rulings by Shyden, on the ticket:** the doors go live once, on 2026-11-15, together with DEV's move; the code and checks are built and merged now, not deployed. Door proof is the same as ShyTalk's, with no exception: the real door in front of the real Workers under `wrangler dev` on every PR, one hand test of the live address at each door deploy with evidence on the ticket, and a daily job reading each door's requests and errors from Cloudflare.
- No code written.

## Running

- Nothing local, and no CI awaited. No local job was stopped.

## Resume steps

1. **#784 doors, AC1(b), (c), AC4 (no code yet; failing tests first):**
   - Reword AC2 and AC3 to the account ruling, AC4 and AC5 to the two rulings above.
   - Door names go on yaweloidle.com, PROD's zone: `dev.`, `dev-api.`, `dev-holding.`, `test.`. A door Worker has no bindings, and is pinned to forwarding only.
   - `apps/site/worker/routes.ts` picks the holding page by hostname (`HOLDING_HOST`), which a door breaks because the Worker then sees its `workers.dev` host. Plan: a header the door sets, trusted only with a valid door secret, which CI can send without naming a door host. Not built or proven.
   - Move CI to `workers.dev`: `deploy-dev.yml`, `dev-behind-develop.yml` and the tests naming a door address. Retire `scripts/verify-dev-hosts.ts`, then add the guard over `tests/`, `scripts/` and `.github/`.
   - Origin refusal (door secret) can only turn on at the cutover, or today's dev addresses break. `apps/dev-hosts` stays until then.
   - WebSockets: a grep of `apps/*/src`, `apps/*/worker` and `packages/*/src` found none, which is the basis for AC4's written note.
2. **Clean-up is due** (last run 2026-11-02; the session-start line said after the handover's first step, and it has not started): a self-paced `/loop` over `~/.claude/global-rules/reference/reference-cleanup.md`, then `~/.claude/scripts/cleanup-done.sh yawelo-idle`. Worktree `-784` is merged and removable.
3. **PARKED until 2026-11-15 (Shyden, 2026-11-09): do not retry or raise it before then.** Cloudflare refused the non-PROD account on 2026-11-09 ("must be at least 7 days old"; member since 2026-11-08). The Yawelo profile is Browser 3 today (device ids can change, so read the profile page first). Open the account picker, Create Account, fill in `Yawelo Idle Non-Prod`; Shyden clicks the button. Then AC1(d) keys, AC2 and the door cutover. P1 #425, #426, #457 and #759 follow.
4. **Meanwhile, the M2 chain:** #102 waits on #104, #104 on #467, #467 on #638 (Google read-back under the shared lock and ledger). Start at #638 (5 points, ACs complete). Its AC6 re-scopes #467 away from LibreTranslate; #109 and #338 depend on that.
5. **#655 AC5:** on the next Dependabot PR, read its `sonarcloud` steps and `sonar-verdict:` lines, then shut #655.
6. **#793 AC6** on Dependabot's docker PR. **#888:** shut after 2026-11-20. **#864:** watch site-smoke until 2026-11-19. **#930** when the board picks it; its reproduction needs induced swap, which slows peers, so ask first.
7. **Epic #6 (M1)** has 18 of 18 sub-issues closed and is still open. Closing it triggers the milestone re-score, and moving ticket levels is Shyden's: ask.
8. When #784 lands, message the shyden.co.uk session.

## Waiting on Shyden

- **#830:** approve the roadmap text on the ticket, and whether "launch" means the first public opening.
- **#784:** Sparked Host ticket #073955 can be closed. Click Create Account from 2026-11-15.
- **Epic #6 and the milestone re-score** (step 7).
- Optional: mark S9382 Accepted in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- `origin/develop` at `58034faae11bf9d9e4a5126e4e031dad24bc7693` when this was written.
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-655` (detached at develop), `-784` (merged branch, removable).
- Open PRs: #602 (Stryker, waits for a runner release).
