import type { Linter } from 'eslint';

/**
 * Only packages/platform reaches the host's storage, notifications and
 * vibration (spec §6.4, #124 AC3): every other file goes through the
 * Platform interface, so each shell (web, Electron, Capacitor) swaps one
 * implementation and nothing else.
 *
 * ESLint judges the parse tree, so a comment or a string naming these is
 * never reported. A flat config replaces a rule's options per file, so core's
 * block (eslint.core-determinism.ts) spreads these same entries into its own.
 */
const MESSAGE = 'reach the host through @yawelo-idle/platform (#124)';
const NAMES = ['indexedDB', 'Notification'];
const NAME_PATTERN = '/^(indexedDB|Notification|vibrate)$/';

export const PLATFORM_ONLY_GLOBALS = NAMES.map((name) => ({
  name,
  message: `${name}: ${MESSAGE}`,
}));

export const PLATFORM_ONLY_SYNTAX = [
  {
    // window.indexedDB, globalThis.Notification, navigator.vibrate, ...
    selector: `MemberExpression[computed=false][property.name=${NAME_PATTERN}]`,
    message: `a host member: ${MESSAGE}`,
  },
  {
    // window['indexedDB'], navigator['vibrate'], ...
    selector: `MemberExpression[computed=true][property.value=${NAME_PATTERN}]`,
    message: `a host member: ${MESSAGE}`,
  },
  {
    // const { indexedDB } = window; const { vibrate } = navigator
    selector: `ObjectPattern > Property[key.name=${NAME_PATTERN}]`,
    message: `a host member: ${MESSAGE}`,
  },
];

export const platformOnly: Linter.RulesRecord = {
  'no-restricted-globals': ['error', ...PLATFORM_ONLY_GLOBALS],
  'no-restricted-syntax': ['error', ...PLATFORM_ONLY_SYNTAX],
};

/** Every source file but packages/platform's own. */
export const platformOnlyBlock: Linter.Config = {
  files: ['**/*.{ts,js,mjs,svelte,astro}'],
  ignores: ['packages/platform/**'],
  rules: platformOnly,
};
