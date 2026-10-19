import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * A deleted or transferred issue is seen by its absence (#689, found after
 * #691 merged), in the unit suite, predicted before the first run. Each row
 * puts back one way it could go wrong: the absence rule dropped, every issue
 * action read as staying, and a delivery with no action given a witness.
 */

const WITNESS = 'apps/site/worker/witness.test.ts';

export default mutationFile({
  targets: [WITNESS],
  mutations: [
    {
      name: 'gone-issue-never-seen',
      file: 'apps/site/worker/witness.ts',
      anchor: '    if (witness.gone) return read === undefined;\n',
      replacement: '',
      red: {
        [`${WITNESS} › sees > sees a deleted or transferred issue by its absence`]:
          'expected false to be true',
        [`${WITNESS} › sees > does not see a gone issue the read still has, however new its stamp`]:
          'expected true to be false',
        [`${WITNESS} › account > explains a deleted issue’s card leaving the board`]:
          'to deeply equal',
      },
    },
    {
      name: 'every-issue-action-stays',
      file: 'apps/site/worker/witness.ts',
      anchor: '      gone: ISSUE_GONE.has(action),\n',
      replacement: '      gone: false,\n',
      red: {
        [`${WITNESS} › eventWitness > names the issue of an issues deleted event, gone`]:
          'to deeply equal',
        [`${WITNESS} › eventWitness > names the issue of an issues transferred event, gone`]:
          'to deeply equal',
      },
    },
    {
      name: 'no-action-still-a-witness',
      file: 'apps/site/worker/witness.ts',
      anchor: "    if (typeof action !== 'string') return null;\n",
      replacement: '',
      red: {
        [`${WITNESS} › eventWitness > names nothing for an issues event without an action`]:
          'to be null',
      },
    },
  ],
});
