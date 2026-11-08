# Handover: Yawelo Idle

**Written:** 2026-11-08 (fifty-seventh session). No Colima or device claim held. **Phones:** none needed.

**Next session:** `ListAgents`, then `node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"` from `../yawelo-idle-dev-scripts` (refresh: `git -C ../yawelo-idle-dev-scripts fetch -q origin && git -C ../yawelo-idle-dev-scripts checkout -q --detach origin/develop`). Node: `~/.local/share/node/current/bin`.

## Done this session

- 2026-11-08 (fifty-seventh session, continued). Parked questions answered earlier today: #858 (support link; shyden.co.uk ruled it Yawelo Idle's only, nothing filed there), #828, #452, #103 split to #922.
- **#655 SonarCloud:** PR #923 merged into develop as `f8f8d0af` (the integration list now has `scripts/sonar-verdict.ts`; first scan's S4624 fixed; **S9382 accepted by Shyden**, recorded on #655). CI was green on the head, every step run: `sonar-coverage`, `sonarcloud` (gate OK, so the `sonarcloud` environment's token works), build-and-test, coverage, board-orphans. **PR #924** merged as `620616c4` (pins both Sonar jobs in `tests/unit/required-checks.test.ts`; watched red). Making them required: the App gets HTTP 403 on branch protection, so it is **Shyden's step** (commands in Waiting on Shyden).

- **#925 shut** (legal pages English only, Shyden's global rule 2026-11-08): PR #926 merged as `623a7001`; `/id/privacy` gone, `/privacy` English with the one Indonesian note line (Google read-back exact). #423, #246, #338, #858 now say English only.
- **#655:** PR #924 merged (`620616c4`); Shyden made both Sonar checks required and deleted the repo-wide token, which exposed the missing environment token (above).
- **#784:** Gmail yaweloidle@gmail.com, Yawelo's Cloudflare login, both domains bought, mail hosting bought (Shyden's choice after comparing Purelymail, Migadu, iCloud+, Zoho).

## Running

- Nothing.

## Resume steps

0. `ListAgents`, then board-next. Browser: Yawelo work uses the **Yawelo Chrome profile** (memory `feedback-yawelo-chrome-profile`); select it with `list_connected_browsers` (signed in to Cloudflare as yaweloidle@gmail.com, SonarCloud and GitHub as ShydenMcM, Sparked Host as Shyden).
1. **#655 AC5 only:** when Dependabot next opens a PR, read its `sonarcloud` job by step name and the `sonar-verdict:` lines (Dependabot uses the Dependabot copy of `SONAR_TOKEN`). Then shut #655. Everything else is proven and recorded on #655 (required on develop + main; env token `yawelo-idle-ci` to 2027-11-08; planted ERROR blocked PR #927, closed).
2. **#784 mail:** Sparked Host Starter for yaweloidle.com (service 633542, invoice 842085 paid 2026-11-08) was still **Pending, no IP**, hours later; Shyden chose to wait rather than open a ticket. When Active: open its Athena panel, create the mailbox, read its MX/SPF/DKIM values, add them plus DMARC in Cloudflare DNS for yaweloidle.com (show Shyden each record first), test send and receive with headers showing SPF/DKIM/DMARC pass. Then ask whether "domain at Cloudflare + mailbox at Sparked Host" becomes a rule for every project. If still Pending next session, ask Shyden again about a support ticket.
3. **#928** (P2): legal pages English **and** Indonesian (reverses #925's English-only flag; Indonesian privacy text: Google read-back, then Shyden's reading). **#929** (P4, blocked by #635): PSE finding. Then #103, M2. #830: draft the roadmap page text and park the approval question here.
4. **On a repeat of the 1 s unit timeouts** (#859, #917): measure swap, load, `memory_pressure`, busy sessions; file a ticket.
5. **#793 AC6:** when Dependabot opens its docker PR for `.github/node`, read its setup-node log line, then shut #793. **#888:** shut after 2026-11-20 with the deploy-dev tally. **#864:** watch site-smoke reds until 2026-11-19.
6. By board: #783 (P0) waits for the next release cut.

## Waiting on Shyden

- #830 copy approval. Optional: mark S9382 Accepted in SonarCloud.

## State

- Main checkout on `handover/2026-10-17-d` (handover commits only).
- Live worktrees: `-dev-scripts`, `-402`, `-875`, `-655` (detached at develop), `-925` (merged; removable).
- Open PRs: #602 (Stryker, waits for a runner release).
