import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * Floors and minimums are measured on a scratch ref and folded into the
 * unpushed commit (#718). Predicted before the first run. Each row puts back
 * one way the flow could go wrong: the label trigger returned, a write
 * permission, a held token, a push after recording, the run left unnamed,
 * another commit checked out, the scratch ref's tip not compared, the
 * artifact named by develop's commit; and in the fetch, a run of another
 * branch or commit accepted, a pushed HEAD accepted, the scratch ref named
 * as a branch.
 */

const FLOORS = 'tests/unit/record-floors-workflow.test.ts';
const F = `${FLOORS} › the record-floors workflow (#547, #718) >`;
const MINIMUMS = 'tests/unit/record-minimums-workflow.test.ts';
const M = `${MINIMUMS} › the record-minimums workflow (#84, #718) >`;
const RECORDER = 'tests/unit/record-floors.test.ts';
const FETCH = 'tests/unit/fetch-floors.test.ts';
const REFUSAL = `${FETCH} › fetchRefusal >`;
const SCRATCH = `${FETCH} › the scratch ref >`;

export default mutationFile({
  targets: [FLOORS, MINIMUMS, RECORDER, FETCH],
  mutations: [
    {
      name: 'label-trigger-returned',
      file: '.github/workflows/record-floors.yml',
      anchor: 'on:\n  workflow_dispatch:\n',
      replacement:
        'on:\n  pull_request:\n    types: [labeled]\n  workflow_dispatch:\n',
      red: {
        [`${F} runs only when dispatched, with the branch and the SHA to measure`]:
          'to deeply equal',
      },
    },
    {
      name: 'write-permission',
      file: '.github/workflows/record-floors.yml',
      anchor: 'permissions:\n  contents: read\n',
      replacement: 'permissions:\n  contents: write\n',
      red: {
        [`${F} reads the repository and writes nothing`]: 'to deeply equal',
      },
    },
    {
      name: 'token-held',
      file: '.github/workflows/record-floors.yml',
      anchor: '        run: scripts/fail-on-warnings.sh npm ci\n',
      replacement:
        '        env:\n          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n        run: scripts/fail-on-warnings.sh npm ci\n',
      red: {
        [`${F} pushes nothing: no step runs git push or holds a token`]:
          'to deeply equal',
      },
    },
    {
      name: 'push-after-recording',
      file: '.github/workflows/record-floors.yml',
      anchor: '        run: npm run floors:record\n',
      replacement:
        '        run: npm run floors:record && git push origin HEAD\n',
      red: {
        // The liveness check, first in that test, no longer finds the
        // recorder's command as written.
        [`${F} pushes nothing: no step runs git push or holds a token`]:
          'to include',
        [`${F} records every suite with the switch set to the workflow’s name`]:
          'to be',
        [`${RECORDER} › the recorder over this repository > runs from no CI workflow step but the record-floors workflow’s (#547)`]:
          'to deep equally contain',
      },
    },
    {
      name: 'run-left-unnamed',
      file: '.github/workflows/record-floors.yml',
      anchor:
        'run-name: record-floors ${{ inputs.branch }} at ${{ inputs.sha }}\n',
      replacement: '',
      red: {
        [`${F} names each run by the branch and SHA it measured, for floors:fetch to read`]:
          'to be',
      },
    },
    {
      name: 'checkout-develop',
      file: '.github/workflows/record-floors.yml',
      anchor: '          ref: ${{ inputs.sha }}\n',
      replacement: '          ref: ${{ github.sha }}\n',
      red: {
        [`${F} checks out exactly the SHA it was given`]: 'to be',
      },
    },
    {
      name: 'tip-not-compared',
      file: '.github/workflows/record-floors.yml',
      anchor: '          if ! [ "$tip" = "$SHA" ]; then\n',
      replacement: '          if false; then\n',
      red: {
        [`${F} refuses, before the checkout, a SHA that is not the scratch ref’s tip`]:
          'to be greater than',
      },
    },
    {
      name: 'artifact-named-by-develop',
      file: '.github/workflows/record-floors.yml',
      anchor: '          name: floors-${{ inputs.sha }}\n',
      replacement: '          name: floors-${{ github.sha }}\n',
      red: {
        [`${F} uploads the floors directory named by the commit, after recording`]:
          'to deeply equal',
      },
    },
    {
      name: 'minimums-label-trigger-returned',
      file: '.github/workflows/record-minimums.yml',
      anchor: 'on:\n  workflow_dispatch:\n',
      replacement:
        'on:\n  pull_request:\n    types: [labeled]\n  workflow_dispatch:\n',
      red: {
        [`${M} runs only when dispatched, with the branch and the SHA to sample`]:
          'to deeply equal',
      },
    },
    {
      name: 'minimums-write-permission',
      file: '.github/workflows/record-minimums.yml',
      anchor: 'permissions:\n  contents: read\n',
      replacement: 'permissions:\n  contents: write\n',
      red: {
        [`${M} reads the repository and writes nothing`]: 'to deeply equal',
      },
    },
    {
      name: 'minimums-tip-not-compared',
      file: '.github/workflows/record-minimums.yml',
      anchor: '          if ! [ "$tip" = "$SHA" ]; then\n',
      replacement: '          if false; then\n',
      red: {
        [`${M} refuses, before the checkout, a SHA that is not the scratch ref’s tip`]:
          'to be greater than',
      },
    },
    {
      name: 'minimums-artifact-named-by-develop',
      file: '.github/workflows/record-minimums.yml',
      anchor:
        '          name: minimums-${{ inputs.sha }}-${{ matrix.shard }}\n',
      replacement:
        '          name: minimums-${{ github.sha }}-${{ matrix.shard }}\n',
      red: {
        [`${M} uploads each shard’s runs named by the commit and the shard, after sampling`]:
          'to deeply equal',
      },
    },
    {
      name: 'floors-step-added',
      file: '.github/workflows/record-floors.yml',
      anchor:
        '          path: tests/floors/\n          if-no-files-found: error\n',
      replacement:
        '          path: tests/floors/\n          if-no-files-found: error\n      - name: Planted\n        run: echo planted\n',
      red: {
        [`${F} pushes nothing: no step runs git push or holds a token`]:
          'to be undefined',
        [`${RECORDER} › the recorder over this repository > runs from no CI workflow step but the record-floors workflow’s (#547)`]:
          'to be undefined',
      },
    },
    {
      name: 'minimums-step-added',
      file: '.github/workflows/record-minimums.yml',
      anchor:
        '          path: minimums-runs/\n          if-no-files-found: error\n',
      replacement:
        '          path: minimums-runs/\n          if-no-files-found: error\n      - name: Planted\n        run: echo planted\n',
      red: {
        [`${M} pushes nothing: no step runs git push or holds a token`]:
          'to be undefined',
        [`${RECORDER} › the recorder over this repository > runs from no CI workflow step but the record-floors workflow’s (#547)`]:
          'to be undefined',
      },
    },
    {
      name: 'title-not-compared',
      file: 'scripts/fetch-floors.ts',
      anchor: '  if (run.displayTitle !== wanted)\n',
      replacement: '  if (false)\n',
      red: {
        [`${REFUSAL} refuses a record of another branch`]: 'to be',
        [`${REFUSAL} refuses a record of another commit`]: 'to be',
        [`${REFUSAL} names the minimums workflow’s own scratch ref in its refusals`]:
          'to be',
      },
    },
    {
      name: 'pushed-head-accepted',
      file: 'scripts/fetch-floors.ts',
      anchor: '  if (pushed)\n',
      replacement: '  if (false)\n',
      red: {
        [`${REFUSAL} refuses a HEAD already on the remote: the figures fold into a commit not yet pushed`]:
          'to be',
      },
    },
    {
      name: 'scratch-ref-is-a-branch',
      file: 'scripts/fetch-floors.ts',
      anchor: "  `refs/${workflow.replace(/^record-/, '')}/${branch}`;\n",
      replacement: '  `refs/heads/${branch}`;\n',
      red: {
        [`${SCRATCH} is refs/floors/<branch> for floors and refs/minimums/<branch> for minimums`]:
          'to be',
        [`${SCRATCH} is deleted, once the branch is pushed, by a normal push`]:
          'to be',
        [`${REFUSAL} refuses a record of another branch`]: 'to be',
        [`${REFUSAL} refuses a record of another commit`]: 'to be',
        [`${REFUSAL} names the minimums workflow’s own scratch ref in its refusals`]:
          'to be',
      },
    },
  ],
});
