# Handover: Yawelo Idle

**Written:** 2026-11-28 22:46 WIB, session `yawelo-idle-a7`. Branch `handover/2026-10-17-d`. develop at 35365624 (#986). main at e9345241. No Colima, simulator or USB claim held. No worktree or branch open but this one. board-next: #1078 (P0, Todo: its remaining steps are Shyden's).

## In flight

Nothing. develop's deploy-dev 46160327177 (35365624) green on every step: Unit tests, verify ("Verify dev is behind its door, …"), verify-roadmap, site-smoke through the dev door. The only skips were the Edge cache save and the on-failure screenshot uploads.

## Done this session

- #1157 merged (dev origins require their door, no dev password); #1160 merged (docs smoke tests allow Cloudflare's injected analytics beacon, W17, via `tests/site/beacon.ts`).
- #1159 merged and #1123 closed with evidence (no-email scan judged by characters read, limit 8).
- #986 merged (#160 save backups library + notice; Sonar fixed). #160 stays open: AC6 phones/tablets wait on #1149; the game does not save yet. Set to Todo.
- #1158 filed (P0, 2): voyage map tests time out in the full unit suite under heavy load; two different tests seen, evidence on the ticket.

## Resume steps

1. `ListAgents`; board-next from `../yawelo-idle-dev-scripts` (detach to origin/develop first).
2. If board-next still gives #1078: its remaining ACs are Shyden's (below); take the next ticket it lists after asking it, or #1158.

## Parked for Shyden

- #1078: check the site Worker holds no leftover `DEV_PASSWORD` secret, then delete `DEV_BASIC_AUTH_PASSWORD` from the dev environment; then sign in once in Safari, Firefox and Edge (AC5).
- Buttondown (#343): once the second free account exists, its API key goes in as a dev environment secret. The live `yawelo` account's keys stay untouched.
- #1152 AC4: read the next release's deploy-prod run, then close.

## Devices

#1149 (P0) blocks #992/#993, and those also wait on playwright-devices#68 (0.2.2; playwright-devices-25 messages when it's on npm). Yawelo has no device code yet.
