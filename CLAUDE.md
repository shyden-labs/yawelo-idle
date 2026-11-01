# Yawelo Idle: project instructions

Yawelo Idle is a cross-platform idle game for learning a real language: English speakers learning Indonesian (`en-id`) and Indonesian speakers learning English (`id-en`). It is built once for web and shipped to browsers (PWA), Steam (Electron) and mobile (Capacitor), owned by Shyden Labs.

The global `~/.claude/CLAUDE.md` rules all apply here. This file adds what is specific to this repo.

## Read first

- **`HANDOVER.md`**: where work stopped and the numbered resume steps.
- **Design spec:** `docs/superpowers/specs/2026-10-01-yawelo-idle-design.md`. This is the source of truth. Operator decisions D1–D18 in its §2 are settled, so don't re-ask them.
- **Research:** `docs/research/2026-10-01-idle-game-research.md`. The spec cites its H-numbers (player complaints) and DN-numbers (the do-not list).

## Boundaries

- **Board:** "Yawelo Idle Stories", a GitHub Project owned by shyden-labs. Its node id is recorded below once created. Resolve the board from that node id and assert its **title** before any write. **Never** touch project #1 (ShyTalk Stories), project #2 (Shyden Site), project #3 (ShyFerry Stories), or the ShyTalk roadmap.
  - Board node id: `PVT_kwDOEOcG584BlRWb` (shyden-labs project **4**, title "Yawelo Idle Stories", renamed by the App and read back 2026-10-05 15:25 UTC, #357)
- **Git identity:** agent git and `gh` act through the repo's GitHub App (`yawelo-idle-agent`, renamed in #357). Never route around the credential helper or the `gh` router. Commits are authored as Shyden.

## Flow

- `main` and `develop`. Each ticket gets its own branch, with a PR into `develop`, never directly into `main`. Every `develop` merge deploys the dev environment (web Worker + sync Worker + D1 dev) once the pipeline exists (milestone M0).
- TDD: failing test first. Zero warnings policy. Dependabot targets `develop`. Actions are SHA-pinned.
- One test per case: a population known before the run is generated as one test each (`it.each`), rather than looped inside a test body. A style, with no guard (#795).
- Write `Refs #N` in commit messages and PR bodies, never close/fix/resolve next to an issue number unless you mean it.
- Pull requests into `develop` merge by squash alone (#679, Shyden 2026-10-18): a ruleset on `develop` allows no other method, and build-and-test's "Develop merges by squash only" step fails while it allows any other. The one squash commit is what lands, so a branch's own commits need not pass one by one. Pull requests into `main` (release cuts) keep merge commits.
- The pre-push hook runs format, lint and typecheck, and no test suite (global rule, 2026-10-12). Run the unit suite yourself before each push.
- Coverage is one overall threshold for statements and one for branches, joined over every suite pull-request CI runs (`npm run test:coverage`, `scripts/coverage.ts`, #795), Svelte screens counted in the unit suite, where they are rendered: a component no test loads counts as untested (#798, #806). Every screen's behaviour is tested in full (Shyden, 2026-10-31: "behaviour must be teste always"): the job also fails when any statement, branch arm or function of a Svelte file goes unrun in the suites it measures, naming each line (#802, #804). Test a screen in jsdom (#806): `// @vitest-environment jsdom` at the top of the test, then Svelte's `mount`, a click, `flushSync()` and DOM reads, as `packages/ui/test/Counter.test.ts` does. That compiles the screen for the browser, where every handler and `{#if}`/`{:else}` arm is mapped and counted. A server render (`svelte/server`, as `Shell.test.ts` does) suits only a screen with no behaviour, and cannot show an `{:else}` arm. The `?? ''` Svelte adds to each `{value}` is not judged (`compilerMade` in `scripts/coverage.ts`); a `??`, `||` or `&&` we write is. The `coverage` job fails below them and is a required check. Raise them as coverage grows.

## Progress at close-out

Every close-out's two progress lines come from this repo's own script, never repo-template's copy (#340):

```
node scripts/board-progress.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"
```

It prints what `packages/progress` computes, and the roadmap Worker (#341) imports the same module, so the operator's figures and the public roadmap cannot disagree. repo-template's `scripts/board-progress.ts` is the older copy without #340's seven fixes; a change to the maths belongs in `packages/progress`.

## The next ticket

The board's `Priority` (P0 to P5), never HANDOVER.md, picks the next ticket (#576). At the start of every session, after `ListAgents`:

```
node scripts/board-next.ts PVT_kwDOEOcG584BlRWb "Yawelo Idle Stories"
```

It refuses while any open ticket has no Priority, and while any open blocker sits below a ticket it blocks: a blocker takes at least the level of what waits on it (Shyden, 2026-10-13, #578). Blockers are GitHub "Blocked by" links on the issue; a `## Depends on` section is context, not the record (#577). Milestones map onto levels (Shyden, 2026-10-13, #578): P2 is the quality-rule tickets plus the milestone in hand, P3 the next two milestones and Website, P4 the later milestones, P5 post-launch and ideas; P0 and P1 by their definitions. Re-score at each milestone close. `scripts/board-setup.ts` creates the Estimate and Priority fields on a board that lacks them.

## Website follows the game

The coming-soon site (`apps/site`, epic #331, spec `docs/superpowers/specs/2026-10-04-website-design.md`) keeps advertising the game as it grows (operator, 2026-10-06, website spec W16). When a player-facing story or epic closes, file a `Website: announce <feature>` story in the same session: 1–3 points, full ACs, Estimate set, copy approved by Shyden before translation, en + id with D18 evidence. Skip it only when the closing story says why there is nothing new to show. Every story's **Website** field (`.github/ISSUE_TEMPLATE/story.yml`) says what it lets the site show, and every close-out checks that session's closed stories against this rule.

Every new player-facing story gets its board `Public title` when filed, and every new epic its `Public summary`: plain words for the public roadmap, which never shows a raw ticket title (#342, #826). A story without one is counted on the roadmap as behind-the-scenes work, not named. The roadmap groups stories by their `Parent issue`, the epic (R4), so a story is filed as a sub-issue of its epic.

## Stack (decided, spec §6)

npm workspaces · TypeScript · Svelte 5 · Vite · Vitest + fast-check + Stryker · Playwright · break_infinity.js · ts-fsrs · Zod · Cloudflare Workers + D1 (`wrangler`) · Electron + steamworks.js · Capacitor.

## Content rule

No native speakers are available before release (operator, 2026-10-02; spec D18). Every build ships `claude-checked` and `native-reviewed` content and refuses `draft` and `rejected`. `claude-checked` must carry its evidence: two independent sources, a back-translation, and a label audit for text of 3 words or fewer. Be as accurate as possible, and never add a gate that needs a native reviewer. Players report mistakes in game (#51–#54). Motifs are publicly shared decorative traditions only: no Aboriginal dot-painting or other restricted or sacred designs.
