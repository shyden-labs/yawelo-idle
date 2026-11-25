# Handover: Yawelo Idle

**Written:** 2026-11-25, session `yawelo-idle-14`. Branch `handover/2026-10-17-d`. develop at a3f32322. Worktrees: `yawelo-idle-1103` (PR #1105, head 767f9439, pushed, CI running), `yawelo-idle-1074` (PR #1088, head 4d75a136, CI red), `yawelo-idle-160` (draft PR 986), `yawelo-idle-dev-scripts` (detached at a3f32322). No Colima, simulator or USB claim. Real devices unavailable (Shyden via repo-template, 2026-11-25).

## Now

- **#1107 (P0)** cause measured (on #1107): the Worker answers 413 from Content-Length and closes; a client still uploading reads ECONNRESET. Scratch PR 1108 shut, branch deleted. **Draft PR 1110** (`yawelo-idle-1107`, branch `1107-hook-413-reset`): commit 1 (76a55192, pushed) = new tests + Worker size checks removed (red-first mutation; CI must show "refuses a declared body over 1 MiB..." and "...undeclared..." failing by name). **Commit 2 prepared, uncommitted**: Worker restored from HEAD~1, undeclared test now an endless stream with a 10 s limit (must be red on CI: Worker reads the whole body). **Commit 3 after that red**: Worker reads the hook body capped (stop at 1 MiB + 1, cancel, 413), like `apps/door/worker/dev-pass/form.ts`. The security review flagged the unbounded read; this is its fix.
- **PR #1105 (#1103)** head 1088e994: green except `sonar-coverage` (the #1107 race). After #1107 merges: update-branch, CI, merge.
- **PR #1109 (#1106)**: 20 Sonar smells; unit 15,042 green locally; CI running. Then read Sonar on PR 1109 (fix any new), merge, tick #1106's lines from Sonar's develop read.
- **#784**: old key `cfat...c5dc` deleted (recorded on #784). Next: the next develop deploy passes without it.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts`.
2. PR 1110: read commit 1's CI (both new tests red by name), commit + push commit 2, read its red, write commit 3, unit, push, green; record AC2/AC3 on #1107; mark ready; merge.
3. PR #1105: update from develop, green, merge. Then #1088 (`yawelo-idle-1074`).
4. PR #1109: green + Sonar read, merge.
5. **Then ShyDesk's blockers before #784** (Shyden, 2026-11-25, AskUserQuestion; #1076 raised to P0): #860 (blocks shydesk#237), #1076 (blocks shydesk#262), #1072 (blocks shydesk#78), then #784. board-next would pick #784 first by number: this order overrides it. Tell `shydesk-a9` (SendMessage) as each one lands.
