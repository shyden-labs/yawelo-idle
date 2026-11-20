# Handover: Yawelo Idle

**Written:** 2026-11-21 01:46 WIB (progress page v73 republished 01:45 WIB), session `yawelo-idle-53`. Branch `handover/2026-10-17-d`. Main is at c634281 (release #1050). Worktrees: `yawelo-idle-1055` (branch `1055-tab-icon`, 7235be5, draft PR #1056), `yawelo-idle-1003` (branch `1003-shared-playwright-devices`, cd7f4f2, draft PR #1054), `yawelo-idle-52` (927edb1, draft PR #1042), `yawelo-idle-160` (35dd400, draft PR 986), `yawelo-idle-dev-scripts` (detached at develop 70bc717). No Colima, simulator or USB claim. A background wait on PR #1054's CI dies with this session; re-read it with `~/.claude/scripts/pr-verdict.sh 1054`.

## State

- **#1003 (P0, In Progress), draft PR #1054, head cd7f4f2:** shared setup, Edge, the shared check, measured limits (Install Edge 3 min) all in. Engines pass on all four browsers; Sonar green. **Blocked by** #1055 (Edge asks for `/favicon.ico`, measured 404; the game and site have no icon; the design is Shyden's call) and playwright-devices#39 (Playwright's JSON strips `@` from tags, so the shared group-tag check never fires; that session is fixing it). AC5(a) proven refused (run 44785092678); AC5(b) waits on #39's release; evidence comment on #1003.
- **#1055 (P0, In Progress), draft PR #1056 (7235be5):** game and site declare a shared SVG tab icon; unit tests green. Three candidates in `docs/design/tab-icon/`; the question is on #1055 for Shyden. After his pick: swap both `favicon.svg`, deploy dev, curl `/favicon.svg` and `/play/favicon.svg` on both hosts (200), screenshot real tabs, merge, then merge develop into #1003's branch so Edge's shell journey passes.
- **Morning questions posted (answer, then act):** #1055 icon (3 candidates); #830 AC2 epic Public titles/summaries (13-row table); #1013: prod API host scope, yawelo.com needs his Cloudflare sign-in, accept 308 vs 301, use his Chrome's Yawelo profile for AC4. Nothing running in the background.
- **Closed tonight:** #122 (attribution manifest, PR #1057 → develop `ef5cffaf`, dev deploy 44791693863 all 9 jobs green), #888 and #864 (14-day watches: 101 and 111 deploy runs read, 0 smoke / site-smoke failures). #1025 got its 12 blockers linked (#111–#120, #127, #462). #343 has a morning question (AC2 is UK ICO, likely stale). #110 is large and its AC4 needs destination records that don't exist yet: ask or split before starting.
- Release #1050 finished; #1015, #622, #1038, #783, #1021 closed with evidence. #1013's old Worker and Pages project deleted.

## Open question to Shyden

- He pasted a panel message saying to change "your domain(s)" nameservers to ns1/ns2.athenapanel.com. My advice was NOT to do this for yaweloidle.com (everything runs on Cloudflare DNS). Ask which domain it was for.

## Resume steps

1. `ListAgents`; check for playwright-devices' message with #39's fixed version. Then `npm install` in `../yawelo-idle-1003` (the range takes it), re-plant AC5(b) (a test with `{ tag: '@desktop' }` and no reason) in ONE commit, see it refused in CI, revert.
2. Ask Shyden which #1055 candidate (AskUserQuestion, plain words, links from the #1055 comment). Then do the post-pick steps in State.
3. #1003 then goes ready: CI green on head, squash-merge, read the develop deploy's `one-suite:` totals (AC4) and the deploy-dev smoke step times for their limits, quote both on #1003, close.
4. #1013 ACs left open; #52 (PR #1042), #164 as before.
5. Next ticket: `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (detach at origin/develop first).
