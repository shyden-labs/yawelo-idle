import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The record's rehearse job and the gate it carries (#771). Predicted
 * before the first run. Each row puts back one way it could go wrong: the
 * gate after the checkout of the commit it judges, a job that skips the
 * gate, a checkout that keeps its credential, a rehearse job given the run's
 * token, an upload that tolerates nothing; and in the scripts, an asset
 * whose hash is not checked, the floor ignored, a credential left
 * unrefused, ls-remote's first answer taken, a failed suite measured, and a
 * rehearsal of another commit accepted; and a mutation file counted as code
 * again (Shyden, 2026-10-28: "Count them as not code").
 */

const WORKFLOW = 'tests/unit/record-floors-workflow.test.ts';
const F = `${WORKFLOW} › the record-floors workflow (#547, #718) >`;
const GATE = 'tests/unit/record-gate.test.ts';
const REHEARSE = 'tests/unit/rehearse.test.ts';
const STEP = `${REHEARSE} › the rehearse step (#771) >`;
const FLOOR = `${REHEARSE} › the floor of workflow files (#771) >`;
const REHEARSAL = 'tests/unit/rehearsal.test.ts';
const MEASURED = `${REHEARSAL} › the rehearsal the record measures with (#771 AC4) >`;
const CLI = 'tests/unit/coverage-cli.test.ts';
const SUITE = `${CLI} › a suite that did not run measures nothing (#728, #771) >`;
const FILE = '.github/workflows/record-floors.yml';
const KINDS = 'tests/unit/coverage-kinds.test.ts';
const KIND = `${KINDS} › every tracked file has one kind (#728) >`;

// The workflow's inline start lines (Shyden, 2026-10-28: "Start line in the workflow").
const GATE_RUN =
  'node --input-type=module -e "const { gate, nodeIo } = await import(\'./scripts/record-gate.ts\'); process.exitCode = gate(nodeIo);"';
const REHEARSE_RUN =
  'node --input-type=module -e "const { rehearse, nodeRehearseIo } = await import(\'./scripts/rehearse.ts\'); process.exitCode = await rehearse(nodeRehearseIo);"';
const GATE_STEP = `      - name: Refuse anything but the tip of a ticket branch's scratch ref\n        run: ${GATE_RUN}\n`;
const SHA_CHECKOUT =
  '      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n        with:\n          ref: ${{ inputs.sha }}\n          persist-credentials: false\n';

export default mutationFile({
  targets: [WORKFLOW, GATE, REHEARSE, REHEARSAL, CLI, KINDS],
  mutations: [
    {
      name: 'gate-after-the-checkout',
      file: FILE,
      anchor: GATE_STEP + SHA_CHECKOUT,
      replacement: SHA_CHECKOUT + GATE_STEP,
      red: {
        [`${F} gates the commit first, from the workflow’s own checkout, through the tested gate (#771)`]:
          'to deeply equal',
        [`${F} refuses, before the checkout, a SHA that is not the scratch ref’s tip`]:
          'to be less than',
      },
    },
    {
      name: 'floors-skip-the-gate',
      file: FILE,
      anchor:
        '    # The gate passed this commit first (rehearse, above).\n    needs: rehearse\n',
      replacement: '',
      red: {
        [`${F} holds the floors job, then a coverage job that waits for it, unconditionally (#748)`]:
          'to deeply equal',
        [`${F} refuses, before the checkout, a SHA that is not the scratch ref’s tip`]:
          'to deeply equal',
      },
    },
    {
      name: 'rehearsal-keeps-the-credential',
      file: FILE,
      anchor: '          persist-credentials: false\n',
      replacement: '          persist-credentials: true\n',
      red: {
        [`${F} checks out exactly the SHA it was given, in each job`]:
          'to deeply equal',
      },
    },
    {
      name: 'rehearsal-given-the-token',
      file: FILE,
      anchor: `        run: ${REHEARSE_RUN}\n`,
      replacement: `        env:\n          GH_TOKEN: \${{ github.token }}\n        run: ${REHEARSE_RUN}\n`,
      red: {
        [`${F} holds no credential in the rehearse job (#771 AC6)`]:
          'to deeply equal',
        [`${F} sees a rehearse job given an environment`]: 'to deeply equal',
        [`${F} sees a rehearse job given its own permissions`]:
          'to deeply equal',
        [`${F} sees a rehearse job given its own env`]: 'to deeply equal',
        [`${F} sees a rehearse job given a reusable workflow with inherited secrets`]:
          'to deeply equal',
        [`${F} rehearses on the runner host, uploading the manifest named by the commit, failing when it is missing (#771)`]:
          'to deeply equal',
      },
    },
    {
      name: 'upload-tolerates-nothing',
      file: FILE,
      anchor:
        '          path: rehearsal/\n          if-no-files-found: error\n',
      replacement: '          path: rehearsal/\n',
      red: {
        [`${F} rehearses on the runner host, uploading the manifest named by the commit, failing when it is missing (#771)`]:
          'to deeply equal',
      },
    },
    {
      name: 'hash-not-checked',
      file: 'scripts/rehearse.ts',
      anchor: '  if (hash !== act.sha256)\n',
      replacement: '  if (hash === "never")\n',
      red: {
        [`${STEP} refuses an asset that is not the pinned one, before unpacking it`]:
          'to deeply equal',
        [`${STEP} judges the real asset against ACT when given no pin`]:
          'to deeply equal',
      },
    },
    {
      name: 'floor-ignored',
      file: 'scripts/rehearse.ts',
      anchor: '  of < WORKFLOW_FLOOR\n',
      replacement: '  of < 0\n',
      red: {
        [`${FLOOR} refuses 0 files`]: 'to be',
        [`${FLOOR} refuses 10 files`]: 'to be',
        [`${STEP} refuses an empty folder through the floor`]:
          'to deeply equal',
        [`${MEASURED} refuses a population below the floor`]: 'to be',
      },
    },
    {
      name: 'credential-left-unrefused',
      file: 'scripts/rehearse.ts',
      anchor: '  if (credential !== undefined) return credential;\n',
      replacement: '',
      red: {
        [`${STEP} refuses a credential left by the checkout, writing no manifest`]:
          'to deeply equal',
      },
    },
    {
      name: 'first-ref-taken',
      file: 'scripts/record-gate.ts',
      anchor: '  if (listed.length !== 1 || name !== ref)\n',
      replacement: '  if (name !== ref)\n',
      red: {
        [`${GATE} › the SHA is the scratch ref’s tip, read from the repository (#718) > refuses the ref beside one it only ends`]:
          'to be',
      },
    },
    {
      name: 'failed-suite-measured',
      file: 'scripts/coverage.ts',
      anchor: '  if (run.status !== 0)\n    return `the ${name} suite failed',
      replacement:
        '  if (run.status === 99)\n    return `the ${name} suite failed',
      red: {
        [`${SUITE} stops on one that failed`]: 'to be',
        [`${SUITE} stops on one stopped by a signal`]: 'to be',
      },
    },
    {
      name: 'rehearsal-of-another-commit-accepted',
      file: 'scripts/rehearsal.ts',
      anchor: '  if (manifest.commit !== head)\n',
      replacement: '  if (manifest.commit === "never")\n',
      red: {
        [`${MEASURED} refuses a manifest of another commit`]: 'to be',
      },
    },
    {
      name: 'mutation-files-counted-as-code',
      file: 'scripts/coverage-kinds.ts',
      anchor: "  if (isMutationFile(path)) return 'not-code';\n",
      replacement: '',
      red: {
        [`${KIND} tests/mutations/771-record-rehearse.ts is not-code`]: 'to be',
        [`${KIND} tests/mutations/718-scratch-ref.ts is not-code`]: 'to be',
      },
    },
  ],
});
