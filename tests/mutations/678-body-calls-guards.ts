import { mutationFile } from '../../scripts/mutation-file.ts';

/**
 * The guards-suite half of #678's reader change (#659: a changed helper that
 * non-unit tests load needs a mutation planted in it that one of them sees).
 * Predicted before the first run, from a probe that bundled the reader as
 * written and as mutated and ran both over the guard's own file set (210
 * committable test files): 2,605 calls examined as written, the recorded
 * one-test-per-case/repo-calls floor, and 18,807 as mutated.
 *
 * `body-plain-calls-counted` counts every call inside a test's body, not only
 * the calls on `it` and `test`, so the examined population swells with calls
 * the reader never classifies. The repo holds no call on `it` or `test`
 * inside a test body, so only the floor can see it; the guard's other
 * figures (files, tests, loops, unclassified) are untouched, and the two
 * other guards that load the helper use none of the changed code.
 * Guards-suite mutation: it runs in CI only.
 */

const GUARD = 'tests/guards/one-test-per-case.test.ts';
const CALLS = `${GUARD} › the suite > classifies every call on it and test, refusing by name what it cannot read`;

export default mutationFile({
  targets: [GUARD],
  mutations: [
    {
      name: 'body-plain-calls-counted',
      file: 'tests/unit/one-test-per-case.ts',
      anchor: "    if (kind === 'none') return true;\n    examined += 1;\n",
      replacement:
        "    examined += 1;\n    if (kind === 'none') return true;\n",
      red: { [CALLS]: 'one-test-per-case/repo-calls: read 18807' },
    },
  ],
});
