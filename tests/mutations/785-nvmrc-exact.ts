import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * .nvmrc holds the exact Node version, and every workflow takes it from
 * there (#785), in the unit suite. Predicted before the first run
 * (2026-10-30 UTC). The rows put back the bare major, loosen the exact
 * form, give a setup-node step a version of its own (alone, and beside the
 * file), plant a setup-node line the parse cannot see (a line in a run
 * block, which the text count reads), and, as a control predicted green,
 * the same line as a comment, which neither count reads.
 */

const NODE = 'tests/unit/node-version.test.ts';
const VERSION = `${NODE} › the Node version (#785) >`;
const WORKFLOWS = `${NODE} › every workflow takes its Node from .nvmrc (#785) >`;
const EACH = `${WORKFLOWS} each setup-node step reads node-version-file .nvmrc and names no version`;
const PARSED = `${WORKFLOWS} parses as many setup-node steps in each file as its text writes`;
const REFUSES = (text: string) =>
  `${VERSION} the exact form refuses ${text} (setup-node would resolve it, or read it loosely)`;
const WATCH =
  'tests/unit/schedule-watch-workflow.test.ts › schedule-watch.yml (#710) >';
const SUPPLY =
  'tests/unit/supply-chain.test.ts › the CI supply chain is pinned > ';

const STEP =
  "          node-version-file: '.nvmrc'\n      - name: Every scheduled workflow ran on time and passed\n";
const CHECKOUT =
  'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1';
const SETUP_NODE =
  'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0';

export default mutationFile({
  targets: [
    NODE,
    'tests/unit/schedule-watch-workflow.test.ts',
    'tests/unit/supply-chain.test.ts',
  ],
  mutations: [
    {
      name: 'nvmrc-back-to-the-bare-major',
      file: '.nvmrc',
      anchor: '26.12.1\n',
      replacement: '26\n',
      red: {
        [`${VERSION} .nvmrc holds 26.12.1 exactly, the version every project runs`]:
          'to be',
        // Its major is read with semver, which takes no bare major.
        ['tests/unit/supply-chain.test.ts › Dependabot keeps the pins from rotting > does not offer @types/node majors above the .nvmrc line']:
          'Invalid Version',
      },
    },
    {
      name: 'exact-form-loosened',
      file: NODE,
      anchor: 'const EXACT = /^\\d+\\.\\d+\\.\\d+\\n$/;',
      replacement: 'const EXACT = /^\\d+(\\.\\d+){0,2}\\n$/;',
      red: {
        [REFUSES('"26\\n"')]: 'to be false',
        [REFUSES('"26.12\\n"')]: 'to be false',
      },
    },
    {
      name: 'a-step-with-its-own-version',
      file: '.github/workflows/schedule-watch.yml',
      anchor: STEP,
      replacement: STEP.replace(
        "node-version-file: '.nvmrc'",
        "node-version: '26'",
      ),
      red: { [EACH]: 'to deeply equal' },
    },
    {
      name: 'a-version-beside-the-file',
      file: '.github/workflows/schedule-watch.yml',
      anchor: STEP,
      replacement: STEP.replace(
        "node-version-file: '.nvmrc'\n",
        "node-version-file: '.nvmrc'\n          node-version: '26'\n",
      ),
      red: { [EACH]: 'to deeply equal' },
    },
    {
      // The line sits in a run block: the text count reads it, the parse does
      // not. It also adds a pinned uses line, so supply-chain's two use
      // floors read one more than recorded, and the check's run text moves.
      name: 'a-setup-node-line-the-parse-cannot-see',
      file: '.github/workflows/schedule-watch.yml',
      anchor:
        '        run: node scripts/schedule-watch.ts "$GITHUB_REPOSITORY"\n',
      replacement: `        run: |\n          node scripts/schedule-watch.ts "$GITHUB_REPOSITORY"\n          uses: ${SETUP_NODE}\n`,
      red: {
        [PARSED]: 'schedule-watch.yml: 2 written, 1 parsed',
        [`${WATCH} runs the check with the run token alone`]: 'to deeply equal',
        [`${SUPPLY}every third-party action is pinned to a full commit SHA`]:
          'supply-chain/pinned-uses',
        [`${SUPPLY}every pinned action names the version its SHA resolves to`]:
          'supply-chain/versioned-uses',
        // Added after the first run (hindsight, 2026-10-30): supply-chain's
        // own text-against-parse cross-check (#82) also reads the planted
        // line. The sibling row below tests that explanation, predicted first.
        [`${SUPPLY}the line reader sees every uses: the parsed workflows hold (Refs #82)`]:
          'to deeply equal',
      },
    },
    {
      // Sibling, predicted before its first run: the same plant naming
      // another action. supply-chain's readers and the run text still move;
      // node-version's cross-check, which counts setup-node alone, does not.
      name: 'another-action-line-the-parse-cannot-see',
      file: '.github/workflows/schedule-watch.yml',
      anchor:
        '        run: node scripts/schedule-watch.ts "$GITHUB_REPOSITORY"\n',
      replacement: `        run: |\n          node scripts/schedule-watch.ts "$GITHUB_REPOSITORY"\n          uses: ${CHECKOUT}\n`,
      red: {
        [`${WATCH} runs the check with the run token alone`]: 'to deeply equal',
        [`${SUPPLY}every third-party action is pinned to a full commit SHA`]:
          'supply-chain/pinned-uses',
        [`${SUPPLY}every pinned action names the version its SHA resolves to`]:
          'supply-chain/versioned-uses',
        [`${SUPPLY}the line reader sees every uses: the parsed workflows hold (Refs #82)`]:
          'to deeply equal',
      },
    },
    {
      name: 'control-the-same-line-as-a-comment',
      file: '.github/workflows/schedule-watch.yml',
      anchor: '      - name: Every scheduled workflow ran on time and passed\n',
      replacement: `      # uses: ${SETUP_NODE}\n      - name: Every scheduled workflow ran on time and passed\n`,
      red: {},
    },
  ],
});
