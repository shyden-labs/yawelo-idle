# D1 migrations

SQL files applied in order by `wrangler d1 migrations apply`, which the dev
deploy runs against `yawelo-idle-dev` BEFORE it deploys the Worker, so new code
never meets an old schema. Name each one `NNNN_what_it_does.sql`
(`wrangler d1 migrations create yawelo-idle-dev <what_it_does>` does this).
The first, `0001_players_devices_saves_pairings.sql`, holds players, devices,
saves, save versions and pairings (#162, spec §6.6 and §6.7);
`tests/guards/d1-migrations.test.ts` holds the numbering and the deploy order.
