# Handover: Yawelo Idle

**Written:** 2026-10-30, 04:50 WIB (twenty-fifth session, overnight; Shyden asleep until 06:00 WIB). **Running when written:** nothing.
**Next session:** `ListAgents`, then `board-next` (it names #728, In Progress and blocked by #733, by design: `scripts/board-next.ts:8`). Every P0 now waits on Shyden's #780 answer; the P1s wait on him too (below). The workable P2s include #697 (the sibling of #786, ShyTalk's fix described on it).

## Node

`~/.local/share/node/current/bin` (v26.12.1, ICU 78.3). If `node -p process.versions.icu` is not 78.3, prefix with `export PATH=$HOME/.local/share/node/current/bin:$PATH;`.

## Closed overnight (each merged into develop, CI green on its head, dev deploy green)

- **#782**: required-check jobs' key sets pinned (PR #787, `2d9f7d0`).
- **#785**: `.nvmrc` = 26.12.1 exactly (PR #789, `c802418`); CI resolved v26.12.1.
- **#786**: scalar zeros on settled or polled values read (PR #792, `f4a9bd3`), after #790 (refused by the mutations judge: no guards row) and #791 (guards row green on an unmeasured guess).

## #762 (worktree `../yawelo-idle-761`, HEAD `2e28892`, not pushed by design)

Blocked by #780. Task 1 (#733) is fully written: `6d36f3b` attach, `0958de0` checker, `0235816` measure calls it (+ end-to-end measure cases), `267c496` coverage-env reader, `01502e0` whole-tree guard + `733-child-coverage.ts`, `2e28892` guards and integration mutation rows. Unit: the same 9 floor breaches as the merge. **Never run (CI-only):** integration, guards and all 733 mutation rows. Plan log: pass 8 in `.superpowers/sdd/762/plan.md`. The branch now sits behind develop by #782, #785 and #786: merge develop in before its record (floors re-recorded, never hand-merged).

## #780 (P0): parked on Shyden

Mac spike (comment on #780; logs in `-761/.superpowers/sdd/762/probes/act-spike-780/`): under act, checkout, setup-node and the gate pass, but the `ref:` checkout needs a token, and a fake token breaks act's own action cloning.

## For Shyden in the morning

- **#780: may the rehearsal hand act the job's own read-only `GITHUB_TOKEN`?** Without it, act can't check out the measured commit. The alternative rehearses a copy of the workflow with its `ref:` checkouts dropped. AC9 says no real secrets, so it's your call.
- **#783 (P0):** nothing on GitHub stops a PR into `main` from a non-`release/*` branch; only my local hook does. Blocked by #762.
- **#784:** Yawelo's own Cloudflare login and accounts need your new Gmail and login. Should #425 (P1) wait for them? #588/#589 (P1, Swagger) also wait on #425 for production (comment on #588).
- **#788:** allowScripts route (exact pins re-approved per bump, deny both scripts, or keep bare names).
- **`hooks/disguised-waits.py` misses perl's `select(undef,undef,undef,N)`** (I used it once by mistake; recorded in the guard reference).
- Node 26.13.0 is out (2026-10-28): a bump for the alignment skill. repo-template#134 is the mutation runner.

## Waiting on Shyden (older)

- Delete the #771 scratch ref `refs/floors/tooling/771-record-rehearse-job` (`1450a1e`).
- `ROADMAP_APP_KEY` as a Dependabot secret (#661 AC1).
- How to measure a unit test's own CPU now the overlay is refused (#536).

## State

- Main checkout on `handover/2026-10-17-d` (local handover commits). Its CLAUDE.md is OLD; read develop's.
- Worktrees: `-761` (#762); `-782`, `-785` and `-786` merged and done (safe to remove after a look); `-771`; `-728b`, `-752`, `-36` parked; `-728-probe` has uncommitted probe files (ask before removing).
- Local branches kept after their merges: `tooling/785-nvmrc-exact*`, `tooling/786-zero-resolves*`. No scratch ref of tonight's is left on origin (read with `git ls-remote`). Older ones remain: `tooling/728-coverage-check`, `tooling/752-pre-push-per-commit` (parked tickets) and #771's.
- Run logs go in `.superpowers/sdd/<ticket>/` (ignored), never a worktree root.
- Use `/usr/bin/grep` for searches whose empty result matters.
