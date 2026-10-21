import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The coverage check and the documents-only proof (#728), in the unit suite.
 * Predicted before the first run. Each row breaks one part of the verdict in
 * the code (what counts as a difference, check (a), check (b), the one
 * pull request allowed no base record, the proof's two conditions and its
 * empty case) or the job that runs it, and names every unit test that goes
 * red.
 */

const CHECK = 'tests/unit/coverage-check.test.ts';
const A = `${CHECK} › the measured table equals the record (#728) >`;
const B = `${CHECK} › the coverage check (#728) >`;
const D = `${CHECK} › a documents-only pull request proves nothing measured changed (#728) >`;
const JOB = 'tests/unit/coverage-ci.test.ts';
const J = `${JOB} › the coverage job judges every pull request (#728) >`;

export default mutationFile({
  targets: [CHECK, JOB],
  mutations: [
    {
      name: 'totals-ignored',
      file: 'scripts/coverage-table.ts',
      anchor: '  a.statements.total === b.statements.total &&\n',
      replacement: '',
      red: {
        [`${A} a total that moved is a difference too`]: 'to deeply equal',
      },
    },
    {
      name: 'recorded-file-left-unnamed',
      file: 'scripts/coverage-table.ts',
      anchor: '    else if (now === undefined)\n',
      replacement:
        '    else if (now === undefined) continue;\n    else if (false)\n',
      red: {
        [`${A} a recorded file nothing measured is named`]: 'to deeply equal',
      },
    },
    {
      name: 'measure-change-ignored',
      file: 'scripts/coverage-table.ts',
      anchor: '    else if (now.measure !== then.measure)\n',
      replacement: '    else if (false)\n',
      red: {
        [`${A} a file whose measure changed is a difference`]:
          'to deeply equal',
      },
    },
    {
      name: 'check-a-dropped',
      file: 'scripts/coverage.ts',
      anchor: '  return [...unrecorded(measured, recorded), ...ratchet];\n',
      replacement: '  return [...ratchet];\n',
      red: {
        [`${B} names a rise against the base and an unrecorded gain in the same run`]:
          'to deeply equal',
      },
    },
    {
      name: 'check-b-dropped',
      file: 'scripts/coverage.ts',
      anchor: '      ? rises(base, recorded, renamed)\n',
      replacement: '      ? []\n',
      red: {
        [`${B} names a rise against the base and an unrecorded gain in the same run`]:
          'to deeply equal',
        [`${B} judges a renamed file against its old path at the base`]:
          'to deeply equal',
      },
    },
    {
      name: 'no-base-record-always-allowed',
      file: 'scripts/coverage.ts',
      anchor: '      : addsRecord\n',
      replacement: '      : true\n',
      red: {
        [`${B} lets the pull request that adds the record judge it against nothing, where any other is refused`]:
          'to deeply equal',
      },
    },
    {
      name: 'code-read-as-a-document',
      file: 'scripts/coverage.ts',
      anchor: '    ...(onAllowlist(path)\n',
      replacement: '    ...(true\n',
      red: {
        [`${D} refuses a changed file that is not a document`]:
          'to deeply equal',
      },
    },
    {
      name: 'record-ignored-by-the-proof',
      file: 'scripts/coverage.ts',
      anchor: '    ...(recorded.has(path) ?',
      replacement: '    ...(false ?',
      red: {
        [`${D} passes documents the record does not hold, beside one it does`]:
          'to deeply equal',
        [`${D} refuses a changed file that is not a document`]:
          'to deeply equal',
      },
    },
    {
      name: 'empty-change-proved',
      file: 'scripts/coverage.ts',
      anchor: '  if (changed.length === 0)\n',
      replacement: '  if (false)\n',
      red: {
        [`${D} refuses a pull request that changed nothing it can read`]:
          'to deeply equal',
      },
    },
    {
      name: 'shallow-checkout',
      file: '.github/workflows/ci.yml',
      anchor: '          fetch-depth: 0\n',
      replacement: '          fetch-depth: 2\n',
      red: {
        [`${J} checks out the whole history, so the merge base with develop is there`]:
          'to deeply equal',
      },
    },
    {
      name: 'check-step-unconditional',
      file: '.github/workflows/ci.yml',
      anchor:
        "      - name: Check the record and the ratchet\n        if: ${{ steps.classify.outputs.scope != 'docs-only' }}\n",
      replacement: '      - name: Check the record and the ratchet\n',
      red: {
        [`${J} measures and checks anything but a documents-only change`]:
          'to deeply equal',
      },
    },
    {
      name: 'proof-on-every-change',
      file: '.github/workflows/ci.yml',
      anchor:
        "        if: ${{ steps.classify.outputs.scope == 'docs-only' }}\n",
      replacement: '',
      red: {
        [`${J} proves a documents-only change measures nothing, and only then`]:
          'to deeply equal',
      },
    },
  ],
});
