import { mutationFile } from '../../scripts/mutation-file.ts';

const BARE =
  'tests/unit/floorless-searches.test.ts › searchSitesIn: bare absence forms > ';
const NO_CALL =
  'tests/unit/record-floors-callers.test.ts › readFloorCaller: the name in text is no call (#448 AC1) > ';
const INLINE = [
  'the name in a comment',
  'the name in a string',
  'the name in a template literal',
  'an object key of that name',
  'another name from the floors module',
  'another member of a floors namespace',
  'an import never used',
];
const twinsDead = Object.fromEntries(
  INLINE.map((what) => [
    `${NO_CALL}reads ${what} as no caller`,
    'the twin found nothing',
  ]),
);

/**
 * #692's unit mutations, each predicted before it first ran (2026-10-20):
 * the reader's three readings of a value (R1 flags alone read as empty, R2
 * a flag read as something, R3 something ignored), and each proof of the
 * three sites the reader now finds made dead (P1 the twin's finding, P2 the
 * planted call, P3 the scheduled twin's finding).
 */
export default mutationFile({
  targets: [
    'tests/unit/floorless-searches.test.ts',
    'tests/unit/record-floors-callers.test.ts',
    'tests/unit/scheduled-workflows.test.ts',
  ],
  mutations: [
    {
      name: 'R1-flags-alone-empty',
      file: 'tests/unit/floorless-searches.ts',
      anchor: "  let reading: Reading = 'flag';",
      replacement: "  let reading: Reading = 'empty';",
      red: {
        [`${BARE}reads an object of a false flag alone (#692) as no site`]:
          'to deeply equal',
        [`${BARE}reads an object of nulls alone (#692) as no site`]:
          'to deeply equal',
        [`${BARE}reads a nested object of a flag alone (#692) as no site`]:
          'to deeply equal',
      },
    },
    {
      name: 'R2-flag-read-as-something',
      file: 'tests/unit/floorless-searches.ts',
      anchor: "    return 'flag';",
      replacement: "    return 'something';",
      red: {
        [`${BARE}reads expect(r).toEqual({ found: [], truncated: false }); as a bare empty site, never proved`]:
          'to deeply equal',
        [`${BARE}reads expect(r).toEqual({ found: [], error: null }); as a bare empty site, never proved`]:
          'to deeply equal',
        [`${BARE}reads expect(r).toStrictEqual({ outer: { found: [], done: false } }); as a bare empty site, never proved`]:
          'to deeply equal',
        [`${BARE}reads expect(r).toEqual({ flags: { done: false }, found: [] }); as a bare empty site, never proved`]:
          'to deeply equal',
      },
    },
    {
      name: 'R3-something-ignored',
      file: 'tests/unit/floorless-searches.ts',
      anchor: "    if (value === 'something') return 'something';\n",
      replacement: '',
      red: {
        [`${BARE}reads true beside an empty finding (#692) as no site`]:
          'to deeply equal',
        [`${BARE}reads a non-zero number beside an empty finding (#692) as no site`]:
          'to deeply equal',
        [`${BARE}reads a non-empty string beside an empty finding (#692) as no site`]:
          'to deeply equal',
        [`${BARE}reads an object holding a population beside an empty finding (#558) as no site`]:
          'to deeply equal',
      },
    },
    {
      name: 'P1-twin-finding-dropped',
      file: 'tests/unit/record-floors-callers.test.ts',
      anchor: "  return calls ? ['calls floorBreach', ...refusals] : refusals;",
      replacement: '  return calls ? refusals : refusals;',
      red: twinsDead,
    },
    {
      name: 'P2-nothing-planted',
      file: 'tests/unit/record-floors-callers.test.ts',
      anchor: "\\ntwinFloors.floorBreach('a/b', 1);`;",
      replacement: '`;',
      red: {
        ...twinsDead,
        [`${NO_CALL}reads the recorder, which names it in prose and messages as no caller, and as one with a call planted`]:
          'to deeply equal',
        [`${NO_CALL}reads the floorless-searches guard, which names it in strings as no caller, and as one with a call planted`]:
          'to deeply equal',
        [`${NO_CALL}reads the literal-floors guard, which names it in strings as no caller, and as one with a call planted`]:
          'to deeply equal',
        [`${NO_CALL}reads the floors module itself as no caller, though its text elsewhere calls and is refused`]:
          'to deeply equal',
      },
    },
    {
      name: 'P3-scheduled-twin-finding-dropped',
      file: 'tests/unit/scheduled-workflows.test.ts',
      anchor: '        ? [scan]',
      replacement: '        ? []',
      red: {
        'tests/unit/scheduled-workflows.test.ts › scanSchedule > judges no job of a workflow with no schedule, even one naming production':
          'the twin found nothing',
      },
    },
  ],
});
