import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #692 in the guards suite (judge rule #659: a changed helper a non-unit
 * test loads gets a row planted in it), each predicted before it first ran
 * (2026-10-20). G1 reads flags alone as empty, so the three flag-only
 * asserts this repository writes (shop, board-orphans-workflow,
 * ci-fast-path) become unproved sites the text count never wrote; the list
 * check fails before its floor. G2 drops a twin #692 added from the list.
 */
export default mutationFile({
  targets: ['tests/guards/floorless-searches.test.ts'],
  mutations: [
    {
      name: 'G1-flags-alone-empty',
      file: 'tests/unit/floorless-searches.ts',
      anchor: "  let reading: Reading = 'flag';",
      replacement: "  let reading: Reading = 'empty';",
      red: {
        'tests/guards/floorless-searches.test.ts › every absence search is proved, or listed (#361) > finds every scope holding exactly the unproved searches listed':
          '1 unproved, 0 listed',
        'tests/guards/floorless-searches.test.ts › the reader proves what it read (#361) > reads as many absence sites in each file as its text writes, over every file git has':
          'ci-fast-path.test.ts',
      },
    },
    {
      name: 'G2-scheduled-twin-unlisted',
      file: 'tests/unit/floorless-searches.twins.ts',
      anchor:
        "  'tests/unit/scheduled-workflows.test.ts › judges no job of a workflow with no schedule, even one naming production': 1,\n",
      replacement: '',
      red: {
        'tests/guards/floorless-searches.test.ts › every bad twin is listed for review (#374) > finds every scope using againstTwin exactly as the twin list holds':
          'even one naming production: 1 proved by a twin, 0 listed',
      },
    },
  ],
});
