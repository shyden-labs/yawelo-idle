<script lang="ts">
  /**
   * The voyage map (#827, #342 split): the roadmap snapshot drawn as islands,
   * one per epic, each opening what's built and what's left. Read once from
   * /api/roadmap.json on load; live updates are #829. Only plain words are
   * rendered: an epic's name and Public summary, a story's Public title.
   */
  import type { BoardItem } from '@yawelo-idle/progress';
  import type { VoyageCopy } from '../copy';
  import Island from './Island.svelte';
  import { fill, voyage, type Voyage } from './voyage';

  interface Props {
    copy: VoyageCopy;
    /** The language `copy` is written in, for the `lang` of what it labels. */
    copyLang: string;
  }
  const { copy, copyLang }: Props = $props();

  let map = $state<Voyage | null>(null);
  let failed = $state(false);
  let open = $state<number | null>(null);

  $effect(() => {
    fetch('/api/roadmap.json', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const snapshot = (await response.json()) as { items: BoardItem[] };
        map = voyage(snapshot.items);
      })
      .catch(() => {
        failed = true;
      });
  });

  const toggle = (epic: number): void => {
    open = open === epic ? null : epic;
  };
</script>

<section class="voyage" aria-busy={map === null && !failed}>
  {#if failed}
    <p role="alert" lang={copyLang}>{copy.failed}</p>
  {:else if map === null}
    <p lang={copyLang}>{copy.loading}</p>
  {:else}
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
</style>
