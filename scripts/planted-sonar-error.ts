/**
 * A planted SonarCloud failure (#655 DoD: "one planted ERROR watched red").
 * Untested, and a pseudorandom generator (security hotspot S2245), so the
 * quality gate on new code returns ERROR. This branch is never merged.
 */
export function roll(): number {
  return Math.floor(Math.random() * 6) + 1;
}
