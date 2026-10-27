# Handover: Yawelo Idle

**Written:** 2026-10-27 (eighteenth session). **Running when written:** nothing. No jobs are DEAD. Docker Desktop is running (started this session for act); quit it if nothing needs it.
**Next session:** `ListAgents`, then `board-next` (expect #762). Resume #762's plan at **review pass 6** (step 2), not at coding.

## Node

The Mac's Node is `~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` does not print 78.3, prefix Node/npm/git-push commands with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## Resume steps

Branch `tooling/762-native-coverage` (worktree `yawelo-idle-761`): origin at `b2ce07c` (red: Guards, run 40252518322); local `9e577b1` = Task 0, **not pushed, by design**. Nothing is pushed until Task 6, which lands ONE commit on a fresh branch `tooling/762-one-map` with a new PR (b2ce07c can never pass alone, and force-push is forbidden). Draft PR #767 stays as it is until then.

1. The plan is `yawelo-idle-761/.superpowers/sdd/762/plan.md` (git-ignored). Its probes and logs are in `.superpowers/sdd/762/probes/` and `spike-a/`.
2. **Pass 6:** read the whole plan once. No finding means self-approve and start Task 1 (child processes, #733). A finding means fix, log, and read again.
3. Task 1 is now small (F11): Node propagates `NODE_V8_COVERAGE` into hand-built `env:` objects (`lib/child_process.js:722`), so there is no `measuredEnv` and no 16-file conversion. It adds `autoAttachSubprocess: true`, a premise test, a narrow guard (`env -i`, naming the variable), and the post-measure checker with the spike's literals (`used` 2, `uncalled` 0, `side` 2).
4. Task 3 (#732): the workerd spike is still open (Miniflare 5 `inspectorPort` straight to workerd), then the route question to Shyden.
5. Floors are recorded in CI only. Run the unit suite by hand before each push, and push under `source ~/.claude/scripts/test-lock.zsh heavy <label>`.

## Done this session

- **Plan review passes 2 to 5**, all logged in the plan (F10 to F20, P5-1 to P5-8). Highlights: the scratch-PR premise was unpushable (F10: first-push floors hook plus the refused coverage rise). F11, above. GitHub's runner writes `run:` verbatim (offset 0); act adds a blank line before and after (offset +1, count +2; `step_run.go:132`), so trace headers carry `lineCount` and `writer`. On bash 5.2.21 the DEBUG trap leaked 0 lines against xtrace's 8. act ignores `environment:`, runs reusable workflows and `secrets: inherit`, and with no `ref` runs NOTHING and exits 0, so rehearsals always write the ref and require a trace per job. `token-reach.ts` hard-codes Cloudflare's URL, so stand-ins are network-level (hosts file plus a CA through `NODE_EXTRA_CA_CERTS`).
- **Rulings (Shyden, 2026-10-27):** the trial ran "On this Mac" (act 0.2.89 installed with Homebrew, MIT). The five hand-started and scheduled workflows go "All five on practice runner", scope "Every project". The global reference got a 2026-10-27 paragraph (`reference-engineering-standards.md`, after the 2026-10-22 ruling).
- **Tickets amended and read back:** #738 AC1 (practice runner) plus a spike comment; #737 AC1 (DEBUG trap, not `-x`); #762 AC5 ("with no approval", quoting Shyden's 2026-10-26 words).
- **A slip, fixed and told:** my one-clause pointer, written to `~/.claude/CLAUDE.md` through Bash, took it to 33,715 bytes against a 33,542 ceiling. That blocked shytalk-07's Bash calls (it messaged me). I restored the backup with `cp` (33,540 bytes), so the ruling lives only in the reference. Memory `feedback-edit-global-rules-with-edit-tool`. A pointer in CLAUDE.md would need Shyden to choose a cut.

## Waiting on Shyden

- Set `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- Phones unavailable (2026-10-27): every device run stays parked until he says otherwise (#713 AC5).
- Optional: whether CLAUDE.md should carry a pointer to the practice-runner rule, and what to cut for it.

## Progress (board read 2026-10-27, this session)

- **By tickets:** 32% complete (140 of 436 in-scope stories closed), 1.29/day over 7 days (5, 0, 1, 3, 0, 0, 0); board ETA 2027-06-15; release about 2027-06-26 to 2027-07-03 (low confidence).
- **By effort:** 1,295 points remaining across 296 open stories, 4.86/day; board ETA 2027-07-21; release about 2027-08-01 to 2027-08-08 (low confidence).
- Measured: the board and its 7-day pace (four of seven days at zero). Assumed: about 30 unfiled prestige stories, 1.5 to 2.5 weeks of outside waits, and the real-phone sign-off (phones unavailable, with no date). Nothing closed this session (plan work only).

## State

- Main checkout on `handover/2026-10-17-d` (local handover commits, not pushed; PR #648 closed). Its CLAUDE.md is OLD: read develop's. develop `04aefda` when last read.
- Worktrees: `-761` = #762; `-728b` (#745), `-752` (unpushed; scratch ref `refs/floors/tooling/752-pre-push-per-commit`), `-36` parked; `-728-probe` has uncommitted probe files (ask before removing).
- Backups kept 30 days (never delete early): `CLAUDE.md.bak-practice-runner-2026-10-27`, `reference-engineering-standards.md.bak-practice-runner-2026-10-27`, `settings.json.bak-deleting-scripts-2026-10-26`, `reference-guards-and-mechanical-edits.md.bak-deleting-scripts-2026-10-26`, the three `*floors-line*-2026-10-25`, `CLAUDE.md.bak-hook-refusal-final-2026-10-24`, `reference-engineering-standards.md.bak-hook-refusal-final-2026-10-24`, memory `MEMORY.md.bak-compact-2026-10-24`, `settings.json.bak-amend-hook-2026-10-24`, `retest.py.bak-2026-10-22-recursion`; branches `backup/*`; tags `backup/*`, `evidence/*`.
