import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The scalar-zero reader reads a zero a promise settles to, or a polled value
 * reaches (#786), in the unit suite. Predicted before the first run
 * (2026-10-30 UTC). The rows break the fix one part at a time: stepping
 * through the property links, the settled zero never being a site, `.not`
 * on either side, and the fallback itself.
 */

const CASES =
  'tests/unit/floorless-searches.test.ts › searchSitesIn: scalar zeros it does not read as sites (#367) >';
const each = (names: readonly string[]) =>
  Object.fromEntries(
    names.map((name) => [`${CASES} ${name}`, 'to deeply equal']),
  );

const SETTLED = [
  'a zero a promise resolves to',
  'a zero a promise rejects with',
  'a negated settled zero',
  'a zero negated before it settles',
  'a soft settled zero',
  'a settled length of 0, which is no site',
];

export default mutationFile({
  targets: ['tests/unit/floorless-searches.test.ts'],
  mutations: [
    {
      // The polled zero's base is already the call, so it stays read.
      name: 'no-stepping-through',
      file: 'tests/unit/floorless-searches.ts',
      anchor: '  while (ts.isPropertyAccessExpression(target)) {',
      replacement:
        '  while (ts.isPropertyAccessExpression(target) && negated) {',
      red: each(SETTLED),
    },
    {
      name: 'a-settled-zero-can-be-a-site',
      file: 'tests/unit/floorless-searches.ts',
      anchor: '          !read.settled &&\n',
      replacement: '',
      red: each(['a settled length of 0, which is no site']),
    },
    {
      name: 'not-ignored-on-a-settled-zero',
      file: 'tests/unit/floorless-searches.ts',
      anchor: "    if (target.name.text === 'not') negated = true;",
      replacement: "    if (target.name.text === 'not') negated = false;",
      red: each(['a negated settled zero', 'a zero negated before it settles']),
    },
    {
      // The matcher on expect itself already reads no zero: it stays green.
      name: 'the-fallback-reads-nothing',
      file: 'tests/unit/floorless-searches.ts',
      anchor:
        '  return ts.isCallExpression(target)\n    ? { expectation: target, negated, settled: true }\n    : undefined;',
      replacement: '  return undefined;',
      red: each([...SETTLED, 'a polled zero']),
    },
  ],
});
