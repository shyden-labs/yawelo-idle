/**
 * Every scope holding an absence search that proves nothing about its
 * population, by `file › test title as written` (or the named function), with
 * how many (#361). Measured when the meta-guard landed. A search is proved by
 * a recorded floor on the population its `of:` names, checked in the same
 * scope, or, for an input left empty on purpose, by againstControl.
 *
 * Checked for equality both ways by `floorless-searches.test.ts`: a new
 * unproved search fails, and so does a converted one until its entry is
 * lowered. It only shrinks.
 */
export const UNPROVED: Readonly<Record<string, number>> = {};
