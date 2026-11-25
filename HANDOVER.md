# Handover: Yawelo Idle

**Written:** 2026-11-25, session `yawelo-idle-7a`. Branch `handover/2026-10-17-d`. develop at 263eac45 (#1106's PR 1109 merged). Worktrees: `yawelo-idle-1107` (draft PR 1110, head 4e5310d0, pushed), `yawelo-idle-1103` (PR #1105, head 1088e994), `yawelo-idle-1074` (PR #1088, head 4d75a136, red), `yawelo-idle-1098` (Dependabot PR 1098, head 8fecd91b), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached). No Colima, simulator or USB claim. Devices available again (Shyden via repo-template-56, 2026-11-25).

## Now

- **#1107 (P0), PR 1110.** Commit 1 read red on CI by name (both new tests + the contract test). Commit 2 (4e5310d0, pushed): endless undeclared body, Worker size checks restored; must be red by name: "refuses an undeclared body with 413 once it passes 1 MiB, reading no further". **Uncommitted in the worktree:** a test that `Content-Length: abc` gets 400 (security review: a non-number length must not read as small). Push it alone after commit 2's red; if it is green, the HTTP layer refuses it (evidence for the finding); if red, code follows. Then commit 3: capped streaming read (stop at 1 MiB + 1, cancel, 413), like `apps/door/worker/dev-pass/form.ts`.
- **#1106**: PR 1109 merged (Sonar on the PR: 0 issues, 0 hotspots). Last AC: Sonar's develop analysis of 263eac45 shows 0 open; was still at a3f32322 (21 open) when last read.
- **PR 1098 (Dependabot)**: red only on THIRD-PARTY-NOTICES (swagger-ui-dist 5.35.1); notices regenerated and pushed (unit 15,041/15,041 locally). Read CI, merge.
- **PR #1088**: coverage 93.9% < 94% because Worker files count 0% in Node coverage; #1103 (PR #1105) fixes that. board-orphans red was #1093 (now Todo). After #1105: update from develop.
- **#1078 raised P1→P0** (blocks #1076, P0; rule #578; board-next refused otherwise). Library merged (#1084). Door wiring waits on the sign-in Worker: `dev-signin.shyden.co.uk` does not resolve (2026-11-25). Asked `shyden-co-uk-9f` for its status, public key and host-map entries. Do not switch doors on before it is live (it would lock DEV).
- **#860**: unblocked. Asked `shydesk-cd` for hosts, embed path, CSP sources, allowed origins, ticket address. The main site sends no CSP today (#424 AC2 covers it).

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`; read replies from shydesk-cd and shyden-co-uk-9f.
2. PR 1110: read commit 2's red; push the Content-Length test; read; commit 3, unit, push, green; record on #1107; ready; merge.
3. PR #1105: update from develop, green, merge. Then #1088.
4. PR 1098: green, merge; remove `yawelo-idle-1098`.
5. #1106: read Sonar develop (0 open) and close with evidence.
6. Then ShyDesk's order: #860, #1076 (needs #1078), #1072 (blocked by #425, #426), then #784.
