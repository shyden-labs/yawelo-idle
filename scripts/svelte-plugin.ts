import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Svelte for the unit suite (#798, #802, #806): it renders components, in
 * Node or jsdom, and under coverage compiles a component no test loads, so
 * that one still counts as untested. Its own preprocess, as
 * packages/ui/svelte.config.js has, so the script's TypeScript compiles.
 */
export const SVELTE_PLUGINS = svelte({
  configFile: false,
  preprocess: vitePreprocess(),
});
