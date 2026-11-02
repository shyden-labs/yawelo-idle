<script lang="ts">
  /**
   * One island of the voyage map (#827): its button, which opens and closes
   * its panel, and the panel itself. Only plain words: the epic's name and
   * Public summary, each story's Public title.
   */
  import type { VoyageCopy } from '../copy';
  import { fill, issueUrl, STATUS_COPY, type Island } from './voyage';

  interface Props {
    item: Island;
    ship: boolean;
    open: boolean;
    onToggle: (epic: number) => void;
    copy: VoyageCopy;
    copyLang: string;
  }
  const { item, ship, open, onToggle, copy, copyLang }: Props = $props();
</script>

<li class="island" data-status={item.status} data-epic={item.epic}>
  <button
    type="button"
    class="island-button"
    aria-expanded={open}
    aria-controls={`panel-${String(item.epic)}`}
    onclick={() => {
      onToggle(item.epic);
    }}
  >
    <span class="island-name">{item.name}</span>
    <span class="island-status" lang={copyLang}
      >{copy.status[STATUS_COPY[item.status]]}</span
    >
    {#if ship}
      <span class="ship" lang={copyLang}>⛵ {copy.ship}</span>
    {/if}
  </button>
  <div
    id={`panel-${String(item.epic)}`}
    class="panel"
    role="region"
    aria-label={item.name}
    hidden={!open}
  >
    {#if item.summary !== null}
      <p class="summary">{item.summary}</p>
    {/if}
    <h3 lang={copyLang}>{copy.built}</h3>
    {#if item.built.length === 0}
      <p lang={copyLang}>{copy.nothingYet}</p>
    {:else}
      <ul class="built">
        {#each item.built as story (story.number)}
          <li><a href={issueUrl(story.number)}>{story.title}</a></li>
        {/each}
      </ul>
    {/if}
    <h3 lang={copyLang}>{copy.left}</h3>
    {#if item.left.length === 0}
      <p lang={copyLang}>{copy.nothingYet}</p>
    {:else}
      <ul class="left">
        {#each item.left as story (story.number)}
          <li>
            <a href={issueUrl(story.number)}>{story.title}</a>
            {#if story.points !== null}
              <span class="points" lang={copyLang}
                >{fill(copy.points, { n: story.points })}</span
              >
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    {#if item.behindTheScenes > 0}
      <p class="behind" lang={copyLang}>
        {fill(copy.behindTheScenes, { n: item.behindTheScenes })}
      </p>
    {/if}
  </div>
</li>
