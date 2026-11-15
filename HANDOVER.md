# Handover: Yawelo Idle

**Written:** 2026-11-15 09:40 WIB (session `yawelo-idle-f6`). Colima not used. **Shyden is AFK, possibly for days**: keep going without him.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## In flight

- **#975** (P3, 2 pts, filed 2026-11-14, blocks #109; Shyden chose this fix 2026-11-15): PR #976, branch `975-ts-import-endings`, head `13d531f9` (pushed), worktree `../yawelo-idle-975`. 135 relative imports in `packages/core/src` end in `.ts`; core/content/bots/ui tsconfigs set `allowImportingTsExtensions`. Laptop: probe red→green (`.superpowers/sdd/975/{red,green}.log`), unit 14,310 before and after, lint/typecheck/format clean. CI was running at 09:40 WIB.
- **#109** (P3, In Progress): branch `109-evidence-recorder`, head `f8e57dfc`, **committed, not pushed**, worktree `../yawelo-idle-109`. `packages/content/src/evidence.ts` (record source / back-translation / label audit, promote, evidenceGaps, statusReport), `scripts/content.ts` CLI, npm `content` and `content:check`, added to `tests/integration/script-loads.test.ts`. Red on throwing stubs 32 + 11 (`red-module.log`, `red-cli.log`), green 43; 6 mutations each red (`.superpowers/sdd/109/M*.log`); unit 14,353 green. A real `node scripts/content.ts` run failed with ERR_MODULE_NOT_FOUND, hence #975.
  - Reading of AC2 used: an id is recorded once; the drafting source (`item.source`) counts only as the first source. AC5's share is over shipped items (claude-checked + native-reviewed), as `needsDisclosure`. AC3's method goes in the history line.

## Resume steps

1. PR #976: read CI by job name on the head SHA (`~/.claude/scripts/pr-verdict.sh 976`); green → squash-merge into develop, verify the dev deploy, post evidence on #975, close it by hand, remove worktree/branch.
2. #109: in `../yawelo-idle-109`, `git merge origin/develop` (no rebase); add `.ts` to `./index` in `evidence.ts` and `./evidence` in `index.ts`; prettier, lint, typecheck, unit; drive the CLI end to end on a copy of the fixture (commands in `.superpowers/sdd/109/cli-run.log`'s session); push, PR, CI, merge, evidence, close.
3. **#830**: after 15:00 WIB 2026-11-15, write the 4 approved English lines (from `docs/translations/2026-11-14-roadmap-id.md`) to a JSON array, run `node scripts/google-read-back.ts en id < file` from `-dev-scripts`, add Google's en→id column in a docs PR. AC2/AC3 wait on Shyden.
4. **#784** go-live unparks 2026-11-15.
5. **#971** (P2): at the next laptop unit 1 s timeout, measure during the run (2 s sampler of `vm.loadavg`, `vm.swapusage`, `memory_pressure`).

## Waiting on Shyden (AFK)

- #830 final reading of the Indonesian; #102's CC BY-NC-SA 4.0 for UI strings; #106/#107 scope; Sonar exclusion of `docker/node/Dockerfile` (S6471); Sparked Host ticket #073955; S9382 in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only). `origin/develop` at `fba76b52`.
- Worktrees: `-dev-scripts` (detached at origin/develop), `-109`, `-975`. No local job running.
