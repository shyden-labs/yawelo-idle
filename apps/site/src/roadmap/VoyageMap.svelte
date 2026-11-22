<script lang="ts">
  /**
   * The roadmap as one voyage map (#1068, Shyden's design, round 6 map 3):
   * the nine build stages as islands, the ship on the leg into the first
   * unfinished one, one progress bar, and the expected season with its note.
   * Read from /api/roadmap.json on load, then kept current over the Worker's
   * live socket (#829, kept as it was). Islands are real buttons over the
   * picture, which is hidden from screen readers; pressing one opens its
   * panel with what that stage brings. Only plain words are rendered.
   */
  import type { PublicSnapshot } from '@yawelo-idle/progress';
  import { COPY } from '../copy';
  import type { Locale } from '../i18n';
  import { drawing } from './drawing';
  import { FEATURES, type Milestone } from './features';
  import { ISLANDS, ship } from './layout';
  import { liveUrl, newer } from './live';
  import { expectedSeason } from './season';
  import Shape from './Shape.svelte';
  import { stages, type Stage } from './stages';
  import { estimates } from './summary';
  import { fill, islandName } from './voyage';

  interface Props {
    locale: Locale;
  }
  const { locale }: Props = $props();
  const copy = $derived(COPY[locale]);
  const words = $derived(copy.map);

  let snapshot = $state<PublicSnapshot | null>(null);
  let failed = $state(false);
  let open = $state<number | null>(null);

  const show = (next: PublicSnapshot): void => {
    if (newer(snapshot, next)) snapshot = next;
  };

  $effect(() => {
    fetch('/api/roadmap.json', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        show((await response.json()) as PublicSnapshot);
      })
      .catch(() => {
        failed = true;
      });
  });

  $effect(() => {
    const socket = new WebSocket(liveUrl(location.href));
    socket.addEventListener('message', (event: MessageEvent<string>) => {
      show(JSON.parse(event.data) as PublicSnapshot);
    });
    return () => {
      socket.close();
    };
  });

  const drawn = $derived(snapshot === null ? [] : stages(snapshot.items));
  const names = $derived(drawn.map((s) => islandName(s, copy.voyage)));
  const both = $derived(
    snapshot === null
      ? null
      : estimates(snapshot.progress, snapshot.readAt.slice(0, 10)),
  );
  const season = $derived(both === null ? null : expectedSeason(both));
  const picture = $derived(drawing(drawn, names, ship(drawn)));

  const stateText = (stage: Stage): string =>
    stage.state === 'done'
      ? words.done
      : stage.state === 'under way'
        ? fill(words.underWay, { percent: stage.percent })
        : words.notStarted;

  const toggle = (milestone: number): void => {
    open = open === milestone ? null : milestone;
  };

  const opened = $derived(
    open === null ? undefined : drawn.findIndex((s) => s.milestone === open),
  );
</script>

<svelte:document
  onkeydown={(event: KeyboardEvent) => {
    if (event.key === 'Escape') open = null;
  }}
/>

<section class="voyage" aria-busy={snapshot === null && !failed}>
  {#if snapshot === null}
    {#if failed}
      <p role="alert">{copy.voyage.failed}</p>
    {:else}
      <p>{copy.voyage.loading}</p>
    {/if}
  {:else}
    <div class="sea" data-voyage role="group" aria-label={words.label}>
      <div class="chart">
        <Shape shape={picture} />
        {#each drawn as stage, k (stage.epic)}
          {@const [x, y] = ISLANDS[k] ?? [0, 0]}
          <button
            type="button"
            class="island"
            data-island={stage.milestone}
            aria-label={`${names[k] ?? ''}, ${stateText(stage)}`}
            aria-expanded={open === stage.milestone}
            aria-controls="island-panel"
            style:left={`${String(x / 10)}%`}
            style:top={`${String(y / 4.4)}%`}
            onclick={() => {
              toggle(stage.milestone);
            }}
          ></button>
        {/each}
      </div>
    </div>
    {#if opened !== undefined && opened >= 0}
      {@const stage = drawn[opened]}
      {#if stage !== undefined}
        <div class="panel" id="island-panel" data-island-panel>
          <h2>{names[opened]}</h2>
          <p>{stateText(stage)}</p>
          <h3>{words.brings}</h3>
          <ul>
            {#each FEATURES[locale][stage.milestone as Milestone] as line (line)}
              <li>{line}</li>
            {/each}
          </ul>
          <button
            type="button"
            data-close
            onclick={() => {
              open = null;
            }}>{words.close}</button
          >
        </div>
      {/if}
    {/if}
    {#if both !== null}
      <div class="progress">
        <progress
          value={both.tickets.percent}
          max="100"
          aria-labelledby="voyage-bar-label"
        ></progress>
        <p id="voyage-bar-label" data-bar-label>
          {fill(words.bar, { percent: both.tickets.percent })}
        </p>
      </div>
    {/if}
    {#if season !== null}
      <p data-season>
        {fill(season.half === 1 ? words.season1 : words.season2, {
          year: season.year,
        })}
      </p>
      <p data-season-note>{words.seasonNote}</p>
    {/if}
    {#if words.islandNamesNote !== null}
      <p data-island-names-note>{words.islandNamesNote}</p>
    {/if}
  {/if}
</section>

<style>
  .voyage {
    max-width: 64rem;
    margin: 0 auto;
  }
  /* The map's box scrolls sideways on a phone; the page never does. */
  .sea {
    overflow-x: auto;
    max-width: 100%;
  }
  .chart {
    position: relative;
    min-width: 640px;
  }
  .chart :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
  .island {
    position: absolute;
    width: 9%;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }
  .island:focus-visible,
  .island[aria-expanded='true'] {
    outline: 3px solid #f4c95d;
    outline-offset: 2px;
  }
  .panel {
    margin: 1rem 0;
    padding: 1rem;
    border: 2px solid currentColor;
    border-radius: 0.75rem;
    overflow-wrap: anywhere;
  }
  .panel h2 {
    margin: 0;
  }
  .panel h3 {
    font-size: 1rem;
    margin: 0.75rem 0 0.25rem;
  }
  .panel ul {
    margin: 0 0 0.75rem;
    padding-left: 1.25rem;
  }
  .progress progress {
    width: 100%;
    height: 1rem;
  }
  @media (prefers-reduced-motion: no-preference) {
    .chart :global(.waves) {
      animation: drift 12s linear infinite alternate;
    }
    .chart :global(.wake) {
      animation: drift 3s ease-in-out infinite alternate;
    }
  }
  @keyframes drift {
    to {
      transform: translateX(-12px);
    }
  }
</style>
