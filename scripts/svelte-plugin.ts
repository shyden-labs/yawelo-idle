import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Svelte for the Vitest suites (#798, #802): the unit suite renders
 * components, and every suite under coverage compiles them, so a component
 * no test loads still counts as untested. Its own preprocess, as
 * packages/ui/svelte.config.js has, so the script's TypeScript compiles.
 */
export const SVELTE_PLUGINS = svelte({
  configFile: false,
  preprocess: vitePreprocess(),
});
