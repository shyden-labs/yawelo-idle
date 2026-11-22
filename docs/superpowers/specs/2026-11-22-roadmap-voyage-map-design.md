# The roadmap as one voyage map (#1068)

**Date:** 2026-11-22. **Ticket:** shyden-labs/yawelo-idle#1068 (P1, 8 points). **Design:** Shyden's, recorded on #830 (comment 7076778792) and #1068 (comments 7080871066, 7080884556). The drawing starts from round 6, map 3 of `.superpowers/sdd/830/island-designs-round6.html` (git-ignored; `renderTimeline` with `pattern: 'wavestars'`, `label: 'sign'`, `beach: 'wide'`, `mark: 'uncharted'`).

## 1. What changes

The roadmap page (`/roadmap`, `/id/roadmap`) becomes: the page title, the voyage map, one progress bar, one expected season with its note, and (Indonesian page only) the English-names note. Everything else on today's page goes: the three intro paragraphs, the summary table, both estimates, points, ticket counts and numbers, the recently-shipped and waiting-on-decisions lists, "behind the scenes" counts, the "Live / Not live" line and the "Updated n s ago" line. The loading and failed lines stay (they are the page saying it has nothing to draw yet).

The Worker, the snapshot (`PublicSnapshot`), `/api/roadmap.json`, the live socket and `roadmap.openapi.json` do not change. Live updates keep #850's latency because the socket code in `VoyageMap.svelte` is kept as it is.

## 2. Measured facts this rests on (board read 2026-11-22)

- The board has 9 epics with a milestone, M0–M8, each with the Public title AC2 names: #5 Shipyard (4/4 closed), #6 The engine (12/12), #17 First words (7/27), #7 First playable (3/43), #8 Saves and sync (4/21), #9 Fair play (0/45), #10 The wider world (0/49), #11 Desktop and phone apps (0/14), #12 Into the stores (0/6).
- 3 epics have no milestone (#328 Deeper prestige, #331 This website, #452 Privacy-first analytics). They get no island; their stories still count in the progress bar, which keeps today's all-in-scope figure.
- `packages/progress` already gives both forecasts (`estimates()` in `apps/site/src/roadmap/summary.ts` calls `etaDate`).

## 3. The model (pure TypeScript, unit-tested)

### `apps/site/src/roadmap/stages.ts`

```ts
type StageState = 'done' | 'under way' | 'not started';
interface Stage { epic: number; milestone: number; name: string | null; closed: number; total: number; percent: number; state: StageState }
function stages(items: PublicItem[]): Stage[]
```

- One stage per epic whose `milestone` is 0–8, sorted by milestone. Epics with no milestone are left out.
- `closed` / `total` count the epic's own stories (`parent === epic`, not epics). `percent = floor(100 * closed / total)`, so 99.6% never shows as 100. A stage with no stories is `not started`, 0%.
- `state`: `done` when closed === total > 0; `not started` when closed === 0; else `under way`. The epic's own open/closed state is not read (AC2: the closed share of its stories).
- `name` is the epic's Public title; null falls back to the existing `islandName` placeholder ("Milestone {n}").

### `apps/site/src/roadmap/layout.ts`

- `ISLANDS`: the 9 island centres in a 1000 × 440 viewBox, from the design: `[100,110] [310,100] [520,118] [720,104] [905,122] [820,300] [600,318] [390,304] [170,318]` (top row left to right, bottom row right to left).
- `ship(stages)`: a `Leg` `{ from: [x,y], to: [x,y], share: number, fromHarbour: boolean }` or `{ moored: MOORING }` (`MOORING = [230, 340]`). `fromHarbour` marks the leg whose start is open water, so `shipPoint` does not trim it.
  - First unfinished stage `k` (state not `done`). The ship is on the leg into `k`, at `share = closed / total` of that stage (0 when total is 0).
  - `k = 0` (nothing done): the leg starts at the harbour `HARBOUR = [20, 220]` (open water left of and below island 0), so the ship is on the water before the first island.
  - Every stage done: `{ moored }` beside the last island, `[230, 340]`.
- `shipPoint(leg)`: the point on the straight line from `from` to `to`, each island end trimmed by 48 px of shore (the design's `ax = a + 48`, `bx = b − 48`; the harbour end is not trimmed), at `share`, then 22 px down onto the water. This works in any direction, which the design's `a[0] + 48` did not (the bottom row runs right to left, and leg 4→5 runs down).
- AC4's unit tests pin `shipPoint` for 0%, 50% and 100% of a leg, a right-to-left leg, the all-done board and the none-done board, each seen red first.

### `apps/site/src/roadmap/season.ts`

```ts
function expectedSeason(e: Estimates): { half: 1 | 2; year: number } | null
```

- The later of `e.tickets.eta` and `e.effort.eta` (Shyden: the later of the two). Half 1 is January–June, half 2 July–December (Shyden: halves).
- null (the line and its note are hidden, Shyden) when either ETA is null or effort is unavailable.

### `apps/site/src/roadmap/features.ts`

The approved features per milestone (comment on #1068), English and Indonesian, as `Record<Locale, Record<0|1|2|3|4|5|6|7|8, string[]>>`. A unit test per locale checks every milestone 0–8 has at least one line.

## 4. The page (Svelte 5)

- `VoyageMap.svelte` keeps its fetch and socket code and renders three children: `SeaMap.svelte` (the SVG), `IslandPanel.svelte` (the open island's panel) and the progress block (bar, season, note).
- `SeaMap.svelte` draws the design's sea (navy gradient, stars above, waves below, moon glow), the route (gold and solid for legs into done islands, faint dashes after), each island (sand, rugged, wide beach, palms, hut; done adds lamp, red flag, green tick and "✓" on the sign; under way a progress ring with the %; not started a dashed "uncharted" outline), the outrigger perahu with its wake, and the gold trail to it. The design's seeded random shapes (`rng`, `blob`) are ported as a pure module (`drawing.ts`) so the picture is the same on every load and in every test.
- Islands are real `<button>` elements laid over the SVG at the same percentage positions (`left: x/10 %`, `top: y/4.4 %`), each labelled "{name}, {state}" (e.g. "First words, under way, 25% done"). The SVG itself is `aria-hidden`. Pressing a button opens the panel; pressing it again, or the panel's close button, or Escape closes it. Only one panel is open at a time.
- The panel shows the island's name, its state, and the feature lines for its milestone.
- Phone width: the map sits in a box that scrolls sideways (`overflow-x: auto`, map min-width 640 px); the page itself never scrolls sideways.
- Reduced motion: the waves and the wake do not move under `prefers-reduced-motion: reduce`.
- The progress bar is today's `<progress>` with today's figure (`estimates().tickets.percent`), labelled in words.

## 5. Copy

New public strings, English for Shyden's approval before any translation, then Indonesian with Google Cloud Translation read-back and D18 evidence in `docs/translations/`:

| Key                     | English                                                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mapLabel`              | The voyage to launch                                                                                                                                             |
| `state.done`            | Done                                                                                                                                                             |
| `state.underWay`        | Under way, {percent}% done                                                                                                                                       |
| `state.notStarted`      | Not started yet                                                                                                                                                  |
| `panel.brings`          | What this brings                                                                                                                                                 |
| `panel.close`           | Close                                                                                                                                                            |
| `bar`                   | {percent}% of the work to launch is done                                                                                                                         |
| `season.1` / `season.2` | Expected launch: first half of {year} / second half of {year} (approved)                                                                                         |
| `seasonNote`            | This is an estimate, not a promise. It can change as the game is built: some parts take longer than planned, and ideas from players can add new work. (approved) |
| `loading`, `failed`     | kept as today                                                                                                                                                    |

Island names stay English on the Indonesian page; its note line becomes "Island names on this page stay in English." (translated, read back). The old voyage and summary strings are deleted with the code that used them.

## 6. Code removed

`RoadmapSummary.svelte`, `Island.svelte`, and in `summary.ts` everything but `estimates` (`whatsLeft`, `recentlyShipped`, `waitingOnDecisions`, `secondsAgo`), with their tests; in `voyage.ts` the old `Island`/`Voyage` model replaced by `stages.ts`, keeping `fill` and `islandName`. Nothing else imports them (checked with `git grep` before each deletion).

## 7. Tests

- Unit (Vitest, mocks only, each red first): `stages.test.ts`, `layout.test.ts`, `season.test.ts`, `features.test.ts`, and the component tests rewritten for the new page (`VoyageMap.test.ts`: renders 9 island buttons with names and states, the bar, the season and note, hides them with no forecast, opens and closes one panel at a time, updates from a newer socket snapshot).
- E2E (`tests/site/roadmap.spec.ts`, one journey per the one-journey rule, real clicks and keys): the page as it loads (9 islands named and stated from the served snapshot, the bar, season/note, nothing from the old page); pressing islands (panel opens with its features, closes, one at a time); the keyboard (Tab, Enter, Space, Escape); phone width (map box scrolls sideways, page does not); the not-live case keeps the snapshot. These are committed alone first and read red by name on CI (global rule, 2026-11-22) before the code exists.
- Every browser and device target runs the same suite unchanged.

## 8. Out of scope

The Worker and snapshot, #830 AC1's new short intro text (if any), and the production release (Shyden sees it on dev first, AC8).
