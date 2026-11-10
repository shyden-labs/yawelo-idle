# Handover: Yawelo Idle

**Written:** 2026-11-10 07:04 WIB (sixty-third session; a peer relayed Shyden's "continue"). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`. It names #783, which cannot close before the release cut (Shyden, 2026-11-05), so go to step 1.

## Done this session

- **PR #938 merged** (`5fb0a9b407bd085301894cc2876f53ff824bac82`): the dev site picks the holding page by door; page serving moved into `routes.ts` (`servePages`, `doorTo`) so SonarCloud counts it (new-code coverage 94.4%).
- **PR #939 merged** (`40f14ce3dd1c382665a938514e4fe2d32435d1d8`): Google read-back under the shared lock and ledger. S4036 fixed (no `git` via PATH; the lock holder is `process.cwd()`). **#638 closed** with evidence. **#467 re-scored 5 -> 3** (only AC5/AC6 left, population measured in its comment).
- **Clean-up done and recorded** (pass log in `~/.claude/global-rules/reference/reference-cleanup.md`): 2 worktrees, 43 local + 4 remote branches (Shyden approved), PR #602 closed (approved), 15 obsolete memories, 230 MB of scratch. Tips in `.superpowers/cleanup/`.
- **Shyden, 07:00:** wait until 2026-11-15 for the non-PROD account; DEV stays where it is; TEST is not created early.
- **Trap:** `gh pr checks <n> --watch --required` returned early three times with checks pending. Wait with a loop until none reads pending, then re-read the checks and the SonarCloud gate (memory `topic-gh-traps`).

## In flight

- **Draft PR #940** (`feat/784-origins-need-the-door`, worktree `../yawelo-idle-784`, head `58e190bbf6cff8e90dc06bf20e4932d6fe7ed3c4`, pushed):
  1. `d8fa5b1b`: `refusal()` in `apps/door/worker/origin.ts` (DOOR_REQUIRED exactly "false" admits all; else 403 without the secret, 500 naming DOOR_SECRET if unset). Unit green, 7 mutations killed.
  2. `58e190bb`: RED STAGE. `apps/door/test/door-in-front.test.ts` (door harness suite in `test:worker`): the real door in front of the real sync Worker. Its two 403 cases must fail in CI's Worker tests step.
- A local loop waits for #940's build-and-test (DEAD after `/clear`; re-read with `gh pr checks 940`).

## Resume steps

1. **#940:** read CI's Worker tests step. Expect exactly the two 403 cases red. If anything else fails (wrangler startup, outbound routing, URL host handling), measure it from the log before changing anything. Then wire `refusal` (unit tests can't load the entries, so the harness test is their proof):
   - `apps/sync-worker/src/index.ts`: `const refused = await refusal(request, env, crypto.subtle.timingSafeEqual.bind(crypto.subtle)); if (refused) return refused;` before `markApiRequest`; `DOOR_REQUIRED: "false"` in `apps/sync-worker/wrangler.jsonc` vars (and `wrangler.injected.jsonc`, kept equal), then regenerate `worker-configuration.d.ts`.
   - `apps/site/worker/index.ts` the same, before the hook path; `DOOR_REQUIRED: "false"` in `apps/site/wrangler.jsonc`.
   - Then extend the door test to the site Worker: holding page through `dev.`, and a WebSocket upgrade to `/api/roadmap/live` through the door (needs the site's `build:harness`).
   - Squash at merge; the PR body says the red stage was seen.
2. **#784 remaining:** `holding-dev` behind `dev-holding.` (assets-only today, `workers_dev: false`); move CI to `workers.dev` (`deploy-dev.yml`, `dev-behind-develop.yml`), retire `scripts/verify-dev-hosts.ts`, add the door-host guard over `tests/`, `scripts/`, `.github/` (AC1b); the door deploy step (production only) and the daily request/error check (AC6); reword AC2–AC5 to the rulings.
3. **PARKED until 2026-11-15:** the non-PROD account, then AC1(d) keys, AC2 and the go-live (`DOOR_REQUIRED` "true" + secrets by the deploy). P1 #425, #426, #457, #759 follow.
4. **M2 chain:** #467 (AC5/AC6: read back every Indonesian string with `scripts/google-read-back.ts`, writer/reader table on the issue), then #104, #102.
5. **#655 AC5** on the next Dependabot PR; **#793 AC6** on Dependabot's docker PR; **#888** shut after 2026-11-20; **#864** watch site-smoke until 2026-11-19; **#930** asks first.
6. When #784 lands, message the shyden.co.uk session.

## Waiting on Shyden

- **#830:** approve the roadmap text on the ticket, and whether "launch" means the first public opening.
- **#784:** Sparked Host ticket #073955 can be closed. Click Create Account from 2026-11-15.
- **Epic #6** (18 of 18 sub-issues closed): closing it triggers the milestone re-score, and moving ticket levels is his.
- Optional: mark S9382 (await in a loop, by design) Accepted in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only, ahead of origin).
- `origin/develop` at `40f14ce3dd1c382665a938514e4fe2d32435d1d8`.
- Worktrees: `-dev-scripts` (detached at develop), `-784` (#940).
- Open PRs: #940 (draft).
