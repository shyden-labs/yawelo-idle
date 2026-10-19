import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #374 in the guards suite (judge rule #659: a changed helper a non-unit
 * test loads gets a row planted in it), each predicted before it first ran
 * (2026-10-19). G3 counts every scope's sites as one, so the literal-floors
 * list, which shares listFindings, goes red too.
 */
export default mutationFile({
  targets: [
    'tests/guards/floorless-searches.test.ts',
    'tests/guards/literal-floors.test.ts',
  ],
  mutations: [
    {
      name: 'G1-twin-read-as-control',
      file: 'tests/unit/floorless-searches.ts',
      anchor: "            : 'twin';",
      replacement: "            : 'control';",
      red: {
        'tests/guards/floorless-searches.test.ts › every absence search is proved, or listed (#361) > finds every scope holding exactly the unproved searches listed':
          'unproved, 0 listed',
        'tests/guards/floorless-searches.test.ts › every bad twin is listed for review (#374) > finds every scope using againstTwin exactly as the twin list holds':
          'searched no twin sites',
      },
    },
    {
      name: 'G2-text-misses-twin',
      file: 'tests/unit/absence-text.ts',
      anchor:
        '      /(?<![\\w$])(?<!(?<!\\.\\.)\\.)(?:searched|againstControl|againstTwin)(?![\\w$])/g,',
      replacement:
        '      /(?<![\\w$])(?<!(?<!\\.\\.)\\.)(?:searched|againstControl)(?![\\w$])/g,',
      red: {
        'tests/guards/floorless-searches.test.ts › the reader proves what it read (#361) > reads as many absence sites in each file as its text writes, over every file git has':
          'core-determinism-lint.test.ts: 0 written, 4 read',
      },
    },
    {
      name: 'G3-every-scope-counted-once',
      file: 'tests/unit/burn-down.ts',
      anchor: '    now.set(key, (now.get(key) ?? 0) + 1);',
      replacement: '    now.set(key, (now.get(key) ?? 0) * 0 + 1);',
      red: {
        'tests/guards/floorless-searches.test.ts › every absence search is proved, or listed (#361) > finds every scope holding exactly the unproved searches listed':
          '1 unproved, 2 listed. Lower the entry in tests/unit/floorless-searches.burn-down.ts',
        'tests/guards/floorless-searches.test.ts › every bad twin is listed for review (#374) > finds every scope using againstTwin exactly as the twin list holds':
          '1 proved by a twin, 2 listed. Lower or remove',
        'tests/guards/literal-floors.test.ts › every literal minimum of two or more is recorded, or listed (#378) > finds every scope holding exactly the literal minimums listed':
          'Lower the entry in tests/unit/literal-floors.burn-down.ts',
      },
    },
    {
      name: 'G4-converted-scope-relisted',
      file: 'tests/unit/floorless-searches.burn-down.ts',
      anchor: 'export const UNPROVED: Readonly<Record<string, number>> = {',
      replacement:
        "export const UNPROVED: Readonly<Record<string, number>> = {\n  'tests/unit/burn-down.test.ts › leaves nothing when every item is matched': 1,",
      red: {
        'tests/guards/floorless-searches.test.ts › every absence search is proved, or listed (#361) > finds every scope holding exactly the unproved searches listed':
          'leaves nothing when every item is matched: 0 unproved, 1 listed',
      },
    },
    {
      name: 'G5-twin-unlisted',
      file: 'tests/unit/floorless-searches.twins.ts',
      anchor: "  'tests/unit/core-determinism-lint.test.ts › lint': 1,\n",
      replacement: '',
      red: {
        'tests/guards/floorless-searches.test.ts › every bad twin is listed for review (#374) > finds every scope using againstTwin exactly as the twin list holds':
          'core-determinism-lint.test.ts › lint: 1 proved by a twin, 0 listed',
      },
    },
  ],
});
