/**
 * The content build (#106): one course pack, gated, into the bundle the web
 * game loads and its `contentVersion`.
 */
import { canonicalHash } from '@yawelo-idle/core';
import {
  licenceChecks,
  shipErrors,
  structureChecks,
  type CoursePack,
  type LoadError,
} from './index.ts';

/** The gate that refused an item: what may ship, its structure, its licence. */
export type BuildGate = 'ship' | 'structure' | 'licence';

/** One reason the build refused the pack. */
export interface BuildRefusal {
  readonly gate: BuildGate;
  readonly error: LoadError;
}

export type BuildResult =
  | {
      readonly ok: true;
      /** The course as JSON, the bytes the web game loads. */
      readonly bundle: string;
      /** SHA-256 of the course's canonical form, 64 lowercase hex digits. */
      readonly contentVersion: string;
    }
  | { readonly ok: false; readonly refusals: readonly BuildRefusal[] };

/** Every refusal of the three gates, in gate order. */
function refusalsOf(course: CoursePack): BuildRefusal[] {
  const at =
    (gate: BuildGate) =>
    (error: LoadError): BuildRefusal => ({ gate, error });
  return [
    ...shipErrors(course).map(at('ship')),
    ...structureChecks(course)
      .flatMap((check) => check.errors)
      .map(at('structure')),
    ...licenceChecks(course)
      .flatMap((check) => check.errors)
      .map(at('licence')),
  ];
}

/**
 * The course's bundle and version, or every reason it may not ship (#106).
 * The version hashes the canonical form, so it does not depend on the key
 * order of the JSON it was read from.
 */
export function buildCourse(course: CoursePack): BuildResult {
  const refusals = refusalsOf(course);
  if (refusals.length > 0) return { ok: false, refusals };
  return {
    ok: true,
    bundle: JSON.stringify(course),
    contentVersion: canonicalHash(course),
  };
}
