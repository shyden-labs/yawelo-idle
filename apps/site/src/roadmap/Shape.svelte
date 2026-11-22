<svelte:options namespace="svg" />

<script lang="ts">
  /**
   * One shape of the voyage map's picture (#1068), drawn with its children:
   * the tree `drawing.ts` builds. SVG namespace, so it can sit inside the
   * <svg> it starts. No stylesheet of its own (one per site island, #828).
   */
  import type { Shape } from './drawing';
  import Self from './Shape.svelte';

  interface Props {
    shape: Shape;
  }
  const { shape }: Props = $props();
</script>

<svelte:element this={shape.tag} {...shape.attrs}
  >{#if shape.text !== undefined}{shape.text}{/if}{#each shape.children as child, i (i)}<Self
      shape={child}
    />{/each}</svelte:element
>
