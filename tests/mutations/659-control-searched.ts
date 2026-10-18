import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * #659 AC6 (b), a planted control, never merged: a pull request that changes
 * `tests/searched.ts` passes the judge only with a row planted in it and
 * predicted red for a guards test that loads it. Predicted before its first
 * run: the plant adds a finding only for the one search whose `what` is the
 * collection-calls import search (the string occurs once in the repo), so
 * that test alone goes red, its `toEqual([])` printing the planted finding.
 * Guards-suite mutation: it runs in CI only.
 */

const COLLECTION = 'tests/guards/collection-calls.test.ts';

export default mutationFile({
  targets: [COLLECTION],
  mutations: [
    {
      name: 'searched-plants-a-finding',
      file: 'tests/searched.ts',
      anchor: '  return findings;\n}',
      replacement:
        "  return what === 'relative imports in test files and their helpers'\n" +
        "    ? [...findings, 'planted' as T]\n" +
        '    : findings;\n}',
      red: {
        [`${COLLECTION} › the suite > follows every relative import of a test file to the helper modules it loads, and scans them too (#554)`]:
          'planted',
      },
    },
  ],
});
