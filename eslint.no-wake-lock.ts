import type { Linter } from 'eslint';

/** Stub (#128 AC4): the bans are written once their test has been seen red. */
export const NO_WAKE_LOCK_SYNTAX: { selector: string; message: string }[] = [];

export const noWakeLockBlock: Linter.Config = {
  files: ['packages/platform/**/*.{ts,js,mjs,svelte,astro}'],
  rules: {},
};
