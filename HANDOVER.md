# Handover: Yawelo Idle

**Written:** 2026-11-09 (fifty-ninth session). No Colima or device claim held. **Phones:** none needed. Shyden asked for work to go on by Priority while he sleeps; anything needing him is parked below.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- **#928 shut:** PR #931 merged; `/privacy` and `/id/privacy` read on the dev site Worker's own address (the dev front door shows the holding page).
- **#103 shut:** PR #935 (`76e52fa2`). `structureChecks` in `packages/content`: unique lexicon ids, no empty strings. `review.notes` is now nullable. Nothing runs it on a real pack until #106 (noted there).
- **#933 shut:** PR #934 (`b3f77eaa`), Shyden's "One journey, all its assertions" rule. 39 tests became 14, lines naming `expect` unchanged. site-smoke 181 s to 132 s; integration moved 209 to 257 s on the deploy run (175 s on the PR), so no integration saving is claimed.
- **#784, mail part done:** `support@yaweloidle.com` on Sparked Host (Paris). Inbound seen in the inbox; outbound reached Gmail's inbox with SPF, DKIM and DMARC PASS. Five DNS records at Cloudflare, DNS only. Nameservers stay at Cloudflare. Not read: the receiving side's verdict on inbound (Chrome refused that raw page). Evidence on #784. The rest of #784 (accounts, doors, environments) is open.
- **#932 filed** (P3, 2 points, blocked by #784): the privacy page names `support@`, Sparked Host and France.
- **#830:** AC1 draft posted on the ticket for approval.
- **#622:** noted that shyden.co.uk must be told when the promo is re-cut (its #1084). It has been told the mail works and that yaweloidle.com has no website yet.

## Running

- Nothing local, and no CI awaited.

## Resume steps

1. **#783 (P0)** is what board-next names, but it waits for the release cut. Then P1: #425, #426, #457 and #759 chain on #784.
2. **#784's remaining ACs** are the P1 route to work: read them, and check what needs Shyden's accounts first.
3. **M2 chain:** #102 waits on #104, #104 on #467, #467 on #638 (Google read-back under the shared lock and ledger). Start at #638. #467's title still names LibreTranslate though the global rule is now Google, so re-read its ACs; its other blocked tickets (#109, #338) depend on the answer.
4. **#655 AC5:** on the next Dependabot PR, read its `sonarcloud` steps and `sonar-verdict:` lines, then shut #655. None was open at this close.
5. **#793 AC6** on Dependabot's docker PR. **#888:** shut after 2026-11-20. **#864:** watch site-smoke until 2026-11-19. **#930** when the board picks it; its reproduction needs induced swap, which slows peers, so ask first.
6. **Epic #6 (M1)** has 18 of 18 sub-issues closed and is still open. Closing it triggers the milestone re-score, and moving ticket levels is Shyden's: ask.
7. When #784 lands, message the shyden.co.uk session.

## Waiting on Shyden

- **#830:** approve the roadmap text on the ticket, and whether "launch" means the first public opening.
- **#784:** Sparked Host ticket #073955 can be closed; it asked only for activation. The order said Sydney, but the panel offered no Sydney, so he picked Paris.
- **Epic #6 and the milestone re-score** (step 6).
- Optional: mark S9382 Accepted in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-655` (detached at develop).
- Open PRs: #602 (Stryker, waits for a runner release).
