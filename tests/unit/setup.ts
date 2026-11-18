import './setup-refusals.ts';

/**
 * The unit step's setup (#477): every refusal in setup-refusals.ts. Each
 * test is held to the runner's 1 s timeout (vitest.config.ts); the per-test
 * CPU check was dropped (#795).
 */
