# Handover: Yawelo Idle

**Written:** 2026-10-30, ~07:30 WIB (twenty-sixth session). **Running when written:** nothing.
**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"`. Node: `~/.local/share/node/current/bin` (v26.12.1, ICU 78.3).

## What changed today (read this first)

Shyden ruled globally on 2026-10-30, "just keep it simple" (`~/.claude/CLAUDE.md` "Keep it simple" and "Value test before EVERY decision"; `~/.claude/global-rules/pending-keep-it-simple.md`). Dropped: per-file coverage floors and record/fold, `Floors:` lines, Gaps-checked sections, guard floors and meta-guards, mutation checks, workflow-line coverage, per-test CPU and load limits. 21 paperwork hooks are disconnected. In this session he also said "shorten it down and get it fixed properly, then lets move on to the game again", and that files no coverage tool can measure (workflows, shell) leave the coverage score in every project.

Done here:
- **Filed #795** (P0, 8 points): remove the dropped machinery and keep one overall v8 coverage threshold. It's the one cleanup ticket for this repo. Its ACs list every piece (74 floors files, 69 mutation files, `floorBreach` in 103 files, `searched` in 88, `record-floors.yml`, `record-minimums.yml`, `mutations.yml` and about 20 scripts).
- **Closed 41 tickets as not needed**, each with a comment citing the rulings: #794, #780, #776, #775, #774, #773, #771, #770, #766, #762, #761, #752, #740, #739, #738, #737, #736, #734, #733, #732, #731, #729, #728, #727, #697, #681, #666, #609, #604, #603, #586, #572, #541, #536, #505, #432, #415, #414, #413, #412, #36. Blocker links to them were removed from #783, #252 and #254.
- **#425 waits for Yawelo's own Cloudflare login** (Shyden's ruling). Linked as blocked by #784, and #784 raised to P1.
- **Board order kept as is** (Shyden, AskUserQuestion): #795 (my pick to go first, since it unblocks every PR), then the other P0s #765, #768, #783, then the P1 website items, then game M1.
- repo-template-af was told about the coverage trap: the per-file ratchet refused every added `.svelte` line. It added AC6 to repo-template#149.
- Memory: `feedback-record-inputs-come-from-develops-file` (asked Shyden about a token before checking develop's workflow could pass it).

## Resume steps

1. **Start #795.** Branch `tooling/795-simplify` off `origin/develop` in a new worktree, and set #795 In Progress. Suggested PR order (each one reviewable alone): (a) coverage, replacing the per-file record with an overall `thresholds` block in the coverage config at today's measured figures, rounded down. This unblocks game UI first. Then (b) mutations, (c) floors, `searched` and the record workflows, (d) meta-guards and limits, then the repo `CLAUDE.md` Flow section and branch protection's required checks (read back). Until (c) lands, a PR still needs a floors record; do (a) and (c) early.
2. Apply the value test as you go: delete rather than rewrite, and keep a guard only if it checks the product (content, licences, supply chain, workflow secrets).
3. Then follow `board-next`.

## State

- Main checkout on `handover/2026-10-17-d` (local handover commits only). Its `CLAUDE.md` is old; develop's is current.
- Dead worktrees, safe to remove after a look (nothing in them is needed now): `../yawelo-idle-794` (#794, commit `6f95480`, never pushed), `-761` (#762), `-771`, `-782`, `-785`, `-786`, `-728b`, `-752`, `-36`. `-728-probe` has uncommitted probe files: ask before removing. Local branch `tooling/780-rehearse-shards` has no commits.
- Scratch refs still on origin: `refs/floors/tooling/771-record-rehearse-job`, `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit`. These are now pointless; deleting them is Shyden's call.
- Still waiting on Shyden: #784 (new Gmail and Cloudflare login for Yawelo), #788 (needs measurements first, then his pick), `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).

## Progress (board, measured 2026-10-30 after the closes)

- By tickets: 35% (143 of 412 in-scope stories). Pace 0.86 a day over 7 days, giving an ETA of 2027-09-09 (low confidence: 5 of the 7 days closed nothing).
- By effort: 1,180 points remaining across 269 open stories. Pace 1.86 a day, giving an ETA of 2028-07-27 (low confidence). Both are before outside waits (#784's login, device sign-off).
