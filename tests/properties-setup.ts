import fc from 'fast-check';
import { chooseSeed, rememberSeed, SEED_ENV } from './properties-seed';

/**
 * Runs before each properties file (vitest.properties.config.ts): a fresh
 * seed per file per run, or the one a person replays, given to every
 * property in the file and remembered for the minimum checker (#84, spec
 * §5.11). The only place the properties suite sets a seed.
 */
const seed = chooseSeed(process.env[SEED_ENV]);
rememberSeed(seed);
fc.configureGlobal({ seed });
