<script lang="ts">
  // A fixture for the DOM test pattern (#806): a click handler and an
  // {#if}/{:else}, the two things a server render cannot drive.
  let { step }: { step: number } = $props();
  let count = $state(0);
  function add(): void {
    count += step;
  }
</script>

<button onclick={add}>Add</button>
{#if count > 0}
  <p>Count: {count}</p>
{:else}
  <p>Nothing yet</p>
{/if}
