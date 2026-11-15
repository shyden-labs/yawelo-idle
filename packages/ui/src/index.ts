/**
 * The game's UI (spec §6.1, §6.3): Svelte 5 components and screens.
 *
 * The game store (#128) is its own entry, `@yawelo-idle/ui/game-store`: it
 * brings the core and break_infinity, so re-exported here it would join the
 * first paint of every page that imports the shell, used or not (#123 AC4).
 */
export { default as Shell } from './Shell.svelte';
