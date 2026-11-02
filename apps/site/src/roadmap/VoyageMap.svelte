<script lang="ts">
  /**
   * The voyage map (#827, #342 split): the roadmap snapshot drawn as islands,
   * one per epic, each opening what's built and what's left. Read from
   * /api/roadmap.json on load, then kept current over the Worker's live
   * socket (#829); without the socket it says it is not live. Only plain
   * words are rendered: an epic's name and Public summary, a story's Public
   * title.
   */
  import type { BoardItem, Progress } from '@yawelo-idle/progress';
  import type { VoyageCopy } from '../copy';
  import Island from './Island.svelte';
  import RoadmapSummary from './RoadmapSummary.svelte';
  import { liveUrl, newer } from './live';
  import { fill, voyage } from './voyage';

  interface Props {
    copy: VoyageCopy;
    /** The language `copy` is written in, for the `lang` of what it labels. */
    copyLang: string;
  }
  const { copy, copyLang }: Props = $props();

  interface Snapshot {
    version: number;
    items: BoardItem[];
    progress: Progress;
    readAt: string;
  }

  let snapshot = $state<Snapshot | null>(null);
  let failed = $state(false);
  let open = $state<number | null>(null);
  /** The socket: none heard yet, delivering, or gone (refused or closed). */
  let live = $state<'connecting' | 'live' | 'closed'>('connecting');

  const show = (next: Snapshot): void => {
    if (newer(snapshot, next)) snapshot = next;
  };

  $effect(() => {
    fetch('/api/roadmap.json', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        show((await response.json()) as Snapshot);
      })
      .catch(() => {
        failed = true;
      });
  });

  $effect(() => {
    const socket = new WebSocket(liveUrl(location.href));
    socket.addEventListener('message', (event: MessageEvent<string>) => {
      show(JSON.parse(event.data) as Snapshot);
      live = 'live';
    });
    const gone = (): void => {
      live = 'closed';
    };
    socket.addEventListener('error', gone);
    socket.addEventListener('close', gone);
    return () => {
      socket.close();
    };
  });

  const toggle = (epic: number): void => {
    open = open === epic ? null : epic;
  };
</script>

<section class="voyage" aria-busy={snapshot === null && !failed}>
  {#if snapshot === null}
    {#if failed}
      <p role="alert" lang={copyLang}>{copy.failed}</p>
    {:else}
      <p lang={copyLang}>{copy.loading}</p>
    {/if}
  {:else}
    {#if live === 'live'}
      <p class="live-state" lang={copyLang}>{copy.live}</p>
    {:else if live === 'closed'}
      <p class="live-state" lang={copyLang}>{copy.notLive}</p>
    {/if}
    {@const map = voyage(snapshot.items)}
    <RoadmapSummary
      {map}
      items={snapshot.items}
      progress={snapshot.progress}
      readAt={snapshot.readAt}
      copy={copy.summary}
      {copyLang}
    />
    <ol class="islands" aria-label={copy.islandsLabel} lang={copyLang}>
      {#each map.islands as item (item.epic)}
        <Island
          {item}
          ship={map.shipAt === item.epic}
          open={open === item.epic}
          onToggle={toggle}
          {copy}
          {copyLang}
        />
      {/each}
    </ol>
    {#if map.beyond.length > 0}
      <h2 lang={copyLang}>{copy.beyond}</h2>
      <ol class="islands beyond" aria-label={copy.beyond} lang={copyLang}>
        {#each map.beyond as item (item.epic)}
          <Island
            {item}
            ship={false}
            open={open === item.epic}
            onToggle={toggle}
            {copy}
            {copyLang}
          />
        {/each}
      </ol>
    {/if}
    {#if map.other.ticketsLeft > 0}
      <p class="other" lang={copyLang}>
        {fill(copy.other, {
          n: map.other.ticketsLeft,
          points: map.other.pointsLeft,
        })}
      </p>
    {/if}
  {/if}
</section>

<style>
  .voyage {
    max-width: 48rem;
    margin: 0 auto;
  }
  .islands {
    list-style: none;
    margin: 0;
    padding: 0 0 0 1.25rem;
    border-left: 3px dashed currentColor;
  }
  /* The islands' look lives here, in one stylesheet (#827). */
  .voyage :global(.island) {
    margin: 0 0 1rem;
  }
  .voyage :global(.island-button) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    align-items: baseline;
    width: 100%;
    min-height: 44px;
    padding: 0.75rem 1rem;
    text-align: left;
    font: inherit;
    border: 2px solid currentColor;
    border-radius: 1.5rem;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .voyage :global(.island-button:focus-visible) {
    outline: 3px solid currentColor;
    outline-offset: 3px;
  }
  .voyage :global(.island[data-status='done'] .island-button) {
    border-style: solid;
  }
  .voyage :global(.island[data-status='not started'] .island-button) {
    border-style: dotted;
  }
  .voyage :global(.island-name) {
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .voyage :global(.island-status),
  .voyage :global(.points) {
    font-size: 0.875rem;
  }
  .voyage :global(.panel) {
    padding: 0.5rem 1rem 0;
    overflow-wrap: anywhere;
  }
  .voyage :global(.panel h3) {
    font-size: 1rem;
    margin: 0.75rem 0 0.25rem;
  }
  .voyage :global(.panel ul) {
    margin: 0;
    padding-left: 1.25rem;
  }
  /* The summary's look (#828), here for the same reason. */
  .voyage :global(.roadmap-summary) {
    margin: 0 0 2rem;
    overflow-wrap: anywhere;
  }
  .voyage :global(.roadmap-summary progress) {
    width: 100%;
    height: 1rem;
  }
  .voyage :global(.whats-left) {
    width: 100%;
    border-collapse: collapse;
  }
  .voyage :global(.whats-left th),
  .voyage :global(.whats-left td) {
    padding: 0.25rem 0.5rem;
    text-align: left;
  }
  .voyage :global(.whats-left td) {
    text-align: right;
  }
  .voyage :global(.whats-left tfoot) {
    font-weight: 700;
    border-top: 2px solid currentColor;
  }
  .voyage :global(.measured),
  .voyage :global(.assumed),
  .voyage :global(.updated),
  .voyage :global(.roadmap-summary time) {
    font-size: 0.875rem;
  }
</style>
