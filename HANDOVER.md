# Handover: Yawelo Idle

**Written:** 2026-11-08 (fifty-eighth session). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- 2026-11-08 (fifty-eighth session). **#928** (P2, In Progress): PR **#931**, head `a1df22ad` (read from git), branch `928-legal-en-id`, worktree `../yawelo-idle-928`. `/id/privacy` is back, `LEGAL` is keyed en/id, each copy has a governing-language line, and `legal.test.ts` refuses legal text outside en and id. Shyden approved the English and read the Indonesian (writer/reader table on #928). TDD slip: the code was first written before the red run. Shyden chose discard and redo, so the code was set aside in commit `fb724d64`, the tests ran red against develop (10 of 30), and the code was written again. AC5 tickets already said en + id.
- **#930 filed** (P2, 3 points): the rate-memo "the words held" 1 s timeout repeated, with swap at 7.4 of 8 GB (the #917 watch).
- Told shyden.co.uk the verified Yawelo URLs (yaweloidle.com is not live; no test host). Its session says Shyden ruled its prod link moves to yaweloidle.com at its next release, before that domain resolves. **Tell that session when #784 lands.**
- Progress page republished (version 13).

## Running

- Nothing local. CI on PR #931 was in progress at the close (board-orphans passed).

## Resume steps

0. `ListAgents`, then board-next. Yawelo browser work uses the **Yawelo Chrome profile**.
1. **PR #931:** `~/.claude/scripts/pr-verdict.sh 931`. Read every step by name on the head SHA (`gh pr view 931 --json headRefOid`). If green, squash-merge into develop, check `/id/privacy` on dev, then shut #928 and remove `../yawelo-idle-928` (and `-925`).
2. **#655 AC5:** on the next Dependabot PR, read its `sonarcloud` job steps and `sonar-verdict:` lines, then shut #655.
3. **#784 mail:** Sparked Host service 633542 was Pending. When it is Active: create the mailbox, add MX/SPF/DKIM/DMARC in Cloudflare (show Shyden each record first), test send and receive. If it is still Pending, ask Shyden about a support ticket. When it lands, message the shyden.co.uk session.
4. Then #929 (P4, blocked by #635), #103, M2. #830: draft the roadmap text and ask for approval. #930 when the board picks it.
5. **#793 AC6** on Dependabot's docker PR. **#888:** shut after 2026-11-20. **#864:** watch site-smoke until 2026-11-19. #783 (P0) waits for the release cut.

## Waiting on Shyden

- #830 copy approval. Optional: mark S9382 Accepted in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-655` (detached at develop), `-925` (merged; removable), `-928` (PR #931).
- Open PRs: #602 (Stryker, waits for a runner release).
