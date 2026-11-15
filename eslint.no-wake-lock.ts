import type { Linter } from 'eslint';

/**
 * Nothing keeps the device awake (spec §6.3, DN22, #128 AC4): every way to
 * reach `navigator.wakeLock` is refused everywhere, packages/platform
 * included. A later block's `no-restricted-syntax` replaces an earlier one's,
 * so these selectors travel inside platform-only's and core's lists, and this
 * block carries them for packages/platform, which platform-only skips.
 */
const MESSAGE =
  'wakeLock: the game never keeps the device awake (spec §6.3, DN22, #128)';

export const NO_WAKE_LOCK_SYNTAX = [
  {
    selector: 'MemberExpression[computed=false][property.name="wakeLock"]',
    message: MESSAGE,
  },
  {
    selector: 'MemberExpression[computed=true][property.value="wakeLock"]',
    message: MESSAGE,
  },
  {
    selector: 'ObjectPattern > Property[key.name="wakeLock"]',
    message: MESSAGE,
  },
];

export const noWakeLockBlock: Linter.Config = {
  files: ['packages/platform/**/*.{ts,js,mjs,svelte,astro}'],
  rules: { 'no-restricted-syntax': ['error', ...NO_WAKE_LOCK_SYNTAX] },
};
