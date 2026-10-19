/**
 * Every scope proving a clean sample's empty reply by a bad twin
 * (`againstTwin`), by `file › test title as written` (or the named
 * function), with how many (#374). A twin proves the run was working, not
 * that it read the whole sample, so Shyden chose (2026-10-19, "Visible
 * list") that each use is listed here, and a new one shows in the change
 * that adds it. Checked for equality both ways by the guards suite's
 * `floorless-searches.test.ts`.
 */
export const TWINS: Readonly<Record<string, number>> = {
  'tests/unit/core-determinism-lint.test.ts › is scoped to packages/core/src: the same code elsewhere is not banned': 2,
  'tests/unit/core-determinism-lint.test.ts › label': 1,
  'tests/unit/core-determinism-lint.test.ts › lint': 1,
  'tests/unit/record-floors-callers.test.ts › reads %s as no caller': 1,
  'tests/unit/scheduled-workflows.test.ts › judges no job of a workflow with no schedule, even one naming production': 1,
  'tests/unit/searched.test.ts › awaits a run that answers later, as a linter does': 1,
  'tests/unit/searched.test.ts › leaves a run that ignores its sample to fail the absence assertion': 1,
  'tests/unit/searched.test.ts › returns what the run finds in the clean sample': 1,
  'tests/unit/searched.test.ts › runs the twin first, then the sample, and returns the sample’s result': 1,
};
