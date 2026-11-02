<script lang="ts">
  /**
   * The roadmap's summary (#828): both estimates, what's left by island,
   * what shipped recently, what waits on decisions, and how old the snapshot
   * is. Every figure comes from summary.ts; only plain words are rendered.
   */
  import type { BoardItem, Progress } from '@yawelo-idle/progress';
  import type { SummaryCopy } from '../copy';
  import {
    estimates,
    recentlyShipped,
    secondsAgo,
    waitingOnDecisions,
    whatsLeft,
  } from './summary';
  import { fill, issueUrl, type Voyage } from './voyage';

  interface Props {
    map: Voyage;
    items: BoardItem[];
    progress: Progress;
    /** When the Worker read the board, as an ISO time. */
    readAt: string;
    copy: SummaryCopy;
    copyLang: string;
  }
  const { map, items, progress, readAt, copy, copyLang }: Props = $props();

  // The snapshot's own day, so the page dates the ETA as the board did.
  const both = $derived(estimates(progress, readAt.slice(0, 10)));
  const effort = $derived(both.effort);
  // Narrowed here: the template's {:else} does not narrow for the linter.
  const unsized = $derived(
    effort.available
      ? null
      : fill(copy.effortUnavailable, {
          scored: effort.scored,
          open: effort.open,
        }),
  );
  const left = $derived(whatsLeft(map));
  const shipped = $derived(recentlyShipped(items));
  const waiting = $derived(waitingOnDecisions(items));

  let now = $state(Date.now());
  $effect(() => {
    const tick = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => {
      clearInterval(tick);
    };
  });

  const eta = (date: string | null, sure: keyof SummaryCopy['confidence']) =>
    date === null
      ? copy.noEta
      : fill(copy.eta, { date, confidence: copy.confidence[sure] });
</script>

<section
  class="roadmap-summary"
  aria-labelledby="summary-heading"
  lang={copyLang}
>
  <h2 id="summary-heading">{copy.heading}</h2>
  <p class="updated">{fill(copy.updated, { n: secondsAgo(readAt, now) })}</p>

  <div class="estimate tickets">
    <p>
      {fill(copy.byTickets, {
        percent: both.tickets.percent,
        closed: both.tickets.closed,
        total: both.tickets.total,
      })}
    </p>
    <progress max="100" value={both.tickets.percent}
      >{both.tickets.percent}%</progress
    >
    <p class="eta">{eta(both.tickets.eta, both.tickets.confidence)}</p>
  </div>

  <div class="estimate effort">
    {#if effort.available}
      <p>{fill(copy.byEffort, { points: effort.pointsLeft })}</p>
      <p class="eta">{eta(effort.eta, effort.confidence)}</p>
      {#if effort.assumedClosed > 0}
        <p class="assumed">
          {fill(copy.assumedClosed, {
            n: effort.assumedClosed,
            mean: effort.scoredMean.toFixed(1),
          })}
        </p>
      {/if}
    {:else}
      <p>{unsized}</p>
    {/if}
  </div>
  <p class="measured">{copy.measured}</p>

  <h3>{copy.left}</h3>
  <table class="whats-left">
    <thead>
      <tr>
        <th scope="col">{copy.island}</th>
        <th scope="col">{copy.stories}</th>
        <th scope="col">{copy.points}</th>
      </tr>
    </thead>
    <tbody>
      {#each left.rows as row (row.epic)}
        <tr>
          <th scope="row">{row.name}</th>
          <td>{row.tickets}</td>
          <td>{row.points}</td>
        </tr>
      {/each}
      <tr class="other-work">
        <th scope="row">{copy.other}</th>
        <td>{left.other.tickets}</td>
        <td>{left.other.points}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <th scope="row">{copy.total}</th>
        <td>{left.total.tickets}</td>
        <td>{left.total.points}</td>
      </tr>
    </tfoot>
  </table>

  <h3>{copy.shipped}</h3>
  {#if shipped.length === 0}
    <p>{copy.nothingShipped}</p>
  {:else}
    <ul class="shipped">
      {#each shipped as story (story.number)}
        <li>
          <a href={issueUrl(story.number)}>{story.title}</a>
          <time datetime={story.closedAt}>{story.closedAt}</time>
        </li>
      {/each}
    </ul>
  {/if}

  <h3>{copy.waiting}</h3>
  {#if waiting.named.length === 0 && waiting.unnamed === 0}
    <p>{copy.nothingWaiting}</p>
  {:else}
    <ul class="waiting">
      {#each waiting.named as issue (issue.number)}
        <li><a href={issueUrl(issue.number)}>{issue.title}</a></li>
      {/each}
      {#if waiting.unnamed > 0}
        <li class="unnamed">
          {fill(copy.waitingUnnamed, { n: waiting.unnamed })}
        </li>
      {/if}
    </ul>
  {/if}
</section>

<style>
  .roadmap-summary {
    margin: 0 0 2rem;
    overflow-wrap: anywhere;
  }
  progress {
    width: 100%;
    height: 1rem;
  }
  .whats-left {
    width: 100%;
    border-collapse: collapse;
  }
  .whats-left th,
  .whats-left td {
    padding: 0.25rem 0.5rem;
    text-align: left;
  }
  .whats-left td {
    text-align: right;
  }
  .whats-left tfoot {
    font-weight: 700;
    border-top: 2px solid currentColor;
  }
  .measured,
  .assumed,
  .updated,
  time {
    font-size: 0.875rem;
  }
</style>
